import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Award, Star, MessageSquare, Package, Edit3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { GlassCard } from '@/components/GlassCard';
import { ListingCard } from '@/components/ListingCard';
import { timeAgo } from '@/lib/format';
import type { Profile, ListingWithRelations, ListingReview } from '@/lib/types';

interface SellerProfilePageProps {
  sellerId: string;
  navigate: (path: string) => void;
}

export function SellerProfilePage({ sellerId, navigate }: SellerProfilePageProps) {
  const { user } = useAuth();
  const [seller, setSeller] = useState<Profile | null>(null);
  const [listings, setListings] = useState<ListingWithRelations[]>([]);
  const [reviews, setReviews] = useState<(ListingReview & { reviewer?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: sellerData } = await supabase.from('profiles').select('*').eq('id', sellerId).maybeSingle();

    if (!sellerData) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setSeller(sellerData as Profile);

    const { data: listingsData } = await supabase
      .from('listings')
      .select(`*, seller:profiles!listings_seller_id_fkey(*), shop:shops(*), campus:campuses(*), hub:campus_hubs(*)`)
      .eq('seller_id', sellerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    setListings((listingsData as ListingWithRelations[]) || []);

    // Avis reçus par ce vendeur — rattachés à seller_id, indépendamment de
    // quelle annonce précise ils concernent.
    const { data: reviewsData } = await supabase
      .from('listing_reviews')
      .select('*, reviewer:profiles!listing_reviews_reviewer_id_fkey(*)')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    setReviews((reviewsData as (ListingReview & { reviewer?: Profile })[]) || []);
    setLoading(false);
  }, [sellerId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="skeleton h-10 w-10 rounded-full" />
      </div>
    );
  }

  if (notFound || !seller) {
    return (
      <div className="relative z-10 mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="text-xl font-semibold">Vendeur introuvable</h2>
        <button onClick={() => navigate('/market')} className="campus-gradient mt-4 rounded-lg px-6 py-2.5 text-sm font-semibold text-white">
          Retour au marché
        </button>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <button onClick={() => navigate('/market')} className="mb-4 flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          {seller.avatar_url ? (
            <img src={seller.avatar_url} alt={seller.full_name} className="h-20 w-20 flex-shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl font-bold">
              {seller.full_name?.charAt(0)?.toUpperCase() || 'V'}
            </div>
          )}

          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-xl font-bold">{seller.full_name}</h1>
              {seller.is_verified_seller && (
                <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                  <BadgeCheck className="h-3 w-3" /> Vendeur Vérifié
                </span>
              )}
              {seller.is_certified_creator && (
                <span className="flex items-center gap-1 rounded-md bg-purple-500/20 px-2 py-0.5 text-xs font-bold text-purple-300">
                  <Award className="h-3 w-3" /> Créateur Certifié
                </span>
              )}
            </div>

            {seller.bio && <p className="mt-2 text-sm text-white/50">{seller.bio}</p>}

            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-3 text-xs text-white/40 sm:justify-start">
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {seller.reputation_score?.toFixed(1) || '0.0'} ({seller.total_reviews} avis)
              </span>
              <span>{seller.total_sales} vente{seller.total_sales > 1 ? 's' : ''}</span>
              <span>Membre depuis {timeAgo(seller.created_at)}</span>
            </div>
          </div>

          <button
            onClick={() => navigate(user?.id === seller.id ? '/profile' : `/messages?to=${seller.id}`)}
            className="campus-gradient flex flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
          >
            {user?.id === seller.id ? (
              <>
                <Edit3 className="h-4 w-4" /> Éditer mon profil
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4" /> Contacter
              </>
            )}
          </button>
        </div>
      </GlassCard>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Annonces actives</h2>
        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="mb-3 h-10 w-10 text-white/15" />
            <p className="text-sm text-white/40">Aucune annonce active pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onClick={() => navigate(`/listing/${listing.id}`)}
                onStatusChange={load}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Avis sur le vendeur</h2>
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
                      <Star key={n} className={`h-3.5 w-3.5 ${n <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-white/15'}`} />
                    ))}
                  </div>
                </div>
                {review.comment && <p className="mt-2 text-sm text-white/60">{review.comment}</p>}
                <p className="mt-1.5 text-[11px] text-white/30">{timeAgo(review.created_at)}</p>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
