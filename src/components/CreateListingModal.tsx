import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Palette, Tag, Zap, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { MultiImageUploader } from '@/components/MultiImageUploader';
import { CampusSelector } from '@/components/CampusSelector';
import { formatUSD, formatFC, computeCommission, estimateBoostReach } from '@/lib/format';
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
  const { selectedCampusId, settings } = useCampus();

  const [form, setForm] = useState<CreateListingFormData>(initialForm);
  const [images, setImages] = useState<string[]>([]);
  const [hubs, setHubs] = useState<CampusHub[]>([]);
  const [hubId, setHubId] = useState('');
  const [isBoosted, setIsBoosted] = useState(false);
  const [boostDurationDays, setBoostDurationDays] = useState(3);
  const [dailyBudget, setDailyBudget] = useState(1);
  const [isUrgent, setIsUrgent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MIN_DAILY_BUDGET = 0.5;
  const urgentPrice = settings?.urgent_price_usd ?? 1;
  const totalBoostBudget = Math.round(dailyBudget * boostDurationDays * 100) / 100;
  const reach = estimateBoostReach(dailyBudget, boostDurationDays);

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
      setIsBoosted(false);
      setBoostDurationDays(3);
      setDailyBudget(1);
      setIsUrgent(false);
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
    if (isBoosted && dailyBudget < MIN_DAILY_BUDGET) {
      setError(`Le budget quotidien minimum est de ${formatUSD(MIN_DAILY_BUDGET)}.`);
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
      is_urgent: isUrgent,
      is_boosted: isBoosted,
      boost_until: isBoosted ? new Date(Date.now() + boostDurationDays * 24 * 60 * 60 * 1000).toISOString() : null,
      daily_budget_usd: isBoosted ? dailyBudget : null,
      boost_duration_days: isBoosted ? boostDurationDays : null,
      total_boost_budget_usd: isBoosted ? totalBoostBudget : null,
      status: 'active',
    });
    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    // Sponsoring = revenu réel pour la plateforme, prélevé à la publication
    // (indépendamment d'une vente future) — même logique que Vente Urgente,
    // avec un montant désormais variable (budget quotidien × durée) plutôt
    // que le tarif fixe précédent.
    if (isBoosted) {
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'boost',
        amount_usd: totalBoostBudget,
        description: `Sponsoring ${boostDurationDays}j — ${formatUSD(dailyBudget)}/jour`,
        created_by: user.id,
      });
    }
    if (isUrgent) {
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'urgent',
        amount_usd: urgentPrice,
        description: 'Vente urgente',
        created_by: user.id,
      });
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

          <div>
            <h3 className="mb-2 text-sm font-semibold">Sponsoriser mon annonce</h3>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 transition hover:border-white/20">
              <input
                type="checkbox"
                checked={isBoosted}
                onChange={(e) => setIsBoosted(e.target.checked)}
                className="h-4 w-4 rounded accent-blue-500"
              />
              <Tag className="h-4 w-4 text-amber-400" />
              <div className="flex-1">
                <div className="text-sm font-medium">Activer le sponsoring</div>
                <div className="text-xs text-white/40">Budget et durée personnalisés — mise en avant proportionnelle</div>
              </div>
            </label>

            {isBoosted && (
              <div className="mt-3 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-white/70">Durée de la campagne</span>
                    <span className="font-semibold campus-text">{boostDurationDays} jour{boostDurationDays > 1 ? 's' : ''}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    step={1}
                    value={boostDurationDays}
                    onChange={(e) => setBoostDurationDays(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-white/30"><span>1 jour</span><span>30 jours</span></div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-white/70">Budget quotidien</span>
                    <span className="font-semibold campus-text">{formatUSD(dailyBudget)}/jour</span>
                  </div>
                  <input
                    type="range"
                    min={MIN_DAILY_BUDGET}
                    max={10}
                    step={0.5}
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="number"
                      min={MIN_DAILY_BUDGET}
                      step={0.5}
                      value={dailyBudget}
                      onChange={(e) => setDailyBudget(Math.max(MIN_DAILY_BUDGET, Number(e.target.value) || MIN_DAILY_BUDGET))}
                      className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm outline-none focus:border-white/30"
                    />
                    <span className="text-[11px] text-white/30">minimum {formatUSD(MIN_DAILY_BUDGET)}/jour — saisie libre si besoin de dépasser {formatUSD(10)}</span>
                  </div>
                </div>

                <div className="rounded-lg bg-white/5 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">Budget total</span>
                    <span className="text-base font-bold text-white">
                      {formatUSD(totalBoostBudget)} <span className="text-xs font-normal text-white/40">· {formatFC(totalBoostBudget, settings?.usd_to_fc_rate ?? 2800)}</span>
                    </span>
                  </div>
                </div>

                {/* Portée estimée — formule illustrative (estimateBoostReach),
                    aucune donnée de trafic réelle derrière ce chiffre. */}
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-300">
                    <Sparkles className="h-3.5 w-3.5" /> Portée estimée
                  </div>
                  <p className="text-sm text-white/70">
                    ~{reach.dailyViews.toLocaleString('fr-FR')} vues/jour
                    <span className="text-white/40"> (~{reach.totalViews.toLocaleString('fr-FR')} vues au total sur le campus)</span>
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="campus-gradient h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (dailyBudget / 10) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-white/25">Estimation indicative, non garantie.</p>
                </div>
              </div>
            )}

            <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 transition hover:border-white/20">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="h-4 w-4 rounded accent-red-500"
              />
              <Zap className="h-4 w-4 text-red-400" />
              <div className="flex-1">
                <div className="text-sm font-medium">Vente Urgente</div>
                <div className="text-xs text-white/40">Badge URGENT visible sur la carte</div>
              </div>
              <span className="text-sm font-semibold campus-text">{formatUSD(urgentPrice)}</span>
            </label>
          </div>

          {form.price > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Résumé financier</h3>
              {(() => {
                const commission = computeCommission(form.price, false, settings, isGuestSeller);
                const upfrontFees = (isBoosted ? totalBoostBudget : 0) + (isUrgent ? urgentPrice : 0);
                const netIfSold = commission.payout - upfrontFees;
                return (
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-white/50">
                      <span>Prix de l'article</span><span>{formatUSD(form.price)}</span>
                    </div>
                    {(isBoosted || isUrgent) && (
                      <div className="flex justify-between text-white/50">
                        <span>Panier options — payé maintenant</span><span>-{formatUSD(upfrontFees)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-white/50">
                      <span>Commission de vente ({(commission.rate * 100).toFixed(1)}%, si vendu)</span>
                      <span>-{formatUSD(commission.commission)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-1.5 font-semibold text-white">
                      <span>Net estimé si vendu</span>
                      <span className="campus-gradient-text">{formatUSD(netIfSold)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

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
          disabled
          aria-disabled="true"
          className="mt-4 flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg border border-dashed border-white/15 bg-white/5 p-3 text-left opacity-50"
        >
          <Palette className="h-4 w-4 flex-shrink-0 text-white/40" />
          <span className="text-xs text-white/50">
            Les commandes sur-mesure arrivent bientôt.{' '}
            <span className="font-medium">Reste connecté !</span>
          </span>
        </button>
      </div>
    </div>
  );
}
