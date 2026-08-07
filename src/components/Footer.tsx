import { GlassCard } from '@/components/GlassCard';

interface FooterProps {
  navigate: (path: string) => void;
}

const LINKS = [
  { label: 'Accueil', path: '/' },
  { label: 'Marché', path: '/market' },
  { label: 'Boutiques', path: '/shops' },
  { label: 'À propos', path: '/about' },
];

export function Footer({ navigate }: FooterProps) {
  return (
    <footer className="relative z-10 mt-12 border-t border-white/5 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <GlassCard className="flex flex-col items-center justify-between gap-4 p-5 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="campus-gradient flex h-7 w-7 items-center justify-center rounded-lg">
              <span className="text-sm font-black text-white">U</span>
            </div>
            <span className="text-sm font-semibold">U. Trade</span>
            <span className="text-xs text-white/30">University Trade</span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="text-xs text-white/40 transition hover:text-white/70"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <p className="text-xs text-white/30">
            Le marketplace étudiant sécurisé · Paiement OTP à la livraison
          </p>
        </GlassCard>
      </div>
    </footer>
  );
}
