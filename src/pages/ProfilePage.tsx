import { useEffect, useState, useCallback } from 'react';
import {
  Edit2, Save, X, Package, ShoppingBag,
  Star, BadgeCheck, Award, TrendingUp, Store, KeyRound, Lock, Eye, EyeOff,
  ArrowRight, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCreateListingModal } from '@/context/CreateListingModalContext';
import { useCampus } from '@/context/CampusContext';
import { GlassCard } from '@/components/GlassCard';
import { ListingCard } from '@/components/ListingCard';
import { ImageUploader } from '@/components/ImageUploader';
import { getCampusIcon } from '@/components/CampusIcons';
import { profileUpdateSchema } from '@/lib/validation';
import { timeAgo } from '@/lib/format';
import type { Listing, Order, ListingReview, Profile } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

interface ProfilePageProps {
  navigate: (path: string) => void;
}

export function ProfilePage({ navigate }: ProfilePageProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { openCreateListingModal } = useCreateListingModal();
  const { campuses } = useCampus();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<'listings' | 'purchases' | 'sales' | 'reviews'>('listings');
  const [listings, setListings] = useState<Listing[]>([]);
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<(ListingReview & { reviewer?: Profile })[]>([]);
  const [form, setForm] = useState({ full_name: '', phone: '', bio: '', campus_id: '', preferred_category: '', primary_currency: 'USD' as 'USD' | 'FC' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const activeOtpOrders = purchases.filter((o) => o.status === 'paid' || o.status === 'in_delivery');
  const isStaff = profile?.role === 'campus_admin' || profile?.role === 'super_admin';

    const handleAvatarUploaded = async (url: string) => {
    if (!user) return;
    setAvatarError(null);
    
    // 1. Mise à jour de la table Supabase
    const { error: err } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', user.id);

    if (err) { 
      setAvatarError(err.message); 
      return; 
    }

    // 2. Attendre le rafraîchissement global du profil
    await refreshProfile();
  };


  // La edge function escrow est définitivement abandonnée (CLI Supabase
  // indisponible sous Termux) — plus la peine de tenter un fetch voué à
  // l'échec avant de lire directement. Lecture strictement filtrée sur
  // buyer_id = auth.uid() (RLS + ce filtre explicite le garantissent tous
  // les deux) : jamais accessible au vendeur par ce biais.
  const revealOtp = async (orderId: string) => {
    if (!user) { setCodeError('Vous devez être connecté.'); return; }
    setCodeError(null);
    setRevealing(orderId);

    const { data, error } = await supabase
      .from('orders')
      .select('escrow_code, status')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .maybeSingle();

    setRevealing(null);

    if (error || !data?.escrow_code || !['paid', 'in_delivery'].includes(data.status)) {
      setCodeError('Code indisponible ou expiré pour cette commande.');
      return;
    }
    setRevealedCodes((prev) => ({ ...prev, [orderId]: data.escrow_code as string }));
  };

  const handleCancelOrder = async (orderId: string) => {
    const { error } = await supabase.rpc('buyer_cancel_order', { p_order_id: orderId });
    if (!error) loadData();
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('Retirer définitivement cette commande de votre historique ? Cette action est irréversible.')) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (!error) loadData();
  };

  const loadData = useCallback(async () => {
    if (!user) return;
    const { data: myListings } = await supabase
      .from('listings')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });
    setListings((myListings as Listing[]) || []);

    const { data: myPurchases } = await supabase
      .from('orders')
      .select('*, listing:listings(*)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });
    setPurchases((myPurchases as Order[]) || []);

    const { data: mySales } = await supabase
      .from('orders')
      // Colonnes explicites — jamais escrow_code/escrow_code_hash ici : ce
      // sont les propres ventes du vendeur, il ne doit pas voir le code OTP
      // de l'acheteur avant que celui-ci ne le lui donne en main propre.
      .select(`
        id, buyer_id, seller_id, listing_id, shop_id, campus_id, hub_id,
        price_usd, commission_rate, commission_usd, seller_payout_usd, status,
        escrow_revealed_at, production_notes, reference_image_urls, is_custom,
        paid_at, delivered_at, completed_at, disputed_at, dispute_reason,
        created_at, updated_at, listing:listings(*)
      `)
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });
    setSales((mySales as unknown as Order[]) || []);

    // Avis reçus en tant que vendeur.
    const { data: myReviews } = await supabase
      .from('listing_reviews')
      .select('*, reviewer:profiles!listing_reviews_reviewer_id_fkey(*)')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });
    setReviews((myReviews as (ListingReview & { reviewer?: Profile })[]) || []);
  }, [user]);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        campus_id: profile.campus_id || '',
        preferred_category: (profile.preferences?.preferred_category as string) || '',
        primary_currency: (profile.preferences?.primary_currency as 'USD' | 'FC') || 'USD',
      });
    }
    loadData();
  }, [profile, loadData]);

  // Rafraîchit le profil depuis la base à l'arrivée sur la page — sans ça,
  // reputation_score/total_reviews restent figés sur ce qu'ils valaient au
  // chargement de la session (mis en cache par AuthContext), même si des
  // avis sont arrivés depuis. SellerProfilePage.tsx n'a pas ce problème
  // car il refait toujours une requête fraîche, jamais depuis un cache.
  // Effet séparé à dépendances vides : refreshProfile() crée un nouvel
  // objet profile à chaque appel, l'inclure dans l'effet ci-dessus
  // boucherait indéfiniment.
  useEffect(() => {
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user || !profile) {
    return (
      <div className="relative z-10 mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="text-xl font-semibold">Connexion requise</h2>
        <button onClick={() => navigate('/signin')} className="campus-gradient mt-4 rounded-lg px-6 py-2.5 text-sm font-semibold text-white">
          Se connecter
        </button>
      </div>
    );
  }

  const handleSave = async () => {
    setError(null);
    const parsed = profileUpdateSchema.safeParse({
      full_name: form.full_name,
      phone: form.phone || undefined,
      bio: form.bio || undefined,
      campus_id: form.campus_id || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Données invalides');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase
      .from('profiles')
      .update({
        full_name: parsed.data.full_name || null,
        phone: parsed.data.phone || null,
        bio: parsed.data.bio || null,
        campus_id: parsed.data.campus_id || null,
        preferences: {
          ...profile.preferences,
          preferred_category: form.preferred_category || null,
          primary_currency: form.primary_currency,
        },
      })
      .eq('id', user.id);
    setSaving(false);
    if (err) { setError('Erreur: ' + err.message); return; }
    setEditing(false);
    refreshProfile();
  };

  const campus = campuses.find((c) => c.id === profile.campus_id);
  const CampusIcon = campus ? getCampusIcon(campus.icon_name) : null;

  return (
    <div className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Profile header */}
      <GlassCard className="mb-6 p-6" strong>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-1">
            <ImageUploader
              bucket="avatars"
              pathPrefix={user.id}
              currentUrl={profile.avatar_url}
              onUploaded={handleAvatarUploaded}
              fallbackLabel={profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
              sizeClass="h-20 w-20 text-3xl"
            />
            {avatarError && <p className="max-w-[90px] text-center text-[10px] text-red-400">{avatarError}</p>}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{profile.full_name}</h1>
              {profile.is_verified_seller && (
                <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                  <BadgeCheck className="h-3 w-3" /> Vendeur Vérifié
                </span>
              )}
              {profile.is_certified_creator && (
                <span className="flex items-center gap-1 rounded-md bg-purple-500/20 px-2 py-0.5 text-xs font-bold text-purple-300">
                  <Award className="h-3 w-3" /> Créateur Certifié
                </span>
              )}
              {profile.role === 'super_admin' && (
                <span className="flex items-center gap-1 rounded-md bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-300">
                  <ShieldCheck className="h-3 w-3" /> Super Admin
                </span>
              )}
              {profile.role === 'campus_admin' && (
                <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                  <ShieldCheck className="h-3 w-3" /> Admin Campus
                </span>
              )}
            </div>
            {campus && CampusIcon && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-white/40">
                <CampusIcon className="h-4 w-4" style={{ color: campus.accent_color }} />
                {campus.name}
              </div>
            )}
            {profile.bio && <p className="mt-2 text-sm text-white/60">{profile.bio}</p>}
            <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {profile.reputation_score?.toFixed(1) || '0.0'}
              </span>
              <span>{profile.total_sales} vente{profile.total_sales > 1 ? 's' : ''}</span>
              <span>{profile.total_reviews} avis</span>
              <span>Inscrit {timeAgo(profile.created_at)}</span>
            </div>
          </div>
          <button
            onClick={() => setEditing((v) => !v)}
            className="glass flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          >
            {editing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            {editing ? 'Annuler' : 'Modifier'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <span className="text-xs text-white/40">Gérez vos annonces sur mesure et votre vitrine créateur.</span>
          <button
            onClick={() => navigate('/my-shop')}
            className="glass flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <Store className="h-4 w-4" /> Ma boutique
          </button>
        </div>

        {isStaff && (
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-xs text-white/40">
              {profile.role === 'super_admin' ? 'Accès total à la plateforme.' : 'Accès de modération pour votre campus.'}
            </span>
            <button
              onClick={() => navigate('/admin')}
              className="campus-gradient flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
            >
              Panneau Admin <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-white/50">Nom complet</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">Téléphone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0812345678"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={2}
                placeholder="Parlez de vous..."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">Campus</label>
              <select
                value={form.campus_id}
                onChange={(e) => setForm({ ...form, campus_id: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              >
                <option value="" className="bg-gray-900">Sélectionnez</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">{c.name}</option>
                ))}
              </select>
            </div>

            <div className="border-t border-white/10 pt-3">
              <p className="mb-2 text-xs font-semibold text-white/60">Préférences</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-white/50">Catégorie par défaut sur le Marché</label>
                  <select
                    value={form.preferred_category}
                    onChange={(e) => setForm({ ...form, preferred_category: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                  >
                    <option value="" className="bg-gray-900">Aucune (toutes)</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value} className="bg-gray-900">{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">Devise principale affichée</label>
                  <select
                    value={form.primary_currency}
                    onChange={(e) => setForm({ ...form, primary_currency: e.target.value as 'USD' | 'FC' })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                  >
                    <option value="USD" className="bg-gray-900">Dollar (USD)</option>
                    <option value="FC" className="bg-gray-900">Franc congolais (FC)</option>
                  </select>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="campus-gradient flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        )}
      </GlassCard>

      {/* Tabs */}
      <div className="mb-4 flex gap-1">
        <button
          onClick={() => setTab('listings')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'listings' ? 'bg-white/10 text-white' : 'text-white/50'}`}
        >
          <Package className="h-4 w-4" /> Mes annonces
        </button>
        <button
          onClick={() => setTab('purchases')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'purchases' ? 'bg-white/10 text-white' : 'text-white/50'}`}
        >
          <ShoppingBag className="h-4 w-4" /> Achats
        </button>
        <button
          onClick={() => setTab('sales')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'sales' ? 'bg-white/10 text-white' : 'text-white/50'}`}
        >
          <TrendingUp className="h-4 w-4" /> Ventes
        </button>
        <button
          onClick={() => setTab('reviews')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'reviews' ? 'bg-white/10 text-white' : 'text-white/50'}`}
        >
          <Star className="h-4 w-4" /> Avis
        </button>
      </div>

      {/* Content */}
      {tab === 'listings' && (
        listings.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Store className="mx-auto mb-3 h-10 w-10 text-white/15" />
            <p className="text-sm text-white/40">Vous n'avez pas encore d'annonces</p>
            <button onClick={openCreateListingModal} className="campus-gradient mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white">
              Publier une annonce
            </button>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l as unknown as import('@/lib/types').ListingWithRelations} onClick={() => navigate(`/listing/${l.id}`)} />
            ))}
          </div>
        )
      )}

      {tab === 'reviews' && (
        reviews.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Star className="mx-auto mb-3 h-10 w-10 text-white/15" />
            <p className="text-sm text-white/40">Aucun avis reçu pour le moment</p>
          </GlassCard>
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
                      <Star key={n} className={`h-3.5 w-3.5 ${n <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-white/15'}`} />
                    ))}
                  </div>
                </div>
                {review.comment && <p className="mt-2 text-sm text-white/60">{review.comment}</p>}
                <p className="mt-1.5 text-[11px] text-white/30">{timeAgo(review.created_at)}</p>
              </GlassCard>
            ))}
          </div>
        )
      )}

      {/* Active OTP escrow codes — buyer badge */}
      {tab === 'purchases' && activeOtpOrders.length > 0 && (
        <div className="mb-6 space-y-3">
          {activeOtpOrders.map((order) => {
            const listing = order.listing as Listing | undefined;
            const code = revealedCodes[order.id];
            return (
              <GlassCard key={order.id} className="overflow-hidden p-0" strong>
                <div className="flex items-center gap-2 border-b border-white/10 bg-amber-500/10 px-4 py-2.5">
                  <Lock className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                    Code de livraison sécurisé
                  </span>
                </div>
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{listing?.title || 'Annonce'}</div>
                    <div className="mt-0.5 text-xs text-white/40">
                      Montrez ce code au vendeur au rendez-vous pour qu'il libère votre commande.
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-center gap-2">
                    {code ? (
                      <div className="flex gap-1.5">
                        {code.split('').map((digit, i) => (
                          <div
                            key={i}
                            className="flex h-14 w-11 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/10 font-mono text-3xl font-black text-amber-300 shadow-lg shadow-amber-500/10"
                          >
                            {digit}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => revealOtp(order.id)}
                        disabled={revealing === order.id}
                        className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-50"
                      >
                        {revealing === order.id ? (
                          <KeyRound className="h-4 w-4 animate-pulse" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        {revealing === order.id ? 'Récupération...' : 'Révéler le code'}
                      </button>
                    )}
                  </div>
                </div>
                {codeError && revealing === null && (
                  <p className="px-4 pb-3 text-xs text-red-400">{codeError}</p>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {(tab === 'purchases' || tab === 'sales') && (
        <div className="space-y-3">
          {(tab === 'purchases' ? purchases : sales).length === 0 ? (
            <GlassCard className="p-8 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-white/15" />
              <p className="text-sm text-white/40">Aucune {tab === 'purchases' ? 'achat' : 'vente'} pour le moment</p>
            </GlassCard>
          ) : (
            (tab === 'purchases' ? purchases : sales).map((order) => {
              const listing = order.listing as Listing | undefined;
              const canCancel = tab === 'purchases' && order.status === 'pending_payment';
              const canDelete = tab === 'purchases' && order.status === 'cancelled';
              return (
                <div
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/orders/${order.id}`)}
                  className="block w-full cursor-pointer text-left"
                >
                  <GlassCard className="flex items-center gap-3 p-3">
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-white/5">
                      {listing?.image_urls?.[0] && <img src={listing.image_urls[0]} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium">{listing?.title || 'Annonce'}</div>
                      <div className="text-xs text-white/40">{timeAgo(order.created_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold campus-text">${order.price_usd}</div>
                      <div className={`text-[10px] font-bold uppercase ${order.status === 'completed' ? 'text-emerald-400' : order.status === 'disputed' ? 'text-red-400' : 'text-white/40'}`}>
                        {order.status}
                      </div>
                    </div>
                    {(canCancel || canDelete) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canCancel) handleCancelOrder(order.id);
                          else handleDeleteOrder(order.id);
                        }}
                        title={canCancel ? 'Annuler la commande' : "Supprimer de l'historique"}
                        className="flex-shrink-0 rounded-lg p-1.5 text-white/30 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </GlassCard>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
