import { useEffect, useState, useCallback } from 'react';
import { ArrowRight, ShoppingBag, Store, Shield, Zap, Sparkles, TrendingUp, MapPin, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { useCreateListingModal } from '@/context/CreateListingModalContext';
import { GlassCard } from '@/components/GlassCard';
import { ListingGrid } from '@/components/ListingGrid';
import { getCampusIcon } from '@/components/CampusIcons';
import { IS_APP_RELEASED, APP_DOWNLOAD_URL_ANDROID, APP_DOWNLOAD_URL_IOS } from '@/lib/config';

interface HomeProps {
  navigate: (path: string) => void;
}

export function Home({ navigate }: HomeProps) {
  const { user, loading } = useAuth();
  const { campuses, selectedCampus } = useCampus();
  const { openCreateListingModal } = useCreateListingModal();
  const [stats, setStats] = useState({ listings: 0, shops: 0 });

  const loadStats = useCallback(async () => {
    const { count } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    setStats((s) => ({ ...s, listings: count || 0 }));
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  return (
    <div className="relative z-10">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-8 sm:px-6 sm:pt-20">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-white/60">
            <Sparkles className="h-3.5 w-3.5 campus-text" />
            Le marketplace étudiant sécurisé
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            Achetez, vendez, créez
            <br />
            <span className="campus-gradient-text">au sein de votre campus</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/50 sm:text-lg">
            U. Trade connecte les étudiants pour des échanges sûrs : objets seconde main, boutiques créatives,
            paiement sécurisé par code OTP à la livraison.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => navigate('/market')}
              className="campus-gradient flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 sm:w-auto"
            >
              <ShoppingBag className="h-4 w-4" />
              Explorer le marché
            </button>
            <button
              onClick={openCreateListingModal}
              className="glass flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:border-white/20 sm:w-auto"
            >
              <Store className="h-4 w-4" />
              Vendre un objet
            </button>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-10 flex max-w-md gap-6">
            <div className="flex-1">
              <div className="text-2xl font-bold campus-text">{stats.listings}</div>
              <div className="text-xs text-white/40">Annonces actives</div>
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold campus-text">{campuses.length}</div>
              <div className="text-xs text-white/40">Campus connectés</div>
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold campus-text">OTP</div>
              <div className="text-xs text-white/40">Livraison sécurisée</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <GlassCard className="p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <h3 className="font-semibold">Paiement Sécurisé</h3>
            <p className="mt-1 text-sm text-white/40">
              L'argent est bloqué jusqu'à la livraison. Le vendeur reçoit un code OTP à 4 chiffres de l'acheteur en main propre.
            </p>
          </GlassCard>
          <GlassCard className="p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
              <Zap className="h-5 w-5 text-amber-400" />
            </div>
            <h3 className="font-semibold">Boutiques Créatives</h3>
            <p className="mt-1 text-sm text-white/40">
              Portraitistes, artistes, créateurs : vendez sur commande avec délai de réalisation et consignes personnalisées.
            </p>
          </GlassCard>
          <GlassCard className="p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15">
              <TrendingUp className="h-5 w-5 text-sky-400" />
            </div>
            <h3 className="font-semibold">Double Affichage</h3>
            <p className="mt-1 text-sm text-white/40">
              Tous les prix en USD et Francs Congolais (FC). Taux de conversion ajustable par la plateforme.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* Campus showcase */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Campus connectés</h2>
          <button onClick={() => navigate('/market')} className="text-sm campus-text hover:underline">
            Voir tout
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {campuses.map((campus) => {
            const Icon = getCampusIcon(campus.icon_name);
            return (
              <button key={campus.id} onClick={() => navigate('/market')} className="text-left">
                <GlassCard className="p-5" >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl"
                      style={{ backgroundColor: `${campus.primary_color}25`, color: campus.accent_color }}
                    >
                      {campus.logo_url ? (
                        <img src={campus.logo_url} alt={campus.name} className="h-full w-full object-cover rounded-xl" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate font-semibold text-sm">{campus.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-white/40">
                        <MapPin className="h-3 w-3" /> {campus.city}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-white/30" />
                  </div>
                </GlassCard>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured listings */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <ListingGrid
          title={selectedCampus ? `À ${selectedCampus.name}` : 'Annonces en vedette'}
          limit={8}
          showCategoryFilter={false}
          headerAction={
            <button onClick={() => navigate('/market')} className="text-sm campus-text hover:underline">
              Voir tout
            </button>
          }
          onSelectListing={(id) => navigate(`/listing/${id}`)}
        />
      </section>

      {/* Footer info */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {loading ? (
          // Évite le flash "Créer un compte" pendant la brève fenêtre où la
          // session est encore en cours de restauration (user pas encore
          // peuplé même pour quelqu'un de déjà connecté).
          <div className="skeleton h-40 rounded-2xl" />
        ) : !user ? (
          <GlassCard className="p-6 text-center" strong>
            <h2 className="text-lg font-semibold">Prêt à rejoindre la communauté ?</h2>
            <p className="mt-1 text-sm text-white/40">
              Inscrivez-vous gratuitement et commencez à acheter et vendre en toute sécurité
            </p>
            <button
              onClick={() => navigate('/signup')}
              className="campus-gradient mt-4 rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
            >
              Créer un compte
            </button>
          </GlassCard>
        ) : IS_APP_RELEASED ? (
          <GlassCard className="p-6 text-center" strong>
            <div className="campus-gradient mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
              <Smartphone className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-lg font-semibold">L'application U. Trade est disponible !</h2>
            <p className="mt-1 text-sm text-white/40">Téléchargez-la pour une expérience encore plus fluide</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {APP_DOWNLOAD_URL_ANDROID && (
                <a href={APP_DOWNLOAD_URL_ANDROID} target="_blank" rel="noreferrer" className="campus-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
                  Bientôt sur Android
                </a>
              )}
              {APP_DOWNLOAD_URL_IOS && (
                <a href={APP_DOWNLOAD_URL_IOS} target="_blank" rel="noreferrer" className="glass rounded-xl px-5 py-2.5 text-sm font-semibold">
                  Bientôt sur iOS
                </a>
              )}
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="p-6 text-center" strong>
            <div className="campus-gradient mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
              <Smartphone className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-lg font-semibold">L'application U. Trade arrive bientôt !</h2>
            <p className="mt-1 text-sm text-white/40">
              Les versions Android et iOS sont en cours de développement. Restez à l'affût !
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                disabled
                aria-disabled="true"
                className="campus-gradient cursor-not-allowed rounded-xl px-5 py-2.5 text-sm font-semibold text-white opacity-50 grayscale pointer-events-none"
              >
                Bientôt sur Android
              </button>
              <button
                disabled
                aria-disabled="true"
                className="glass cursor-not-allowed rounded-xl px-5 py-2.5 text-sm font-semibold opacity-50 grayscale pointer-events-none"
              >
                Bientôt sur iOS
              </button>
            </div>
          </GlassCard>
        )}
      </section>
    </div>
  );
}
