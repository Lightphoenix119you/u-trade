import { useState } from 'react';
import {
  ShoppingBag, Tag, Clock, Zap, Image as ImageIcon, Star, MapPin,
  MoreVertical, CheckCircle2, PauseCircle, Trash2, Loader2, RefreshCw,
} from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { supabase } from '@/lib/supabase';
import { formatUSD, formatFC, timeAgo, hexToRgba } from '@/lib/format';
import { useCampus } from '@/context/CampusContext';
import { useAuth } from '@/context/AuthContext';
import type { ListingWithRelations } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

interface ListingCardProps {
  listing: ListingWithRelations;
  onClick: () => void;
  /** Appelé après une suppression ou un changement de statut réussi (vendue/pause) — optionnel, la carte se masque déjà localement sans lui */
  onStatusChange?: () => void;
}

export function ListingCard({ listing, onClick, onStatusChange }: ListingCardProps) {
  const { settings, campuses } = useCampus();
  const { user, profile } = useAuth();
  const rate = settings?.usd_to_fc_rate ?? 2800;
  const primaryCurrency = (profile?.preferences?.primary_currency as 'USD' | 'FC') || 'USD';
  const img = listing.image_urls?.[0];
  const category = CATEGORIES.find((c) => c.value === listing.category);
  const campus = campuses.find((c) => c.id === listing.campus_id);

  const isOwner = !!user && user.id === listing.seller_id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  // La colonne `status` de listings n'est pas éditable directement par le
  // vendeur (verrouillage de colonnes côté DB, volontaire) — passe par la
  // RPC seller_update_listing_status(). 'archived' n'existe pas comme statut
  // valide en base ; 'paused' en est l'équivalent (masqué du marché, pas supprimé).
  const handleStatusChange = async (status: 'active' | 'sold' | 'paused') => {
    setMenuOpen(false);
    setActionError(null);
    setBusy(true);
    const { error } = await supabase.rpc('seller_update_listing_status', {
      p_listing_id: listing.id,
      p_status: status,
    });
    setBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    // Remettre en vente ne doit pas faire disparaître la carte — seuls
    // vendue/pause/suppression retirent l'annonce de la vue courante.
    if (status !== 'active') {
      setRemoved(true);
    }
    onStatusChange?.();
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm('Supprimer définitivement cette annonce ? Cette action est irréversible.')) return;
    setActionError(null);
    setBusy(true);
    const { error } = await supabase.from('listings').delete().eq('id', listing.id);
    setBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setRemoved(true);
    onStatusChange?.();
  };

  if (removed) return null;

  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()} className="group relative block w-full text-left">
      <GlassCard className={`p-0 ${listing.status !== 'active' ? 'opacity-75 grayscale-[25%]' : ''}`}>
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-white/5">
          {img ? (
            <img
              src={img}
              alt={listing.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-10 w-10 text-white/15" />
            </div>
          )}

          {/* Bannière de statut — placée avant les badges/déclencheur dans le DOM
              pour qu'ils restent cliquables au-dessus, même quand elle s'affiche */}
          {(listing.status === 'sold' || listing.status === 'paused') && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
              <div
                className={`w-full py-2 text-center backdrop-blur-sm ${
                  listing.status === 'sold' ? 'bg-red-500/80' : 'bg-amber-500/80'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-black uppercase tracking-wider text-white">
                  {listing.status === 'sold' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Vendu
                    </>
                  ) : (
                    <>
                      <PauseCircle className="h-4 w-4" /> En pause
                    </>
                  )}
                </span>
              </div>
            </div>
          )}
          {/* Badges */}
          <div className="absolute left-2 top-2 flex flex-col gap-1.5">
            {listing.is_urgent && (
              <span className="flex items-center gap-1 rounded-md bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                <Zap className="h-2.5 w-2.5" /> URGENT
              </span>
            )}
            {listing.is_boosted && (
              <span className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur"
                style={{ backgroundColor: hexToRgba(campus?.primary_color || '#3b82f6', 0.9) }}>
                <Tag className="h-2.5 w-2.5" /> SPONSORISÉ
              </span>
            )}
            {listing.type === 'custom' && (
              <span className="rounded-md bg-purple-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                SUR-MESURE
              </span>
            )}
          </div>
          {/* Type indicator */}
          <div className="absolute left-2 bottom-2">
            <span className="rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur">
              {category?.label || listing.category}
            </span>
          </div>

          {/* Badge vendeur discret — coin bas-droite (le seul libre : haut-gauche a
              les badges Boost/Urgent, bas-gauche la catégorie, haut-droite le menu ⋮) */}
          {listing.seller && (
            <div className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-full bg-black/50 py-0.5 pl-0.5 pr-2 backdrop-blur">
              {listing.seller.avatar_url ? (
                <img
                  src={listing.seller.avatar_url}
                  alt={listing.seller.full_name || 'Vendeur'}
                  className="h-5 w-5 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold text-white">
                  {listing.seller.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <span className="max-w-[70px] truncate text-[10px] font-medium text-white/90">
                {listing.seller.full_name || 'Vendeur'}
              </span>
            </div>
          )}

          {/* Déclencheur du menu vendeur — le menu lui-même est rendu hors de la carte (voir plus bas), pour échapper aux overflow-hidden imbriqués */}
          {isOwner && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
              disabled={busy}
              className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreVertical className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-3.5">
          <h3 className="line-clamp-1 text-sm font-semibold text-white">{listing.title}</h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-white/40">{listing.description}</p>

          {/* Price */}
          <div className="mt-2.5">
            {primaryCurrency === 'FC' ? (
              <>
                <div className="text-base font-bold campus-gradient-text">{formatFC(listing.price_usd, rate)}</div>
                <div className="text-xs text-white/40">{formatUSD(listing.price_usd)}</div>
              </>
            ) : (
              <>
                <div className="text-base font-bold campus-gradient-text">{formatUSD(listing.price_usd)}</div>
                <div className="text-xs text-white/40">{formatFC(listing.price_usd, rate)}</div>
              </>
            )}
          </div>

          {/* Meta */}
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-white/35">
            <div className="flex items-center gap-1">
              {listing.seller?.is_verified_seller && (
                <span className="flex items-center gap-0.5 text-emerald-400/70">
                  <Star className="h-3 w-3 fill-current" />
                </span>
              )}
              <span className="truncate max-w-[80px]">{listing.seller?.full_name || 'Vendeur'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(listing.created_at)}
            </div>
          </div>

          {campus && (
            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-white/30">
              <MapPin className="h-3 w-3" />
              {campus.slug.toUpperCase()}
            </div>
          )}

          {actionError && (
            <p className="mt-2 text-[11px] text-red-400">{actionError}</p>
          )}
        </div>
      </GlassCard>

      {isOwner && menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 top-10 z-50 w-52 rounded-xl border border-white/10 bg-slate-900 p-1.5 shadow-2xl backdrop-blur-md"
          >
            {listing.status === 'active' && (
              <>
                <button
                  type="button"
                  onClick={() => handleStatusChange('sold')}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Marquer comme vendue
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange('paused')}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10"
                >
                  <PauseCircle className="h-3.5 w-3.5" /> Mettre en pause (archiver)
                </button>
              </>
            )}
            {listing.status === 'paused' && (
              <button
                type="button"
                onClick={() => handleStatusChange('active')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Remettre en vente
              </button>
            )}
            {listing.status === 'sold' && (
              <button
                type="button"
                onClick={() => handleStatusChange('active')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Marquer comme disponible
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="glass-card overflow-hidden p-0">
      <div className="skeleton aspect-[4/3] rounded-t-xl" />
      <div className="p-3.5">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton mt-2 h-3 w-1/2 rounded" />
        <div className="skeleton mt-3 h-5 w-1/3 rounded" />
        <div className="skeleton mt-3 h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}

export { ShoppingBag };
