import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';

interface Step {
  /** null = pas de cible précise (ex: écran de bienvenue), overlay plein écran centré */
  target: string | null;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    target: null,
    title: 'Bienvenue sur U. Trade !',
    text: 'Ici, tu peux acheter et vendre facilement des articles entre étudiants du campus.',
  },
  {
    target: 'campus-selector',
    title: 'Change de site',
    text: 'Choisis ton site universitaire ici pour voir uniquement les annonces de ton campus.',
  },
  {
    target: 'create-button',
    title: 'Publie une annonce',
    text: 'Clique sur le bouton + pour vendre un article en moins de 2 minutes.',
  },
  {
    target: 'nav-market',
    title: 'Le Marché',
    text: 'Explore toutes les catégories : livres, téléphones, vêtements, et bien plus.',
  },
  {
    target: 'nav-boutiques',
    title: 'Les Boutiques',
    text: 'Découvre les vendeurs certifiés et les boutiques des étudiants.',
  },
  {
    target: 'nav-profile',
    title: 'Ton profil',
    text: 'Discute en direct avec les vendeurs et gère tes annonces facilement.',
  },
];

interface Rect {
  top: number; left: number; width: number; height: number;
}

// Marché/Boutiques/le reste existent parfois en double (nav desktop +
// mobile) : on prend le premier élément réellement visible à l'écran,
// jamais celui masqué par une classe Tailwind responsive (hidden/lg:flex).
function findVisibleTarget(name: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of candidates) {
    if (el.offsetParent !== null) return el;
  }
  return candidates[0] ?? null;
}

export function OnboardingTour() {
  const { active, closeTour } = useOnboarding();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;

  const measure = useCallback(() => {
    if (!step.target) { setRect(null); return; }
    const el = findVisibleTarget(step.target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step.target]);

  useLayoutEffect(() => {
    if (!active) return;
    measure();
  }, [active, stepIndex, measure]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, measure]);

  useEffect(() => {
    if (active) setStepIndex(0);
  }, [active]);

  if (!active) return null;

  const handleNext = () => {
    if (isLast) { closeTour(); return; }
    setStepIndex((i) => i + 1);
  };
  const handlePrev = () => setStepIndex((i) => Math.max(0, i - 1));

  const PAD = 8;
  const spotlight = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  // Position de la carte : sous la cible si elle a de la place en dessous,
  // sinon au-dessus — jamais hors écran sur un petit téléphone.
  const cardTop = spotlight
    ? (spotlight.top + spotlight.height + 160 < window.innerHeight
        ? spotlight.top + spotlight.height + 12
        : Math.max(12, spotlight.top - 180))
    : undefined;

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">
      {/* Fond sombre — 4 bandes autour de la cible plutôt qu'un seul calque,
          pour laisser un vrai trou cliqué-visible sans bibliothèque de masque CSS. */}
      {spotlight ? (
        <>
          <div className="absolute inset-x-0 top-0 bg-black/75 transition-all" style={{ height: Math.max(0, spotlight.top) }} />
          <div className="absolute inset-x-0 bottom-0 bg-black/75 transition-all" style={{ top: spotlight.top + spotlight.height }} />
          <div className="absolute bg-black/75 transition-all" style={{ top: spotlight.top, height: spotlight.height, left: 0, width: Math.max(0, spotlight.left) }} />
          <div className="absolute bg-black/75 transition-all" style={{ top: spotlight.top, height: spotlight.height, left: spotlight.left + spotlight.width, right: 0 }} />
          <div
            className="campus-glow absolute rounded-xl ring-2 ring-white/70 transition-all"
            style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/80" />
      )}

      {/* Carte d'étape */}
      <div
        className="absolute left-1/2 w-[90vw] max-w-sm -translate-x-1/2 animate-fade-up"
        style={cardTop !== undefined ? { top: cardTop } : { top: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <div className="glass-strong rounded-2xl border border-white/15 p-5 shadow-2xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                Étape {stepIndex + 1} / {STEPS.length}
              </span>
              <h3 className="mt-0.5 text-base font-bold">{step.title}</h3>
            </div>
            <button
              onClick={closeTour}
              className="flex-shrink-0 rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
              aria-label="Passer le tutoriel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-white/70">{step.text}</p>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button onClick={closeTour} className="text-xs font-medium text-white/40 hover:text-white/70">
              Passer
            </button>
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  onClick={handlePrev}
                  className="glass rounded-lg px-3.5 py-2 text-sm font-medium"
                >
                  Précédent
                </button>
              )}
              <button
                onClick={handleNext}
                className="campus-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white"
              >
                {isLast ? 'Terminer' : 'Suivant'}
              </button>
            </div>
          </div>

          <div className="mt-3 flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === stepIndex ? 'w-4 campus-gradient' : 'w-1.5 bg-white/20'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
