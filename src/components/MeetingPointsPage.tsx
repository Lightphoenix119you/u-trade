import { useState, useEffect, useCallback } from 'react';
import { MapPin, ThumbsUp, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { GlassCard } from '@/components/GlassCard';
import { CampusSelector } from '@/components/CampusSelector';
import type { MeetingPointSuggestion } from '@/lib/types';

interface MeetingPointsPageProps {
  navigate: (path: string) => void;
}

const STATUS_LABELS: Record<MeetingPointSuggestion['status'], { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: 'En attente', className: 'bg-white/10 text-white/50', icon: Clock },
  approved: { label: 'Approuvé', className: 'bg-emerald-500/20 text-emerald-300', icon: CheckCircle2 },
  rejected: { label: 'Refusé', className: 'bg-red-500/20 text-red-300', icon: XCircle },
};

export function MeetingPointsPage({ navigate }: MeetingPointsPageProps) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<MeetingPointSuggestion[]>([]);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('meeting_point_suggestions_with_votes')
      .select('*')
      .order('vote_count', { ascending: false });
    setSuggestions((data as MeetingPointSuggestion[]) || []);

    if (user) {
      const { data: votes } = await supabase.from('votes').select('suggestion_id').eq('user_id', user.id);
      setMyVotes(new Set((votes || []).map((v) => v.suggestion_id)));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleVote = async (suggestionId: string) => {
    if (!user) { navigate('/signin'); return; }
    const alreadyVoted = myVotes.has(suggestionId);
    // Optimiste
    setMyVotes((prev) => {
      const next = new Set(prev);
      alreadyVoted ? next.delete(suggestionId) : next.add(suggestionId);
      return next;
    });
    setSuggestions((prev) =>
      prev.map((s) => (s.id === suggestionId ? { ...s, vote_count: s.vote_count + (alreadyVoted ? -1 : 1) } : s))
    );

    if (alreadyVoted) {
      await supabase.from('votes').delete().eq('suggestion_id', suggestionId).eq('user_id', user.id);
    } else {
      await supabase.from('votes').insert({ suggestion_id: suggestionId, user_id: user.id });
    }
  };

  const handleSubmit = async () => {
    if (!user) { navigate('/signin'); return; }
    if (!campusId) { setError('Choisissez une université'); return; }
    if (!name.trim()) { setError('Donnez un nom au point de rendez-vous'); return; }
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.from('meeting_point_suggestions').insert({
      campus_id: campusId,
      name: name.trim(),
      description: description.trim(),
      proposed_by: user.id,
    });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    setMsg('Proposition envoyée — la communauté peut maintenant voter !');
    setName('');
    setDescription('');
    setCampusId(null);
    setShowForm(false);
    load();
  };

  return (
    <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Proposer un point de rendez-vous</h1>
          <p className="mt-1 text-sm text-white/50">
            Un lieu manque sur ton campus ? Propose-le, la communauté vote, un admin valide.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="campus-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Proposer
        </button>
      </div>

      {msg && <p className="mb-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">{msg}</p>}

      {showForm && (
        <GlassCard className="mb-6 p-5" strong>
          <h2 className="mb-3 text-sm font-semibold">Nouvelle proposition</h2>
          {error && <p className="mb-3 rounded-lg bg-red-500/10 p-2.5 text-sm text-red-300">{error}</p>}
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs text-white/50">Université concernée</label>
              <CampusSelector inline hideAllOption value={campusId} onChange={setCampusId} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/50">Nom du lieu</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Devant la bibliothèque centrale"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/50">Description / emplacement précis</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Ex: Entrée principale, côté parking, facile d'accès entre les cours"
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="campus-gradient w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? 'Envoi...' : 'Envoyer la proposition'}
            </button>
          </div>
        </GlassCard>
      )}

      {loading ? (
        <p className="text-sm text-white/40">Chargement...</p>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-white/40">Aucune proposition pour le moment — sois le premier !</p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => {
            const status = STATUS_LABELS[s.status];
            const StatusIcon = status.icon;
            const hasVoted = myVotes.has(s.id);
            return (
              <GlassCard key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{s.name}</h3>
                      <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${status.className}`}>
                        <StatusIcon className="h-2.5 w-2.5" /> {status.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-white/40">
                      <MapPin className="h-3 w-3" /> {s.campus_name}
                    </div>
                    {s.description && <p className="mt-1.5 text-sm text-white/60">{s.description}</p>}
                    <p className="mt-1.5 text-[11px] text-white/30">Proposé par {s.proposed_by_name}</p>
                  </div>
                  <button
                    onClick={() => handleVote(s.id)}
                    disabled={s.status !== 'pending'}
                    className={`flex flex-shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      hasVoted ? 'campus-gradient text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    {s.vote_count}
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
