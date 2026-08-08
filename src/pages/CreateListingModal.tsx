import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Palette } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { MultiImageUploader } from '@/components/MultiImageUploader';
import { CampusSelector } from '@/components/CampusSelector';
import { CATEGORIES, CONDITIONS, type CampusHub } from '@/lib/types';
import type { CreateListingFormData, CreateListingModalProps } from '@/types/listing';

// NOTE : le champ "condition" n'a de sens que pour les annonces seconde main
// (type='secondhand', valeur par défaut en base) — cette modale est donc une
// création rapide d'objet seconde main. Pour une commande sur-mesure
// (créateur), le flux complet de Sell.tsx reste nécessaire.
//
// NOTE 2 : la table `listings` exige aussi hub_id et campus_id (NOT NULL en
// base). Ces champs ne font pas partie de CreateListingFormData tel que
// spécifié, mais sans eux l'insertion échoue — ils sont donc gérés en état
// local séparé ci-dessous plutôt qu'ajoutés au type exporté.

const initialForm: CreateListingFormData = {
  title: '',
  description: '',
  price: 0,
  category: 'electronics',
  condition: 'good',
};

// Censure basique côté client — liste minimale à titre d'exemple, à étendre
// selon votre politique de modération. Vérification par mot entier
// (word-boundary), insensible à la casse.
//
// ⚠️ Ceci est un filtre CÔTÉ CLIENT uniquement : il est trivialement
// contournable par quiconque appelle l'API Supabase directement (curl,
// Postman...). Pour une vraie protection, dupliquez cette vérification côté
// serveur (ex. trigger BEFORE INSERT sur `listings`) — le client n'est
// qu'une première ligne de confort pour l'utilisateur normal.
const FORBIDDEN_WORDS = [
  'arnaque', 'escroquerie', 'contrefaçon', 'drogue', 'stupéfiant',
  'arme', 'pistolet', 'escort',
  // Ajoutez ici les termes que votre équipe de modération veut bloquer.
];

function findForbiddenWord(text: string): string | null {
  const normalized = text.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, 'i');
    if (pattern.test(normalized)) return word;
  }
  return null;
}

export function CreateListingModal({ isOpen, onClose, onSuccess }: CreateListingModalProps) {
  const { user, profile } = useAuth();
  const { selectedCampusId } = useCampus();

  const [form, setForm] = useState<CreateListingFormData>(initialForm);
  const [images, setImages] = useState<string[]>([]);
  const [hubs, setHubs] = useState<CampusHub[]>([]);
  const [hubId, setHubId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGuestSeller = !profile?.campus_id;
  const [guestCampusId, setGuestCampusId] = useState<string | null>(null);
  const campusId = isGuestSeller ? guestCampusId : (profile?.campus_id || selectedCampusId);

  // Préparation modération images : aucun service de modération d'images
  // n'est branché aujourd'hui (rien ne renverra jamais ce message tant que
  // ce n'est pas construit côté backend). Convention prête à l'emploi : le
  // jour où une Edge Function / trigger de modération rejette un upload, il
  // suffit qu'il fasse échouer l'upload avec un message contenant le mot
  // "moderation" pour que ce message clair s'affiche automatiquement ici,
  // sans autre changement frontend.
  const handleUploadError = (message: string) => {
    if (/moderation/i.test(message)) {
      setError('Image non conforme aux règles de la communauté. Merci d\'en choisir une autre.');
    }
    // Sinon, le message technique reste déjà affiché tel quel dans
    // MultiImageUploader lui-même — pas besoin de le dupliquer ici.
  };

  useEffect(() => {
    if (!isOpen || !campusId) return;
    supabase
      .from('campus_hubs')
      .select('*')
      .eq('campus_id', campusId)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setHubs((data as CampusHub[]) || []));
  }, [isOpen, campusId]);

  useEffect(() => {
    if (isOpen) {
      setForm(initialForm);
      setImages([]);
      setHubId('');
      setGuestCampusId(null);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('Vous devez être connecté.');
      return;
    }
    if (!form.title.trim()) {
      setError('Le titre est requis.');
      return;
    }

    const flaggedWord = findForbiddenWord(`${form.title} ${form.description}`);
    if (flaggedWord) {
      setError(`Votre annonce contient un terme non autorisé ("${flaggedWord}"). Merci de modifier le titre ou la description.`);
      return;
    }

    if (!form.price || form.price <= 0) {
      setError('Indiquez un prix valide.');
      return;
    }
    if (images.length === 0) {
      setError('Ajoutez au moins une image.');
      return;
    }
    if (!hubId) {
      setError('Sélectionnez un point de rendez-vous.');
      return;
    }
    if (!campusId) {
      setError(isGuestSeller ? 'Choisissez une université pour cette annonce.' : 'Aucun campus associé à votre profil.');
      return;
    }

    setLoading(true);
    const { error: insertError } = await supabase.from('listings').insert({
      seller_id: user.id,
      campus_id: campusId,
      hub_id: hubId,
      title: form.title.trim(),
      description: form.description.trim(),
      price_usd: form.price,
      type: 'secondhand',
      category: form.category,
      condition: form.condition,
      image_urls: images,
      status: 'active',
    });
    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="glass-strong relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Nouvelle annonce</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">Titre</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Calculatrice scientifique Casio"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="État, détails, accessoires inclus..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Prix (USD)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.price || ''}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Catégorie</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value} className="bg-gray-900">{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">État</label>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value} className="bg-gray-900">{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              {isGuestSeller && (
                <div className="mb-3">
                  <label className="mb-1.5 block text-sm font-medium text-white/70">
                    Université concernée par cette annonce
                  </label>
                  <CampusSelector
                    inline
                    hideAllOption
                    value={guestCampusId}
                    onChange={(id) => { setGuestCampusId(id); setHubId(''); }}
                  />
                </div>
              )}
              <label className="mb-1.5 block text-sm font-medium text-white/70">Point de rendez-vous</label>
              <select
                value={hubId}
                onChange={(e) => setHubId(e.target.value)}
                disabled={isGuestSeller && !guestCampusId}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30 disabled:opacity-40"
              >
                <option value="" className="bg-gray-900">Sélectionnez</option>
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id} className="bg-gray-900">{hub.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/70">Photos</label>
            {user && (
              <MultiImageUploader
                bucket="listings"
                pathPrefix={user.id}
                urls={images}
                onChange={setImages}
                onUploadError={handleUploadError}
                maxFiles={6}
              />
            )}
            <p className="mt-1.5 text-[11px] text-white/25">
              Les photos doivent respecter les règles de la communauté (pas de contenu illégal, violent ou inapproprié).
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="campus-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Publication...' : "Publier l'annonce"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { onClose(); window.location.hash = '/sell'; }}
          className="mt-4 flex w-full items-center gap-2.5 rounded-lg border border-dashed border-white/15 bg-white/5 p-3 text-left transition hover:border-white/30 hover:bg-white/10"
        >
          <Palette className="h-4 w-4 flex-shrink-0 text-white/40" />
          <span className="text-xs text-white/50">
            Vous proposez un service ou une commande créative sur-mesure ?{' '}
            <span className="campus-text font-medium">Cliquez ici</span>
          </span>
        </button>
      </div>
    </div>
  );
}
