import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Globe, MapPin, Plus, Search } from 'lucide-react';
import { useCampus } from '@/context/CampusContext';
import { getCampusIcon } from '@/components/CampusIcons';
import { ALL_CAMPUSES_ID } from '@/lib/format';
import type { Campus } from '@/lib/types';

interface CampusSelectorProps {
  /**
   * false (défaut) : bouton compact + popover, pour le header.
   * true : toujours visible avec barre de recherche, pour une section de
   * page (ex: "Campus connectés" sur Home.tsx) plutôt qu'une grille dense.
   */
  inline?: boolean;
}

export function CampusSelector({ inline = false }: CampusSelectorProps) {
  const { campuses, selectedCampus, selectedCampusId, setSelectedCampusId } = useCampus();
  const [open, setOpen] = useState(inline);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inline) return; // toujours ouvert, pas de fermeture au clic extérieur
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inline]);

  const isAll = selectedCampusId === ALL_CAMPUSES_ID || !selectedCampus;

  const filtered = campuses.filter((c: Campus) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q);
  });

  const list = (
    <>
      {inline && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un campus par nom ou ville..."
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm outline-none focus:border-white/30"
          />
        </div>
      )}

      <div className={inline ? 'max-h-72 overflow-y-auto rounded-xl border border-white/10' : ''}>
        <button
          onClick={() => { setSelectedCampusId(ALL_CAMPUSES_ID); if (!inline) setOpen(false); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-white/10"
        >
          <Globe className="h-5 w-5 text-white/60" />
          <span className="flex-1 text-left font-medium text-white">Tous les campus</span>
          {isAll && <Check className="h-4 w-4 campus-text" />}
        </button>
        <div className="my-1 h-px bg-white/10" />

        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-white/30">Aucun campus ne correspond</p>
        ) : (
          filtered.map((campus: Campus) => {
            const Icon = getCampusIcon(campus.icon_name);
            const active = campus.id === selectedCampusId;
            return (
              <button
                key={campus.id}
                onClick={() => { setSelectedCampusId(campus.id); if (!inline) setOpen(false); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-white/10"
              >
                {campus.logo_url ? (
                  <img src={campus.logo_url} alt={campus.name} className="h-5 w-5 flex-shrink-0 rounded object-cover" />
                ) : (
                  <Icon className="h-5 w-5 flex-shrink-0" style={{ color: campus.accent_color }} />
                )}
                <div className="flex-1 text-left">
                  <div className="truncate font-medium text-white">{campus.name}</div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin className="h-3 w-3" /> {campus.city}
                  </div>
                </div>
                {active && <Check className="h-4 w-4" style={{ color: campus.accent_color }} />}
              </button>
            );
          })
        )}
      </div>

      <div className="my-1 h-px bg-white/10" />
      <button
        onClick={() => { if (!inline) setOpen(false); window.location.hash = '/request-campus'; }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 transition hover:bg-white/10 hover:text-white"
      >
        <Plus className="h-5 w-5 flex-shrink-0" />
        <span className="flex-1 text-left">Votre campus n'est pas répertorié ?</span>
      </button>
    </>
  );

  if (inline) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 p-3">{list}</div>;
  }

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
        <div className="absolute top-full left-0 z-[100] mt-2 w-72 max-h-96 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-2 shadow-2xl animate-fade-up">
          {list}
        </div>
      )}
    </div>
  );
}
