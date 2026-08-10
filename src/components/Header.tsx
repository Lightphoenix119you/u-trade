import { useState, useEffect } from 'react';
import { ShoppingBag, Home, Store, MessageSquare, LayoutDashboard, LogOut, Plus, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CampusSelector } from '@/components/CampusSelector';
import { NotificationBell } from '@/components/NotificationBell';
import { useCreateListingModal } from '@/context/CreateListingModalContext';

interface HeaderProps {
  route: string;
  navigate: (path: string) => void;
}

export function Header({ route, navigate }: HeaderProps) {
  const { user, profile, signOut } = useAuth();
  const [imgError, setImgError] = useState(false);
  const { openCreateListingModal } = useCreateListingModal();
  const isStaff = profile?.role === 'campus_admin' || profile?.role === 'super_admin' || profile?.role === 'admin';

  const navItems = [
    { label: 'Accueil', icon: Home, path: '/', match: (r: string) => r === '/' },
    { label: 'Marché', icon: ShoppingBag, path: '/market', match: (r: string) => r.startsWith('/market') },
    { label: 'Boutiques', icon: Store, path: '/shops', match: (r: string) => r.startsWith('/shops') },
    { label: 'Messages', icon: MessageSquare, path: '/messages', match: (r: string) => r.startsWith('/messages') },
    { label: 'À propos', icon: Info, path: '/about', match: (r: string) => r.startsWith('/about') },
  ];

  // Marché/Boutiques existent en double (nav desktop + nav mobile) : le
  // même data-tour sur les deux, OnboardingTour.tsx choisit celui qui est
  // réellement visible selon le viewport.
  const tourTargetFor = (path: string): string | undefined => {
    if (path === '/market') return 'nav-market';
    if (path === '/shops') return 'nav-boutiques';
    return undefined;
  };

  // Helper pour obtenir l'URL complète de l'avatar
  const getAvatarUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  };

  const avatarSrc = getAvatarUrl(profile?.avatar_url);

  // Le Header ne se démonte jamais entre les pages (sticky) : sans ce reset,
  // un échec de chargement ancien (imgError=true) reste bloqué pour toujours,
  // même quand avatarSrc pointe ensuite vers une image valide.
  useEffect(() => {
    setImgError(false);
  }, [avatarSrc]);

  return (
    <header className="sticky top-0 z-40 glass-strong">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        {/* Logo */}
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5 flex-shrink-0">
          <div className="campus-gradient flex h-9 w-9 items-center justify-center rounded-xl campus-glow">
            <span className="text-lg font-black text-white">U</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-lg font-bold leading-none tracking-tight">U. Trade</div>
            <div className="text-[10px] text-white/40 leading-none">University Trade</div>
          </div>
        </button>

        {/* Desktop nav */}
        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.match(route);
            return (
              <button
                key={item.path}
                data-tour={tourTargetFor(item.path)}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div data-tour="campus-selector">
            <CampusSelector />
          </div>

          {user ? (
            <>
              <button
                data-tour="create-button"
                onClick={openCreateListingModal}
                className="campus-gradient flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Vendre</span>
              </button>

              {isStaff && (
                <button
                  onClick={() => navigate('/admin')}
                  className={`hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    route.startsWith('/admin') ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Admin
                </button>
              )}

              <NotificationBell navigate={navigate} />

              {/* Bouton Profil */}
              <button
                data-tour="nav-profile"
                onClick={() => navigate('/profile')}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                  route.startsWith('/profile') ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                {avatarSrc && !imgError ? (
                  <img
                    src={avatarSrc}
                    alt={profile?.full_name || 'Profil'}
                    className="h-7 w-7 rounded-full object-cover border border-white/20"
                    onError={() => {
                      console.error("Erreur de chargement de l'image de profil:", avatarSrc);
                      setImgError(true);
                    }}
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className="hidden md:inline max-w-[80px] truncate">{profile?.full_name?.split(' ')[0] || 'Profil'}</span>
              </button>

              <button
                onClick={() => signOut()}
                className="rounded-lg p-2 text-white/40 transition hover:bg-white/5 hover:text-white"
                title="Déconnexion"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/signin')}
                className="hidden sm:block rounded-lg px-3 py-2 text-sm font-medium text-white/60 transition hover:text-white"
              >
                Connexion
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="campus-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                S'inscrire
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto border-t border-white/5 px-2 py-1.5 no-scrollbar lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.match(route);
          return (
            <button
              key={item.path}
              data-tour={tourTargetFor(item.path)}
              onClick={() => navigate(item.path)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                active ? 'bg-white/10 text-white' : 'text-white/50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
        {isStaff && (
          <button
            onClick={() => navigate('/admin')}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              route.startsWith('/admin') ? 'bg-white/10 text-white' : 'text-white/50'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Admin
          </button>
        )}
      </nav>
    </header>
  );
}
