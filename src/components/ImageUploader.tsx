import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ImageUploaderProps {
  bucket: 'avatars' | 'campus-logos';
  /** Dossier dans le bucket — doit correspondre à la policy RLS (user_id ou campus_id) */
  pathPrefix: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  shape?: 'circle' | 'square';
  sizeClass?: string;
  fallbackLabel?: string;
  disabled?: boolean;
}

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4 Mo

export function ImageUploader({
  bucket,
  pathPrefix,
  currentUrl,
  onUploaded,
  shape = 'circle',
  sizeClass = 'h-20 w-20',
  fallbackLabel,
  disabled,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Le fichier doit être une image.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Image trop lourde (max 4 Mo).');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${pathPrefix}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (uploadError) {
        setError(uploadError.message);
        setUploading(false);
        return;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onUploaded(data.publicUrl);
    } catch {
      setError("Erreur lors de l'upload.");
    }
    setUploading(false);
  };

  const shapeClass = shape === 'circle' ? 'rounded-2xl' : 'rounded-xl';

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        disabled={disabled || uploading}
        className={`group relative flex flex-shrink-0 items-center justify-center overflow-hidden ${shapeClass} ${sizeClass} bg-white/10 transition disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl font-bold text-white/70">{fallbackLabel || '?'}</span>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
