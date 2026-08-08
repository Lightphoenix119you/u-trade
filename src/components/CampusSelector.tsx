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
  /**
   * Contrôlé : si fourni (avec onChange), remplace la sélection globale du
   * contexte campus par un état local — pour un formulaire (ex: inscription)
   * où choisir un campus ne doit PAS changer le filtre affiché à toute
   * l'app pendant que l'utilisateur remplit le reste du formulaire.
   */
  value?: string | null;
  onChange?: (campusId: string) => void;
  /**
   * Masque "Tous les campus" — pertinent pour un filtre d'affichage, pas
   * pour un choix obligatoire comme à l'inscription (on doit en choisir un).
   */
  hideAllOption?: boolean;
}

export function CampusSelector({ inline = false, value, onChange, hideAllOption = false }: CampusSelectorProps) {
  const { campuses, selectedCampus, selectedCampusId, setSelectedCampusId } = useCampus();
  const [open, setOpen] = useState(inline);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const isControlled = value !== undefined && onChange !== undefined;
  const activeId = isControlled ? value : selectedCampusId;
  const activeCampus = isControlled ? campuses.find((c) => c.id === value) : selectedCampus;
  const select = (id: string) => (isControlled ? onChange!(id) : setSelectedCampusId(id));

  useEffect(() => {
    if (inline) return; // toujours ouvert, pas de fermeture au clic extérieur
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inline]);

  const isAll = !hideAllOption && (activeId === ALL_CAMPUSES_ID || !activeCampus);

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

      <div className={inline ? 'max-h-56 overflow-y-auto rounded-xl border border-white/10' : ''}>
        {!hideAllOption && (
          <>
            <button
              type="button"
              onClick={() => { select(ALL_CAMPUSES_ID); if (!inline) setOpen(false); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-white/10"
            >
              <Globe className="h-5 w-5 text-white/60" />
              <span className="flex-1 text-left font-medium text-white">Tous les campus</span>
              {isAll && <Check className="h-4 w-4 campus-text" />}
            </button>
            <div className="my-1 h-px bg-white/10" />
          </>
        )}

        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-white/30">Aucun campus ne correspond</p>
        ) : (
          filtered.map((campus: Campus) => {
            const Icon = getCampusIcon(campus.icon_name);
            const active = campus.id === activeId;
            return (
              <button
                key={campus.id}
                type="button"
                onClick={() => { select(campus.id); if (!inline) setOpen(false); }}
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
      <a
        href="#/request-campus"
        target={isControlled ? '_blank' : undefined}
        rel={isControlled ? 'noreferrer' : undefined}
        onClick={() => { if (!inline && !isControlled) setOpen(false); }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 transition hover:bg-white/10 hover:text-white"
      >
        <Plus className="h-5 w-5 flex-shrink-0" />
        <span className="flex-1 text-left">Votre campus n'est pas répertorié ?</span>
      </a>
    </>
  );

  if (inline) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 p-3">{list}</div>;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition hover:border-white/20"
        style={isAll ? undefined : { borderColor: 'var(--campus-primary)' }}
      >
        {isAll ? (
          <Globe className="h-4 w-4 text-white/70" />
        ) : activeCampus!.logo_url ? (
          <img src={activeCampus!.logo_url} alt={activeCampus!.name} className="h-4 w-4 rounded object-cover" />
        ) : (
          (() => { const Icon = getCampusIcon(activeCampus!.icon_name); return <Icon className="h-4 w-4" style={{ color: activeCampus!.accent_color }} />; })()
        )}
        <span className="hidden sm:inline max-w-[140px] truncate">
          {isAll ? 'Tous les campus' : activeCampus!.name}
        </span>
        <span className="sm:hidden max-w-[80px] truncate">
          {isAll ? 'Tous' : activeCampus!.slug.toUpperCase()}
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
