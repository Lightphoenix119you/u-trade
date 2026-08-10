import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

const STORAGE_KEY = 'has_seen_onboarding';

interface OnboardingContextValue {
  active: boolean;
  startTour: () => void;
  closeTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding doit être utilisé à l\'intérieur de OnboardingProvider');
  return ctx;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState(false);

  // Affichage unique : ne se déclenche automatiquement que si l'utilisateur
  // ne l'a jamais vu (ni terminé, ni passé — les deux marquent le flag) ET
  // qu'il est connecté — les cibles du tour (bouton Vendre, profil...)
  // n'existent dans le DOM que pour un utilisateur authentifié.
  useEffect(() => {
    if (!user) return;
    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (!hasSeen) {
      // Léger délai pour laisser le Header et la page initiale finir leur
      // premier rendu — les cibles du tour doivent déjà exister dans le DOM.
      const t = setTimeout(() => setActive(true), 600);
      return () => clearTimeout(t);
    }
  }, [user]);

  const startTour = useCallback(() => setActive(true), []);
  const closeTour = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setActive(false);
  }, []);

  return (
    <OnboardingContext.Provider value={{ active, startTour, closeTour }}>
      {children}
    </OnboardingContext.Provider>
  );
}
