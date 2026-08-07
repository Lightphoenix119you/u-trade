import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Campus, AppSettings } from '@/lib/types';
import { ALL_CAMPUSES_ID } from '@/lib/format';

interface CampusState {
  campuses: Campus[];
  selectedCampus: Campus | null;
  selectedCampusId: string;
  setSelectedCampusId: (id: string) => void;
  settings: AppSettings | null;
  loading: boolean;
  refreshCampuses: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const CampusContext = createContext<CampusState | undefined>(undefined);

const STORAGE_KEY = 'utrade-campus-id';

export function CampusProvider({ children }: { children: ReactNode }) {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusIdState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || ALL_CAMPUSES_ID;
  });
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCampuses = useCallback(async () => {
    const { data, error } = await supabase
      .from('campuses')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) {
      console.error('Campus load error:', error.message);
      return;
    }
    setCampuses((data as Campus[]) || []);
  }, []);

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) {
      console.error('Settings load error:', error.message);
      return;
    }
    setSettings(data as AppSettings | null);
  }, []);

  useEffect(() => {
    Promise.all([loadCampuses(), loadSettings()]).finally(() => setLoading(false));
  }, [loadCampuses, loadSettings]);

  const setSelectedCampusId = useCallback((id: string) => {
    setSelectedCampusIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const selectedCampus = campuses.find((c) => c.id === selectedCampusId) ?? null;

  return (
    <CampusContext.Provider
      value={{
        campuses,
        selectedCampus,
        selectedCampusId,
        setSelectedCampusId,
        settings,
        loading,
        refreshCampuses: loadCampuses,
        refreshSettings: loadSettings,
      }}
    >
      {children}
    </CampusContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCampus() {
  const ctx = useContext(CampusContext);
  if (!ctx) throw new Error('useCampus must be used within CampusProvider');
  return ctx;
}
