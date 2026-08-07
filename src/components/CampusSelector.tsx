import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Globe, MapPin, Plus } from 'lucide-react';
import { useCampus } from '@/context/CampusContext';
import { getCampusIcon } from '@/components/CampusIcons';
import { ALL_CAMPUSES_ID } from '@/lib/format';
import type { Campus } from '@/lib/types';

export function CampusSelector() {
  const { campuses, selectedCampus, selectedCampusId, setSelectedCampusId } = useCampus();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isAll = selectedCampusId === ALL_CAMPUSES_ID || !selectedCampus;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition hover:border-white/20"
        style={isAll ? undefined : { borderColor: 'var(--campus-primary)' }}
      >
        {isAll ? (
          <Globe className="h-4 w-4 text-white/70" />
        ) : selectedCampus!.logo_url ? (
          <img src={selectedCampus!.logo_url} alt={selectedCampus!.name} className="h-4 w-4 rounded object-cover" />
        ) : (
          (() => { const Icon = getCampusIcon(selectedCampus!.icon_name); return <Icon className="h-4 w-4" style={{ color: selectedCampus!.accent_color }} />; })()
        )}
        <span className="hidden sm:inline max-w-[140px] truncate">
          {isAll ? 'Tous les campus' : selectedCampus!.name}
        </span>
        <span className="sm:hidden max-w-[80px] truncate">
          {isAll ? 'Tous' : selectedCampus!.slug.toUpperCase()}
        </span>
        <ChevronDown className={`h-4 w-4 text-white/50 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-[100] mt-2 w-72 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-2 shadow-2xl animate-fade-up">
          <button
            onClick={() => { setSelectedCampusId(ALL_CAMPUSES_ID); setOpen(false); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-white/10"
          >
            <Globe className="h-5 w-5 text-white/60" />
            <span className="flex-1 text-left font-medium text-white">Tous les campus</span>
            {isAll && <Check className="h-4 w-4 campus-text" />}
          </button>
          <div className="my-1 h-px bg-white/10" />
          {campuses.map((campus: Campus) => {
            const Icon = getCampusIcon(campus.icon_name);
            const active = campus.id === selectedCampusId;
            return (
              <button
                key={campus.id}
                onClick={() => { setSelectedCampusId(campus.id); setOpen(false); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-white/10"
              >
                {campus.logo_url ? (
                  <img src={campus.logo_url} alt={campus.name} className="h-5 w-5 flex-shrink-0 rounded object-cover" />
                ) : (
                  <Icon className="h-5 w-5 flex-shrink-0" style={{ color: campus.accent_color }} />
                )}
                <div className="flex-1 text-left">
                  <div className="font-medium truncate text-white">{campus.name}</div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin className="h-3 w-3" /> {campus.city}
                  </div>
                </div>
                {active && <Check className="h-4 w-4" style={{ color: campus.accent_color }} />}
              </button>
            );
          })}
          <div className="my-1 h-px bg-white/10" />
          <button
            onClick={() => { setOpen(false); window.location.hash = '/request-campus'; }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            <Plus className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 text-left">Votre université n'est pas listée ?</span>
          </button>
        </div>
      )}
    </div>
  );
}
