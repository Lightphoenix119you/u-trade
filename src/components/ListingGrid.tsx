import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, PackageSearch } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCampus } from '@/context/CampusContext';
import { ListingCard } from '@/components/ListingCard';
import { CATEGORIES } from '@/lib/types';
import { ALL_CAMPUSES_ID } from '@/lib/format';
import type { ListingWithRelations } from '@/lib/types';

interface ListingGridProps {
  /** Appelé avec l'id de l'annonce cliquée — laisse le composant appelant décider de la navigation */
  onSelectListing: (listingId: string) => void;
  limit?: number;
  /** Affiche les pastilles de filtre par catégorie (défaut: true) */
  showCategoryFilter?: boolean;
  title?: string;
  /** Élément affiché à droite du titre quand showCategoryFilter est false (ex: lien "Voir tout") */
  headerAction?: ReactNode;
}

export function ListingGrid({
  onSelectListing,
  limit = 12,
  showCategoryFilter = true,
  title,
  headerAction,
}: ListingGridProps) {
  const { selectedCampusId, selectedCampus } = useCampus();
  const [listings, setListings] = useState<ListingWithRelations[]>([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('listings')
      .select(`*, seller:profiles!listings_seller_id_fkey(*), shop:shops(*), campus:campuses(*), hub:campus_hubs(*)`)
      .eq('status', 'active')
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (selectedCampusId !== ALL_CAMPUSES_ID) {
      query = query.eq('campus_id', selectedCampusId);
    }
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setListings([]);
    } else {
      setListings((data as ListingWithRelations[]) || []);
    }
    setLoading(false);
  }, [selectedCampusId, category, limit]);

  useEffect(() => {
    load();
  }, [load]);

  // Temps réel : réagit à tout INSERT/UPDATE/DELETE sur `listings` en
  // relançant le fetch (plus simple et plus sûr qu'un patch manuel du
  // tableau local, puisqu'un nouvel enregistrement brut n'a pas les relations
  // seller/shop/campus/hub déjà jointes).
  //
  // ⚠️ Nécessite que la table soit ajoutée à la publication Realtime :
  //   alter publication supabase_realtime add table public.listings;
  // (à exécuter une fois dans le SQL Editor Supabase, sinon cet abonnement
  // ne reçoit simplement aucun événement — pas d'erreur visible.)
  useEffect(() => {
    const channel = supabase
      .channel('listing-grid-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <div>
      {(title || showCategoryFilter || headerAction) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-xl font-bold">{title}</h2>}

          {showCategoryFilter ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCategory('')}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  category === '' ? 'bg-white/15 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                }`}
              >
                Tout
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    category === c.value ? 'bg-white/15 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : (
            headerAction
          )}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-400">{error}</p>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <PackageSearch className="mb-3 h-12 w-12 text-white/20" />
          <h3 className="text-sm font-semibold text-white/60">Aucune annonce trouvée</h3>
          <p className="mt-1 text-xs text-white/30">
            {selectedCampus ? `Aucun résultat à ${selectedCampus.name} pour ce filtre.` : 'Essayez un autre filtre.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} onClick={() => onSelectListing(listing.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
