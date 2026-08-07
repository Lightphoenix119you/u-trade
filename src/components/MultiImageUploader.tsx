import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, ImagePlus, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MultiImageUploaderProps {
  bucket: string;
  /** Dossier dans le bucket — doit correspondre à la policy RLS (généralement l'id de l'utilisateur) */
  pathPrefix: string;
  urls: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  /** Appelé avec le message brut Supabase quand un upload échoue (pas les erreurs de validation locales) */
  onUploadError?: (message: string) => void;
}

const MAX_SIZE_BYTES = 6 * 1024 * 1024; // 6 Mo (limite avant compression)
const MAX_DIMENSION = 1600; // px, plus long côté après redimensionnement
const JPEG_QUALITY = 0.82;

/*
 * Redimensionne/compresse l'image côté client avant upload. Toute erreur
 * retombe sur le fichier original — cette fonction ne doit jamais lever.
 */
async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    if (!blob) return file;

    return new File([blob], file.name.replace(/\.[^./]+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/*
 * Error Boundary local : protège le reste de la page/modale si un rendu dans
 * cette zone lève une exception. Affiche désormais le VRAI message + la pile
 * d'appel capturés (au lieu d'un texte générique) pour pouvoir diagnostiquer
 * précisément — voir componentDidCatch ci-dessous.
 */
class ImageUploaderBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; stack: string | null }
> {
  state: { error: Error | null; stack: string | null } = { error: null, stack: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ stack: info.componentStack });
    console.error('MultiImageUploader crash:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <div className="mb-1.5 flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Erreur : {this.state.error.message || this.state.error.name || 'erreur inconnue'}
          </div>
          {this.state.stack && (
            <pre className="mb-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[10px] text-red-300/60">
              {this.state.stack}
            </pre>
          )}
          <button
            type="button"
            onClick={() => this.setState({ error: null, stack: null })}
            className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium hover:bg-white/20"
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Preview {
  id: string;
  blobUrl: string;
}

function MultiImageUploaderInner({
  bucket,
  pathPrefix,
  urls,
  onChange,
  maxFiles = 6,
  disabled,
  onUploadError,
}: MultiImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [error, setError] = useState<string | null>(null);

  const remainingSlots = maxFiles - urls.length - previews.length;
  const isUploading = previews.length > 0;

  // Nettoie les blob: URLs quand le composant se démonte, pour éviter les fuites mémoire.
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.blobUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiles = async (files: FileList) => {
    try {
      setError(null);
      const list = Array.from(files);

      if (list.length > remainingSlots) {
        setError(`${maxFiles} images maximum — ${remainingSlots} emplacement${remainingSlots > 1 ? 's' : ''} restant${remainingSlots > 1 ? 's' : ''}.`);
      }
      const toUpload = list.slice(0, Math.max(0, remainingSlots));
      if (toUpload.length === 0) return;

      for (const rawFile of toUpload) {
        // Aperçu local immédiat — s'affiche avant même le début de l'upload,
        // pour éviter toute sensation de blocage à la sélection sur mobile.
        const previewId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let blobUrl = '';

        try {
          if (!rawFile.type.startsWith('image/')) {
            setError('Seules les images sont acceptées.');
            continue;
          }
          if (rawFile.size > MAX_SIZE_BYTES) {
            setError(`"${rawFile.name}" dépasse 6 Mo.`);
            continue;
          }

          blobUrl = URL.createObjectURL(rawFile);
          setPreviews((prev) => [...prev, { id: previewId, blobUrl }]);

          const file = await compressImage(rawFile);
          const ext = file.name.split('.').pop() || 'jpg';
          const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

          const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
            cacheControl: '3600',
            upsert: false,
          });

          if (uploadError) {
            // Message brut de Supabase — pas de texte générique — pour distinguer
            // bucket manquant, RLS refusée, format rejeté, etc.
            setError(`Échec de l'envoi ("${bucket}") : ${uploadError.message}`);
            onUploadError?.(uploadError.message);
          } else {
            const { data } = supabase.storage.from(bucket).getPublicUrl(path);
            onChange([...urls, data.publicUrl]);
          }
        } catch (err) {
          setError(
            err instanceof Error
              ? `Erreur lors de l'upload : ${err.message}`
              : "Erreur inattendue lors de l'upload de l'image."
          );
        } finally {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          setPreviews((prev) => prev.filter((p) => p.id !== previewId));
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `Erreur inattendue : ${err.message}`
          : 'Une erreur inattendue est survenue pendant la sélection des images.'
      );
      setPreviews([]);
    }
  };

  const removeAt = (i: number) => {
    onChange(urls.filter((_, idx) => idx !== i));
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {urls.map((url, i) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-lg">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {previews.map((p) => (
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg">
            <img src={p.blobUrl} alt="" className="h-full w-full object-cover opacity-50" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          </div>
        ))}

        {remainingSlots > 0 && (
          <button
            type="button"
            onClick={() => !disabled && inputRef.current?.click()}
            disabled={disabled}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 bg-white/5 text-white/40 transition hover:border-white/40 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px]">Ajouter</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          try {
            if (e.target.files?.length) handleFiles(e.target.files);
          } catch {
            setError('Impossible de lire les fichiers sélectionnés.');
          } finally {
            e.target.value = '';
          }
        }}
      />

      <p className="mt-2 text-xs text-white/30">
        {urls.length}/{maxFiles} images{isUploading ? ' — envoi en cours...' : ''}
      </p>
      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

export function MultiImageUploader(props: MultiImageUploaderProps) {
  return (
    <ImageUploaderBoundary>
      <MultiImageUploaderInner {...props} />
    </ImageUploaderBoundary>
  );
}
