import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, Star, MapPin, Clock, Zap, Tag, Shield, ShoppingBag, Palette,
  BadgeCheck, Award, MessageSquare, Flag, Send, Handshake, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { GlassCard } from '@/components/GlassCard';
import { BuyModal } from '@/components/BuyModal';
import { formatUSD, formatFC, formatDual, timeAgo, hexToRgba, computeCommission } from '@/lib/format';
import { offerSchema } from '@/lib/validation';
import type { ListingWithRelations, ListingReview } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

interface ListingDetailProps {
  listingId: string;
  navigate: (path: string) => void;
}

export function ListingDetail({ listingId, navigate }: ListingDetailProps) {
  const { user } = useAuth();
  const { settings, campuses } = useCampus();
  const [listing, setListing] = useState<ListingWithRelations | null>(null);
  const [reviews, setReviews] = useState<ListingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageIdx, setImageIdx] = useState(0);
  const [showOffer, setShowOffer] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerMsg, setOfferMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('listings')
      .select(`*, seller:profiles!listings_seller_id_fkey(*), shop:shops(*), campus:campuses(*), hub:campus_hubs(*)`)
      .eq('id', listingId)
      .maybeSingle();
    if (error || !data) {
      setListing(null);
      setLoading(false);
      return;
    }
    setListing(data as ListingWithRelations);

    const { data: revData } = await supabase
      .from('listing_reviews')
      .select('*, reviewer:profiles!listing_reviews_reviewer_id_fkey(*)')
      .eq('seller_id', (data as ListingWithRelations).seller_id)
      .order('created_at', { ascending: false })
      .limit(10);
    setReviews((revData as ListingReview[]) || []);

    // Increment view count
    await supabase
      .from('listings')
      .update({ view_count: ((data as ListingWithRelations).view_count || 0) + 1 })
      .eq('id', listingId);

    setLoading(false);
  }, [listingId]);

  useEffect(() => { load(); }, [load]);

  // Empêche l'achat en double du même article : cherche une commande encore
  // active (pas encore livrée/terminée/annulée) de cet acheteur pour cette
  // annonce précise. Défense de premier niveau — voir aussi le repli dans
  // BuyModal.tsx et l'index unique côté base pour la vraie garantie.
  useEffect(() => {
    if (!user || !listing) { setExistingOrderId(null); return; }
    let cancelled = false;
    supabase
      .from('orders')
      .select('id')
      .eq('listing_id', listing.id)
      .eq('buyer_id', user.id)
      .in('status', ['pending_payment', 'paid', 'in_delivery'])
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setExistingOrderId(data?.id ?? null);
      });
    return () => { cancelled = true; };
  }, [user, listing?.id]);

  const rate = settings?.usd_to_fc_rate ?? 2800;
  const isOwner = user?.id === listing?.seller_id;
  const commission = listing ? computeCommission(listing.price_usd, listing.type === 'custom', settings) : null;

  const handleOffer = async () => {
    if (!listing || !user) return;
    setActionError(null);
    const parsed = offerSchema.safeParse({
      offer_price_usd: parseFloat(offerPrice),
      message: offerMsg,
    });
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message || 'Offre invalide');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('offers').insert({
      listing_id: listing.id,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      offer_price_usd: parsed.data.offer_price_usd,
      message: parsed.data.message || null,
    });
    setSubmitting(false);
    if (error) {
      setActionError('Erreur: ' + error.message);
      return;
    }
    setShowOffer(false);
    setOfferPrice('');
    setOfferMsg('');
    setActionMsg('Offre envoyée au vendeur !');
    setTimeout(() => setActionMsg(null), 4000);
  };

  
  const handleReport = async () => {
    if (!listing || !user) return;
    const reason = prompt('Raison du signalement ?');
    if (!reason || reason.length < 5) return;
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      target_type: 'listing',
      target_id: listing.id,
      reason,
    });
    if (error) {
      setActionError('Erreur: ' + error.message);
      return;
    }
    setActionMsg('Signalement envoyé. Merci !');
    setTimeout(() => setActionMsg(null), 4000);
  };

  if (loading) {
    return (
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="skeleton h-8 w-32 rounded mb-4" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="skeleton aspect-square rounded-xl" />
          <div className="space-y-3">
            <div className="skeleton h-8 w-3/4 rounded" />
            <div className="skeleton h-6 w-1/3 rounded" />
            <div className="skeleton h-24 w-full rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-xl font-semibold">Annonce introuvable</h2>
        <button onClick={() => navigate('/market')} className="campus-text mt-3 text-sm hover:underline">
          Retour au marché
        </button>
      </div>
    );
  }

  const images = listing.image_urls?.length ? listing.image_urls : [];
  const category = CATEGORIES.find((c) => c.value === listing.category);
  const sellerCampus = campuses.find((c) => c.id === listing.campus_id);

  return (
    <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <button
        onClick={() => navigate('/market')}
        className="mb-4 flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      {/* Messages */}
      {actionMsg && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {actionMsg}
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Images */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl glass-card">
            {images.length > 0 ? (
              <img src={images[imageIdx]} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ShoppingBag className="h-16 w-16 text-white/10" />
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImageIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setImageIdx((i) => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition ${i === imageIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setImageIdx(i)}
                  className={`flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    i === imageIdx ? 'border-white/40' : 'border-transparent opacity-50'
                  }`}
                >
                  <img src={img} alt="" className="h-16 w-16 object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {listing.is_urgent && (
                <span className="flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300">
                  <Zap className="h-3 w-3" /> URGENT
                </span>
              )}
              {listing.is_boosted && (
                <span className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold"
                  style={{ backgroundColor: hexToRgba(sellerCampus?.primary_color || '#3b82f6', 0.2), color: sellerCampus?.accent_color }}>
                  <Tag className="h-3 w-3" /> BOOST
                </span>
              )}
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60">
                {category?.label || listing.category}
              </span>
              {listing.type === 'custom' && (
                <span className="flex items-center gap-1 rounded-md bg-purple-500/20 px-2 py-0.5 text-xs font-bold text-purple-300">
                  <Palette className="h-3 w-3" /> SUR-MESURE
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{listing.title}</h1>
            {listing.condition && (
              <p className="mt-1 text-sm text-white/40">État: {listing.condition}</p>
            )}
          </div>

          {/* Price */}
          <GlassCard className="p-4" strong>
            <div className="text-3xl font-black campus-gradient-text">{formatUSD(listing.price_usd)}</div>
            <div className="text-sm text-white/50">{formatFC(listing.price_usd, rate)}</div>
            {commission && (
              <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-xs text-white/40">
                <div className="flex justify-between">
                  <span>Commission plateforme ({(commission.rate * 100).toFixed(0)}%)</span>
                  <span>{formatUSD(commission.commission)}</span>
                </div>
                <div className="flex justify-between text-emerald-300/70">
                  <span>Vendeur reçoit</span>
                  <span>{formatUSD(commission.payout)}</span>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Production delay for custom */}
          {listing.type === 'custom' && listing.production_delay_days && (
            <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-sm text-purple-200">
              <Clock className="h-4 w-4" />
              Délai de réalisation : {listing.production_delay_days} jours
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-white/70">Description</h3>
            <p className="text-sm leading-relaxed text-white/60 whitespace-pre-wrap">{listing.description}</p>
          </div>

          {/* Hub */}
          {listing.hub && (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <MapPin className="h-4 w-4 campus-text" />
              Rendez-vous : {listing.hub.name}
            </div>
          )}

          {/* Actions */}
          {!isOwner && user && (
            <div className="space-y-2">
              {existingOrderId ? (
                <button
                  onClick={() => navigate(`/orders/${existingOrderId}`)}
                  className="glass flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition hover:border-white/20"
                >
                  <Clock className="h-4 w-4" />
                  Commande déjà en cours
                </button>
              ) : (
                <button
                  onClick={() => setShowBuyModal(true)}
                  className="campus-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition hover:opacity-90"
                >
                  <Handshake className="h-4 w-4" />
                  {listing.type === 'custom' ? 'Commander (sur-mesure)' : 'Acheter maintenant'}
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowOffer((v) => !v)}
                  className="glass flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:border-white/20"
                >
                  <Tag className="h-4 w-4" /> Faire une offre
                </button>
                <button
                  onClick={() => navigate(`/messages?to=${listing.seller_id}&listing=${listing.id}`)}
                  className="glass flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:border-white/20"
                >
                  <MessageSquare className="h-4 w-4" /> Contacter
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/30">
                <Shield className="h-3.5 w-3.5" />
                Paiement sécurisé par code OTP à la livraison
              </div>
            </div>
          )}

          {isOwner && (
            <button
              onClick={() => navigate('/profile')}
              className="glass flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition hover:border-white/20"
            >
              <ShoppingBag className="h-4 w-4" /> Gérer mes annonces
            </button>
          )}

          {!user && (
            <button
              onClick={() => navigate('/signin')}
              className="campus-gradient w-full rounded-xl py-3 text-sm font-bold text-white"
            >
              Connectez-vous pour acheter
            </button>
          )}

          {showOffer && (
            <GlassCard className="p-4 animate-fade-up">
              <h4 className="mb-3 text-sm font-semibold">Faire une offre</h4>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-white/50">Votre offre (USD)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    placeholder={listing.price_usd.toString()}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                  />
                  {offerPrice && parseFloat(offerPrice) > 0 && (
                    <p className="mt-1 text-xs text-white/40">= {formatFC(parseFloat(offerPrice), rate)}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">Message (optionnel)</label>
                  <input
                    type="text"
                    value={offerMsg}
                    onChange={(e) => setOfferMsg(e.target.value)}
                    placeholder="Bonjour, je propose..."
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                  />
                </div>
                <button
                  onClick={handleOffer}
                  disabled={submitting}
                  className="campus-gradient w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submitting ? 'Envoi...' : 'Envoyer l\'offre'}
                </button>
              </div>
            </GlassCard>
          )}

          {/* Report */}
          {user && !isOwner && (
            <button
              onClick={handleReport}
              className="flex items-center gap-1.5 text-xs text-white/30 transition hover:text-red-400"
            >
              <Flag className="h-3.5 w-3.5" /> Signaler cette annonce
            </button>
          )}
        </div>
      </div>

      {/* Seller card */}
      {listing.seller && (
        <GlassCard className="mt-6 p-0">
          <button
            type="button"
            onClick={() => navigate(`/seller/${listing.seller_id}`)}
            className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-white/5"
          >
            {listing.seller.avatar_url ? (
              <img
                src={listing.seller.avatar_url}
                alt={listing.seller.full_name || 'Vendeur'}
                className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold">
                {listing.seller.full_name?.charAt(0)?.toUpperCase() || 'V'}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{listing.seller.full_name}</h3>
                {listing.seller.is_verified_seller && (
                  <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    <BadgeCheck className="h-3 w-3" /> Vérifié
                  </span>
                )}
                {listing.seller.is_certified_creator && (
                  <span className="flex items-center gap-1 rounded-md bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-300">
                    <Award className="h-3 w-3" /> Créateur
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-white/40">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {listing.seller.reputation_score?.toFixed(1) || '0.0'} ({listing.seller.total_reviews} avis)
                </span>
                <span>{listing.seller.total_sales} vente{listing.seller.total_sales > 1 ? 's' : ''}</span>
                <span>Inscrit {timeAgo(listing.seller.created_at)}</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 flex-shrink-0 text-white/30" />
          </button>
        </GlassCard>
      )}

      {/* Reviews */}
      <div className="mt-6">
        <h2 className="mb-4 text-lg font-bold">Avis sur le vendeur</h2>
        {user && !isOwner && (
          <p className="mb-4 text-xs text-white/30">
            Les avis ne peuvent être laissés qu'après une commande complétée, depuis la page de suivi de votre commande.
          </p>
        )}

        {reviews.length === 0 ? (
          <p className="text-sm text-white/40">Aucun avis pour le moment</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <GlassCard key={review.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                      {review.reviewer?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <span className="text-sm font-medium">{review.reviewer?.full_name || 'Anonyme'}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${n <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-white/15'}`}
                      />
                    ))}
                  </div>
                </div>
                {review.comment && <p className="mt-2 text-sm text-white/60">{review.comment}</p>}
                <p className="mt-1.5 text-xs text-white/30">{timeAgo(review.created_at)}</p>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      <BuyModal
        isOpen={showBuyModal}
        listing={listing}
        onClose={() => setShowBuyModal(false)}
        onSuccess={(orderId) => navigate(`/orders/${orderId}`)}
      />
    </div>
  );
}

export { formatDual, Send };
