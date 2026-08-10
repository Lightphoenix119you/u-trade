import { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Package, Palette, Zap, Tag, Info, Shield, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { GlassCard } from '@/components/GlassCard';
import { CampusSelector } from '@/components/CampusSelector';
import { MultiImageUploader } from '@/components/MultiImageUploader';
import { listingSchema } from '@/lib/validation';
import { detectBlockedContent } from '@/lib/antiCircumvention';
import { CATEGORIES, CONDITIONS, type CampusHub } from '@/lib/types';
import { formatUSD, formatFC } from '@/lib/format';
import type { ListingType } from '@/lib/types';

interface SellProps {
  navigate: (path: string) => void;
}

export function Sell({ navigate }: SellProps) {
  const { user, profile } = useAuth();
  const { selectedCampusId, settings } = useCampus();
  const [type, setType] = useState<ListingType>('secondhand');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('electronics');
  const [condition, setCondition] = useState('good');
  const [hubId, setHubId] = useState('');
  const [productionDays, setProductionDays] = useState('5');
  const [artistInstructions, setArtistInstructions] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isBoosted, setIsBoosted] = useState(false);
  const [hubs, setHubs] = useState<CampusHub[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockWarn, setBlockWarn] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Un vendeur invité (profile.campus_id === null) n'est rattaché à aucun
  // campus fixe : il choisit lui-même l'université concernée par CETTE
  // annonce, puis voit les points de rendez-vous de cette université
  // précise — plutôt que d'être limité au filtre global du header.
  const isGuestSeller = !profile?.campus_id;
  const [guestCampusId, setGuestCampusId] = useState<string | null>(null);
  const effectiveCampusId = isGuestSeller ? guestCampusId : (profile?.campus_id || selectedCampusId);

  useEffect(() => {
    if (!effectiveCampusId || effectiveCampusId === '00000000-0000-0000-0000-000000000000') {
      setHubs([]);
      return;
    }
    supabase
      .from('campus_hubs')
      .select('*')
      .eq('campus_id', effectiveCampusId)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setHubs((data as CampusHub[]) || []));
  }, [effectiveCampusId]);

  if (!user) {
    return (
      <div className="relative z-10 mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="text-xl font-semibold">Connexion requise</h2>
        <p className="mt-2 text-sm text-white/40">Connectez-vous pour publier une annonce</p>
        <button onClick={() => navigate('/signin')} className="campus-gradient mt-4 rounded-lg px-6 py-2.5 text-sm font-semibold text-white">
          Se connecter
        </button>
      </div>
    );
  }

  const rate = settings?.usd_to_fc_rate ?? 2800;
  const priceNum = parseFloat(price) || 0;
  const boostPrice = settings?.boost_price_usd ?? 2;
  const urgentPrice = settings?.urgent_price_usd ?? 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (imageUrls.length === 0) {
      setError('Ajoutez au moins une image');
      return;
    }
    if (isGuestSeller && !guestCampusId) {
      setError('Choisissez une université pour cette annonce');
      return;
    }
    if (!hubId) {
      setError('Sélectionnez un point de rendez-vous');
      return;
    }

    const descBlock = detectBlockedContent(description);
    if (descBlock) {
      setError(descBlock);
      return;
    }

    const parsed = listingSchema.safeParse({
      title,
      description,
      price_usd: priceNum,
      type,
      category,
      condition,
      image_urls: imageUrls,
      hub_id: hubId,
      production_delay_days: type === 'custom' ? parseInt(productionDays) : undefined,
      artist_instructions: type === 'custom' && artistInstructions.trim() ? artistInstructions.trim() : undefined,
      is_urgent: isUrgent,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Formulaire invalide');
      return;
    }

    setLoading(true);

    const { data, error: insertErr } = await supabase
      .from('listings')
      .insert({
        seller_id: user.id,
        campus_id: effectiveCampusId,
        hub_id: hubId,
        title: parsed.data.title,
        description: parsed.data.description,
        price_usd: parsed.data.price_usd,
        type: parsed.data.type,
        category: parsed.data.category,
        condition: parsed.data.condition || null,
        image_urls: parsed.data.image_urls,
        production_delay_days: parsed.data.production_delay_days || null,
        artist_instructions: parsed.data.artist_instructions || null,
        is_urgent: parsed.data.is_urgent,
        is_boosted: isBoosted,
        boost_until: isBoosted ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() : null,
        status: 'active',
      })
      .select()
      .single();

    setLoading(false);

    if (insertErr) {
      setError('Erreur: ' + insertErr.message);
      return;
    }

    // Record paid options as transactions
    if (isBoosted) {
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'boost',
        amount_usd: boostPrice,
        description: 'Boost d\'annonce 3 jours',
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

    setSuccess('Annonce publiée avec succès !');
    setTimeout(() => navigate(`/listing/${data.id}`), 1500);
  };

  return (
    <div className="relative z-10 mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <button
        onClick={() => navigate('/market')}
        className="mb-4 flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      <h1 className="mb-1 text-2xl font-bold">Publier une annonce</h1>
      <p className="mb-6 text-sm text-white/40">Vendez un objet seconde main ou créez une commande sur-mesure</p>

      {/* Type selector */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => setType('secondhand')}
          className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
            type === 'secondhand' ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/5'
          }`}
          style={type === 'secondhand' ? { borderColor: 'var(--campus-primary)' } : undefined}
        >
          <Package className="h-6 w-6 campus-text" />
          <span className="font-semibold text-sm">Objet Seconde Main</span>
          <span className="text-xs text-white/40">Stock immédiat</span>
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="relative flex flex-col items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 pointer-events-none opacity-50 backdrop-blur-sm"
        >
          <Palette className="h-6 w-6 campus-text" />
          <span className="font-semibold text-sm">Boutique / Sur-Mesure</span>
          <span className="text-xs text-white/40">Commande créateur</span>
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">
              <Lock className="h-3 w-3" /> Bientôt disponible
            </span>
          </div>
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <GlassCard className="p-5">
          <label className="mb-1.5 block text-sm font-medium text-white/70">Titre</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === 'custom' ? 'Portrait personnalisé sur commande' : 'Calculatrice scientifique Casio'}
            className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
          />

          <label className="mb-1.5 block text-sm font-medium text-white/70">Description</label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (detectBlockedContent(e.target.value)) setBlockWarn(detectBlockedContent(e.target.value)!);
              else setBlockWarn(null);
            }}
            placeholder={type === 'custom' ? 'Décrivez votre service, ce que vous proposez de créer...' : 'État, détails, accessoires inclus...'}
            rows={4}
            className={`mb-2 w-full rounded-lg border bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30 ${
              blockWarn ? 'border-amber-500/40' : 'border-white/10'
            }`}
          />
          {blockWarn && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
              <Shield className="h-3.5 w-3.5 flex-shrink-0" />
              {blockWarn}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Prix (USD)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
              />
              {priceNum > 0 && (
                <p className="mt-1 text-xs text-white/40">= {formatFC(priceNum, rate)}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value} className="bg-gray-900">{c.label}</option>
                ))}
              </select>
            </div>

            {type === 'secondhand' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">État</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value} className="bg-gray-900">{c.label}</option>
                  ))}
                </select>
              </div>
            )}

            {type === 'custom' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">Délai de réalisation (jours)</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={productionDays}
                  onChange={(e) => setProductionDays(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
                />
              </div>
            )}

            {type === 'custom' && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-white/70">Consignes pour l'artiste</label>
                <textarea
                  value={artistInstructions}
                  onChange={(e) => setArtistInstructions(e.target.value)}
                  placeholder="Indiquez aux acheteurs les informations dont vous avez besoin : couleurs, dimensions, style, texte à inclure..."
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
                />
                <p className="mt-1 text-xs text-white/30">Ces consignes s'affichent sur votre annonce pour guider les acheteurs.</p>
              </div>
            )}

            <div className="sm:col-span-2">
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
                <option value="" className="bg-gray-900">Sélectionnez un point de rencontre</option>
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id} className="bg-gray-900">{hub.name}</option>
                ))}
              </select>
              {hubs.length === 0 && (!isGuestSeller || guestCampusId) && (
                <p className="mt-1 text-xs text-amber-400/60">Aucun point de rendez-vous pour ce campus</p>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Images */}
        <GlassCard className="p-5">
          <label className="mb-2 block text-sm font-medium text-white/70">Photos</label>
          <MultiImageUploader
            bucket="listings"
            pathPrefix={user.id}
            urls={imageUrls}
            onChange={setImageUrls}
            maxFiles={6}
          />
        </GlassCard>

        {/* Paid options */}
        <GlassCard className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Options payantes</h3>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 transition hover:border-white/20">
              <input
                type="checkbox"
                checked={isBoosted}
                onChange={(e) => setIsBoosted(e.target.checked)}
                className="h-4 w-4 rounded accent-blue-500"
              />
              <Tag className="h-4 w-4 text-amber-400" />
              <div className="flex-1">
                <div className="text-sm font-medium">Boost d'annonce (3 jours)</div>
                <div className="text-xs text-white/40">Mise en avant dans les résultats</div>
              </div>
              <span className="text-sm font-semibold campus-text">{formatUSD(boostPrice)}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 transition hover:border-white/20">
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
        </GlassCard>

        {type === 'custom' && (
          <div className="flex items-start gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-sm text-purple-200">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Les commandes sur-mesure nécessitent un acompte. Le chat avec le créateur est activé
              après validation de la commande. L'acheteur pourra fournir ses consignes et photos de référence.
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="campus-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? 'Publication...' : 'Publier l\'annonce'}
        </button>
      </form>
    </div>
  );
}
