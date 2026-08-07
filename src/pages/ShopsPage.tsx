import { useEffect, useState, useCallback } from 'react';
import { Store, ArrowRight, Palette, Clock, Image as ImageIcon, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { GlassCard } from '@/components/GlassCard';
import { getCampusIcon } from '@/components/CampusIcons';
import { ALL_CAMPUSES_ID } from '@/lib/format';
import type { Shop, Listing } from '@/lib/types';

interface ShopsPageProps {
  navigate: (path: string) => void;
}

export function ShopsPage({ navigate }: ShopsPageProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'campus_admin' || profile?.role === 'super_admin';
  const { campuses, selectedCampusId } = useCampus();
  const [shops, setShops] = useState<(Shop & { listings: Listing[] })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const nowIso = new Date().toISOString();

    let q = supabase
      .from('shops')
      .select('*, listings(*)') // LEFT JOIN (pas !inner) — une boutique sans annonce doit quand même s'afficher
      .eq('approval_status', 'approved')
      .eq('subscription_status', 'active')
      .eq('is_storefront_visible', true)
      .or(`rent_expires_at.is.null,rent_expires_at.gt.${nowIso}`)
      .order('created_at', { ascending: false });

    if (selectedCampusId !== ALL_CAMPUSES_ID) {
      // campus_id est NOT NULL en base actuellement — cette clause "is.null"
      // est défensive et sans effet réel tant que le schéma reste ainsi.
      q = q.or(`campus_id.eq.${selectedCampusId},campus_id.is.null`);
    }

    const { data: shopsData, error } = await q.limit(24);
    console.log('[ShopsPage] shops fetch:', shopsData, error);

    if (error) {
      setShops([]);
    } else {
      setShops((shopsData as (Shop & { listings: Listing[] })[]) || []);
    }
    setLoading(false);
  }, [selectedCampusId]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) {
    return (
      <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 text-center sm:px-6">
        <div className="glass-strong flex flex-col items-center rounded-2xl border border-white/10 p-10">
          <div className="mb-4 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/60">
            <Sparkles className="h-3.5 w-3.5 campus-text" /> Arrive très bientôt
          </div>
          <div className="campus-gradient mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
            <Store className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold">Boutiques créatives</h1>
          <p className="mt-2 max-w-sm text-sm text-white/50">
            Cette fonctionnalité est en cours de finalisation et sera bientôt disponible pour tout le monde. Reviens vite !
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Boutiques créatives</h1>
          <p className="mt-1 text-sm text-white/40">Découvrez les créateurs et artistes de votre campus</p>
        </div>
        <button
          onClick={() => navigate('/my-shop')}
          className="campus-gradient flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white"
        >
          <Store className="h-4 w-4" /> Ma boutique
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      ) : shops.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
          <Store className="mb-3 h-12 w-12 text-white/15" />
          <h3 className="text-lg font-semibold">Aucune boutique pour le moment</h3>
          <p className="mt-1 text-sm text-white/40">Soyez le premier à ouvrir une boutique créative</p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => {
            const campus = campuses.find((c) => c.id === shop.campus_id);
            const CampusIcon = campus ? getCampusIcon(campus.icon_name) : null;
            const sampleImg = shop.listings?.find((l) => l.image_urls?.[0])?.image_urls?.[0];

            return (
              <button key={shop.id} onClick={() => navigate(`/market?shop=${shop.id}`)} className="text-left">
                <GlassCard className="overflow-hidden p-0">
                  {/* Banner */}
                  <div className="relative h-24 overflow-hidden bg-white/5">
                    {shop.banner_url ? (
                      <img src={shop.banner_url} alt="" className="h-full w-full object-cover" />
                    ) : sampleImg ? (
                      <img src={sampleImg} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-white/10" />
                      </div>
                    )}
                    {shop.is_custom_shop && (
                      <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-purple-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                        <Palette className="h-2.5 w-2.5" /> CRÉATEUR
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg font-bold">
                        {shop.logo_url ? (
                          <img src={shop.logo_url} alt="" className="h-full w-full rounded-xl object-cover" />
                        ) : (
                          shop.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="truncate font-semibold text-sm">{shop.name}</h3>
                        {campus && CampusIcon && (
                          <div className="flex items-center gap-1 text-xs text-white/40">
                            <CampusIcon className="h-3 w-3" style={{ color: campus.accent_color }} />
                            {campus.slug.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-white/30" />
                    </div>

                    {shop.description && <p className="mt-2 line-clamp-2 text-xs text-white/50">{shop.description}</p>}

                    <div className="mt-3 flex items-center gap-3 text-xs text-white/40">
                      <span className="flex items-center gap-1"><Store className="h-3 w-3" /> {shop.listings?.length || 0} articles</span>
                      {shop.production_delay_days && (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {shop.production_delay_days}</span>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
