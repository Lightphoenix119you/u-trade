import { useState } from 'react';
import { Plus, Trash2, Send, CheckCircle2, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { GlassCard } from '@/components/GlassCard';
import { campusRequestSchema } from '@/lib/validation';

interface RequestCampusPageProps {
  navigate: (path: string) => void;
}

export function RequestCampusPage({ navigate }: RequestCampusPageProps) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    university_name: '',
    city: '',
    contact_info: '',
  });
  const [points, setPoints] = useState<{ name: string; description: string }[]>([{ name: '', description: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!user) {
    return (
      <div className="relative z-10 mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="text-xl font-semibold">Connexion requise</h2>
        <p className="mt-2 text-sm text-white/40">Connectez-vous pour demander l'ajout de votre université.</p>
        <button onClick={() => navigate('/signin')} className="campus-gradient mt-4 rounded-lg px-6 py-2.5 text-sm font-semibold text-white">
          Se connecter
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="relative z-10 mx-auto max-w-md px-4 py-16 text-center">
        <GlassCard className="p-8" strong>
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
          <h2 className="text-xl font-semibold">Demande envoyée</h2>
          <p className="mt-2 text-sm text-white/50">
            Merci ! Un administrateur va examiner votre demande. Vous serez notifié si votre université est ajoutée.
          </p>
          <button onClick={() => navigate('/')} className="campus-gradient mt-5 rounded-lg px-6 py-2.5 text-sm font-semibold text-white">
            Retour à l'accueil
          </button>
        </GlassCard>
      </div>
    );
  }

  const updatePoint = (i: number, field: 'name' | 'description', value: string) => {
    setPoints((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };
  const addPoint = () => setPoints((prev) => (prev.length >= 10 ? prev : [...prev, { name: '', description: '' }]));
  const removePoint = (i: number) => setPoints((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError(null);
    const cleanedPoints = points.filter((p) => p.name.trim().length > 0);
    const parsed = campusRequestSchema.safeParse({
      university_name: form.university_name,
      city: form.city,
      contact_info: form.contact_info,
      suggested_meeting_points: cleanedPoints,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Données invalides');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.from('campus_requests').insert({
      university_name: parsed.data.university_name,
      city: parsed.data.city,
      contact_info: parsed.data.contact_info,
      suggested_meeting_points: parsed.data.suggested_meeting_points,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setDone(true);
  };

  return (
    <div className="relative z-10 mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
          <Building2 className="h-5 w-5 campus-text" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Demande d'ajout de campus</h1>
          <p className="text-sm text-white/40">Votre université n'est pas encore sur U. Trade ? Proposez-la.</p>
        </div>
      </div>

      <GlassCard className="space-y-4 p-5 sm:p-6" strong>
        <div>
          <label className="mb-1 block text-xs text-white/50">Nom de l'université</label>
          <input
            type="text"
            value={form.university_name}
            onChange={(e) => setForm({ ...form, university_name: e.target.value })}
            placeholder="ex. Université de Lubumbashi"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/50">Ville</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="ex. Lubumbashi"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Votre contact (email ou téléphone)</label>
            <input
              type="text"
              value={form.contact_info}
              onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
              placeholder="0812345678"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs text-white/50">Points de rendez-vous suggérés (optionnel)</label>
            <button type="button" onClick={addPoint} className="flex items-center gap-1 text-xs campus-text">
              <Plus className="h-3 w-3" /> Ajouter
            </button>
          </div>
          <div className="space-y-2">
            {points.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updatePoint(i, 'name', e.target.value)}
                  placeholder="Nom du point (ex. Bibliothèque centrale)"
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                />
                <input
                  type="text"
                  value={p.description}
                  onChange={(e) => updatePoint(i, 'description', e.target.value)}
                  placeholder="Description (optionnel)"
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                />
                {points.length > 1 && (
                  <button type="button" onClick={() => removePoint(i)} className="flex-shrink-0 text-red-400/60 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={submit}
          disabled={saving}
          className="campus-gradient flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {saving ? 'Envoi...' : 'Envoyer la demande'}
        </button>
      </GlassCard>
    </div>
  );
}
