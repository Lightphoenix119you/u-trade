import { useEffect, useState, useCallback } from 'react';

export function useHashRoute(): [string, (path: string) => void] {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');

  useEffect(() => {
    const onHashChange = () => {
      setRoute(window.location.hash.slice(1) || '/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
  }, []);

  return [route, navigate];
}

export function parseRoute(route: string): { segments: string[]; params: Record<string, string> } {
  const clean = route.split('?')[0];
  const segments = clean.split('/').filter(Boolean);
  return { segments, params: {} };
}
