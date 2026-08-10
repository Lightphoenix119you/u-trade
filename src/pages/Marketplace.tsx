import { useEffect, useState, useCallback } from 'react';
import { Search, SlidersHorizontal, Package, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCampus } from '@/context/CampusContext';
import { useAuth } from '@/context/AuthContext';
import { useCreateListingModal } from '@/context/CreateListingModalContext';
import { GlassCard } from '@/components/GlassCard';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { CATEGORIES, CONDITIONS } from '@/lib/types';
import { ALL_CAMPUSES_ID } from '@/lib/format';
import type { ListingWithRelations } from '@/lib/types';

interface MarketplaceProps {
  navigate: (path: string) => void;
}

export function Marketplace({ navigate }: MarketplaceProps) {
  const { selectedCampusId } = useCampus();
  const { profile } = useAuth();
  const { openCreateListingModal } = useCreateListingModal();
  const [listings, setListings] = useState<ListingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categoryPrefApplied, setCategoryPrefApplied] = useState(false);

  // Applique la catégorie préférée de l'utilisateur une seule fois, sans
  // écraser un filtre déjà choisi manuellement pendant la session.
  useEffect(() => {
    if (!categoryPrefApplied && profile) {
      const preferred = profile.preferences?.preferred_category as string | undefined;
      if (preferred && !category) setCategory(preferred);
      setCategoryPrefApplied(true);
    }
  }, [profile, categoryPrefApplied, category]);

  const loadListings = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('listings')
      .select(`
        *,
        seller:profiles!listings_seller_id_fkey(*),
        shop:shops(*),
        campus:campuses(*),
        hub:campus_hubs(*)
      `)
      .eq('status', 'active')
      .order('is_boosted', { ascending: false })
      .order('daily_budget_usd', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (selectedCampusId !== ALL_CAMPUSES_ID) {
      query = query.eq('campus_id', selectedCampusId);
    }
    if (search.trim()) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (category) query = query.eq('category', category);
    if (type) query = query.eq('type', type);
    if (minPrice.trim()) query = query.gte('price_usd', Number(minPrice));
    if (maxPrice.trim()) query = query.lte('price_usd', Number(maxPrice));

    const { data, error } = await query.limit(48);
    if (error) {
      console.error('Listings error:', error.message);
      setListings([]);
    } else {
      setListings((data as ListingWithRelations[]) || []);
    }
    setLoading(false);
  }, [selectedCampusId, search, category, type, minPrice, maxPrice]);

  useEffect(() => {
    const debounce = setTimeout(loadListings, 200);
    return () => clearTimeout(debounce);
  }, [loadListings]);

  const activeFilters = (category ? 1 : 0) + (type ? 1 : 0) + (minPrice.trim() || maxPrice.trim() ? 1 : 0);

  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Search bar */}
      <div className="mb-5 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un objet, un créateur..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-white/30"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`glass flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            activeFilters > 0 ? 'border-white/30 text-white' : 'text-white/60'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filtres</span>
          {activeFilters > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <GlassCard className="mb-5 p-4 animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Filtres</h3>
            <button
              onClick={() => { setCategory(''); setType(''); setMinPrice(''); setMaxPrice(''); }}
              className="text-xs text-white/40 hover:text-white"
            >
              Réinitialiser
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">Type</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setType('')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${!type ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'}`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setType('secondhand')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${type === 'secondhand' ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'}`}
                >
                  Seconde main
                </button>
                <button
                  onClick={() => setType('custom')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${type === 'custom' ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'}`}
                >
                  Sur-mesure
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">Catégorie</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategory('')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${!category ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'}`}
                >
                  Toutes
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(category === c.value ? '' : c.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${category === c.value ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-white/50">Prix (USD)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                />
                <span className="text-white/30">—</span>
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                />
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Results count */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-white/40">
          {loading ? 'Chargement...' : `${listings.length} annonce${listings.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
        </div>
      ) : listings.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="mb-3 h-12 w-12 text-white/20" />
          <h3 className="text-lg font-semibold">Aucune annonce trouvée</h3>
          <p className="mt-1 text-sm text-white/40">
            Essayez de changer de campus ou de modifier vos filtres
          </p>
          <button
            onClick={openCreateListingModal}
            className="campus-gradient mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          >
            Publier une annonce
          </button>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onClick={() => navigate(`/listing/${listing.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { X, CONDITIONS };
