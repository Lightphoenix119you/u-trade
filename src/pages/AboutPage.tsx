import { useState } from 'react';
import {
  ShieldCheck, Handshake, Users, Heart, Youtube, Music2, MessageCircle,
  Mail, Smartphone, Sparkles, GraduationCap, X, Copy, Check,
} from 'lucide-react';

interface AboutPageProps {
  navigate: (path: string) => void;
}

const PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Sécurité OTP',
    text: "Chaque livraison se conclut par un code à 6 chiffres, jamais visible du vendeur avant l'échange en main propre. Personne ne débloque un paiement par accident, ni par mauvaise foi.",
  },
  {
    icon: Handshake,
    title: 'Transaction de confiance',
    text: "L'argent de l'acheteur reste bloqué par la plateforme jusqu'à la remise de l'objet. Le vendeur sait qu'il sera payé, l'acheteur sait qu'il ne paie pas dans le vide.",
  },
  {
    icon: Users,
    title: 'Esprit de campus',
    text: 'Chaque université a son propre espace, ses propres points de rendez-vous. On achète et on vend à des gens du même campus, pas à des inconnus au bout du pays.',
  },
];

const SOCIALS = [
  {
    icon: Youtube,
    name: 'YouTube',
    handle: 'Black Nova Studio',
    href: 'https://youtube.com/@blacknovastudio2k25?si=mSDfOMl-7JrzAHJY',
    color: 'text-red-400',
  },
  {
    icon: Music2,
    name: 'TikTok',
    handle: '@blackynovagaame',
    href: 'https://www.tiktok.com/@blackynovagaame?_r=1&_t=ZS-98fNG8cKhXg',
    color: 'text-cyan-300',
  },
  {
    icon: MessageCircle,
    name: 'Chaîne WhatsApp',
    handle: 'U. TRADE NEWS',
    href: 'https://whatsapp.com/channel/0029VbDaBrCFCCoMpfeEt31S',
    color: 'text-emerald-400',
  },
];

const PAYMENT_METHODS = [
  { name: 'Mobile Money', number: 'Numéro à venir' },
  { name: 'Airtel Money', number: 'Numéro à venir' },
  { name: 'M-Pesa', number: 'Numéro à venir' },
  { name: 'Orange Money', number: 'Numéro à venir' },
];

export function AboutPage({ navigate }: AboutPageProps) {
  const [showDonate, setShowDonate] = useState(false);
  const [copiedMethod, setCopiedMethod] = useState<string | null>(null);

  const copyNumber = (method: string, number: string) => {
    navigator.clipboard.writeText(number).catch(() => {});
    setCopiedMethod(method);
    setTimeout(() => setCopiedMethod(null), 1500);
  };

  return (
    <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Hero */}
      <div className="animate-fade-up text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/60">
          <Sparkles className="h-3.5 w-3.5 campus-text" /> Projet étudiant &amp; indépendant
        </div>
        <h1 className="text-3xl font-black leading-tight sm:text-4xl">
          Acheter et vendre entre étudiants,
          <br />
          <span className="campus-gradient-text">sans jamais se demander si ça va mal tourner.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-white/50 sm:text-base">
          U. Trade est le marché de campus pensé pour remplacer les groupes WhatsApp où
          personne ne sait qui paie en premier — un espace sécurisé, propre à chaque
          université, pour les étudiants qui vendent et achètent entre eux.
        </p>
      </div>

      {/* Vision */}
      <GlassSection className="mt-10">
        <h2 className="text-lg font-bold">Pourquoi U. Trade existe</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/60">
          <p>
            Sur un campus, le commerce entre étudiants existe déjà — un livre qui change de
            main, un vêtement revendu, une commande sur-mesure à un camarade créateur. Le
            problème n'a jamais été la demande, mais la confiance : payer d'avance sans
            garantie, ou livrer sans être sûr d'être payé.
          </p>
          <p>
            U. Trade règle ce problème avec un système de séquestre : l'argent de l'acheteur
            est bloqué par la plateforme dès le paiement, et n'est débloqué vers le vendeur
            qu'au moment où l'acheteur confirme la livraison avec un code OTP à 6 chiffres,
            donné en main propre au point de rendez-vous. Aucune des deux parties ne peut se
            faire avoir.
          </p>
          <p>
            L'objectif reste simple : une plateforme fiable, moderne, et pensée pour la
            réalité du campus — pas un site générique de petites annonces.
          </p>
        </div>
      </GlassSection>

      {/* Piliers */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <GlassSection key={p.title}>
            <div className="campus-gradient mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
              <p.icon className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-sm font-bold">{p.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50">{p.text}</p>
          </GlassSection>
        ))}
      </div>

      {/* Créateur */}
      <GlassSection className="mt-6" strong>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <GraduationCap className="h-8 w-8 campus-text" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Derrière l'écran</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-white/60">
              U. Trade est conçu et développé par un étudiant, seul, sur son temps libre —
              pas par une entreprise. L'idée est née d'un besoin réel de campus, et chaque
              fonctionnalité (l'OTP, le séquestre, les boutiques créateurs) répond à un
              problème concret rencontré en vendant ou en achetant entre étudiants.
            </p>
            <a
              href="mailto:lightphoenix119you@gmail.com"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
            >
              <Mail className="h-3.5 w-3.5" /> lightphoenix119you@gmail.com
            </a>
          </div>
        </div>
      </GlassSection>

      {/* Réseaux sociaux */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Suivre le projet</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {SOCIALS.map((s) => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="glass-card group flex flex-col gap-2 rounded-2xl p-4 transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <s.icon className={`h-6 w-6 ${s.color} transition group-hover:scale-110`} />
              <div>
                <div className="text-sm font-semibold">{s.name}</div>
                <div className="text-xs text-white/40">{s.handle}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Soutien & Dons */}
      <div className="campus-glow mt-10 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-6 text-center sm:p-8">
        <Heart className="mx-auto h-8 w-8 text-pink-400" />
        <h2 className="mt-3 text-xl font-bold">Un petit geste fait toute la différence</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/60">
          Si tu veux soutenir l'étudiant derrière ce projet — et les prochains à venir — tu
          peux faire un don juste ici. Pas d'obligation, juste beaucoup de gratitude 😙
        </p>
        <div className="mx-auto mt-5 flex max-w-sm flex-wrap items-center justify-center gap-2">
          {PAYMENT_METHODS.map((m) => (
            <span
              key={m.name}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60"
            >
              <Smartphone className="h-3 w-3" /> {m.name}
            </span>
          ))}
        </div>
        <button
          onClick={() => setShowDonate(true)}
          className="campus-gradient mt-6 rounded-xl px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
        >
          Faire un don
        </button>
      </div>

      {showDonate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDonate(false)} />
          <div className="glass-strong relative z-10 w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl">
            <button
              onClick={() => setShowDonate(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <Heart className="mx-auto h-8 w-8 text-pink-400" />
            <h3 className="mt-3 text-center text-lg font-bold">Merci pour ton soutien 🙏</h3>
            <p className="mx-auto mt-1 max-w-xs text-center text-xs text-white/50">
              Choisis un mode de paiement et copie le numéro pour envoyer ton don directement.
            </p>

            <div className="mt-5 space-y-2">
              {PAYMENT_METHODS.map((m) => (
                <div
                  key={m.name}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="h-4 w-4 flex-shrink-0 text-white/40" />
                    <div>
                      <div className="text-sm font-semibold">{m.name}</div>
                      <div className="text-xs text-white/40">{m.number}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => copyNumber(m.name, m.number)}
                    className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/15"
                  >
                    {copiedMethod === m.name ? (
                      <><Check className="h-3 w-3 text-emerald-400" /> Copié</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copier</>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <p className="mt-4 text-center text-[11px] text-white/30">
              Les numéros seront mis à jour dès qu'ils seront disponibles.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function GlassSection({ children, className = '', strong }: { children: React.ReactNode; className?: string; strong?: boolean }) {
  return (
    <div className={`${strong ? 'glass-strong' : 'glass-card'} rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}
