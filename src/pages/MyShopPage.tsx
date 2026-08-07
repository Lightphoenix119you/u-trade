import { useEffect, useState, useCallback } from 'react';
import { Store, Save, Clock, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { GlassCard } from '@/components/GlassCard';
import { shopSchema } from '@/lib/validation';
import { slugify } from '@/lib/format';
import type { Shop } from '@/lib/types';

interface MyShopPageProps {
  navigate: (path: string) => void;
}

const SUBSCRIPTION_LABELS: Record<Shop['subscription_status'], string> = {
  pending: 'En attente d\'activation',
  active: 'Active',
  expired: 'Expirée',
  suspended: 'Suspendue',
};

const SUBSCRIPTION_COLORS: Record<Shop['subscription_status'], string> = {
  pending: 'bg-white/10 text-white/60',
  active: 'bg-emerald-500/20 text-emerald-300',
  expired: 'bg-red-500/20 text-red-300',
  suspended: 'bg-orange-500/20 text-orange-300',
};

export function MyShopPage({ navigate }: MyShopPageProps) {
  const { user, profile } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', logo_url: '', banner_url: '', is_custom_shop: false, production_delay_days: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('shops').select('*').eq('owner_id', user.id).maybeSingle();
    const s = data as Shop | null;
    setShop(s);
    if (s) {
      setForm({
        name: s.name,
        description: s.description || '',
        logo_url: s.logo_url || '',
        banner_url: s.banner_url || '',
        is_custom_shop: s.is_custom_shop,
        production_delay_days: s.production_delay_days || '',
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!user || !profile) {
    return (
      <div className="relative z-10 mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="text-xl font-semibold">Connexion requise</h2>
        <button onClick={() => navigate('/signin')} className="campus-gradient mt-4 rounded-lg px-6 py-2.5 text-sm font-semibold text-white">
          Se connecter
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="skeleton h-10 w-10 rounded-full" />
      </div>
    );
  }

  if (!profile.campus_id) {
    return (
      <div className="relative z-10 mx-auto max-w-md px-4 py-16 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-400" />
        <h2 className="text-xl font-semibold">Campus requis</h2>
        <p className="mt-2 text-sm text-white/50">Renseignez votre université dans votre profil avant de créer une boutique.</p>
        <button onClick={() => navigate('/profile')} className="campus-gradient mt-4 rounded-lg px-6 py-2.5 text-sm font-semibold text-white">
          Aller à mon profil
        </button>
      </div>
    );
  }

  const save = async () => {
    setError(null);
    const parsed = shopSchema.safeParse({
      name: form.name,
      description: form.description || undefined,
      logo_url: form.logo_url || '',
      is_custom_shop: form.is_custom_shop,
      production_delay_days: form.production_delay_days || undefined,
    });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Données invalides'); return; }

    setSaving(true);
    if (shop) {
      const { error: err } = await supabase
        .from('shops')
        .update({
          name: parsed.data.name,
          description: parsed.data.description || null,
          logo_url: parsed.data.logo_url || null,
          banner_url: form.banner_url || null,
          is_custom_shop: parsed.data.is_custom_shop,
          production_delay_days: parsed.data.production_delay_days || null,
        })
        .eq('id', shop.id);
      setSaving(false);
      if (err) { setError(err.message); return; }
      setMsg('Boutique mise à jour');
      load();
    } else {
      const { error: err } = await supabase.from('shops').insert({
        owner_id: user.id,
        campus_id: profile.campus_id,
        name: parsed.data.name,
        slug: slugify(parsed.data.name),
        description: parsed.data.description || null,
        logo_url: parsed.data.logo_url || null,
        banner_url: form.banner_url || null,
        is_custom_shop: parsed.data.is_custom_shop,
        production_delay_days: parsed.data.production_delay_days || null,
      });
      setSaving(false);
      if (err) { setError(err.message); return; }
      setMsg('Boutique créée ! Elle sera visible après approbation par un administrateur.');
      load();
    }
  };

  const toggleVisibility = async () => {
    if (!shop) return;
    const { error: err } = await supabase.from('shops').update({ is_storefront_visible: !shop.is_storefront_visible }).eq('id', shop.id);
    if (err) { setError(err.message); return; }
    load();
  };

  return (
    <div className="relative z-10 mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
          <Store className="h-5 w-5 campus-text" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Ma boutique</h1>
          <p className="text-sm text-white/40">{shop ? 'Gérez votre boutique créateur' : 'Ouvrez votre boutique créateur'}</p>
        </div>
      </div>

      {shop && (
        <GlassCard className="mb-4 p-5" strong>
          <h3 className="mb-3 text-sm font-semibold">Abonnement</h3>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${SUBSCRIPTION_COLORS[shop.subscription_status]}`}>
              {SUBSCRIPTION_LABELS[shop.subscription_status]}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-white/40">
              <Clock className="h-3.5 w-3.5" />
              {shop.rent_expires_at ? `Expire le ${new Date(shop.rent_expires_at).toLocaleDateString('fr-FR')}` : 'Aucune date d\'expiration'}
            </span>
          </div>
          {shop.subscription_status !== 'active' && (
            <p className="mt-2 text-xs text-white/40">
              L'activation ou le renouvellement de votre location est géré par l'administration. Contactez un administrateur de votre campus pour l'activer.
            </p>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
            <div className="text-xs text-white/50">
              Visibilité de la vitrine {shop.is_storefront_visible ? '(visible publiquement)' : '(masquée par vous)'}
            </div>
            <button
              onClick={toggleVisibility}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                shop.is_storefront_visible ? 'bg-white/10 text-white' : 'bg-white/5 text-white/40'
              }`}
            >
              {shop.is_storefront_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {shop.is_storefront_visible ? 'Visible' : 'Masquée'}
            </button>
          </div>
        </GlassCard>
      )}

      <GlassCard className="space-y-3 p-5 sm:p-6" strong>
        <div>
          <label className="mb-1 block text-xs text-white/50">Nom de la boutique</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/50">URL du logo</label>
            <input
              type="url"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">URL de la bannière</label>
            <input
              type="url"
              value={form.banner_url}
              onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Délai de production (boutique créateur)</label>
          <input
            type="text"
            value={form.production_delay_days}
            onChange={(e) => setForm({ ...form, production_delay_days: e.target.value })}
            placeholder="ex. 3-5 jours"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_custom_shop}
            onChange={(e) => setForm({ ...form, is_custom_shop: e.target.checked })}
            className="h-4 w-4 rounded border-white/20 bg-white/5"
          />
          Boutique créateur (annonces sur mesure)
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {msg && <p className="text-sm text-emerald-400">{msg}</p>}

        <button
          onClick={save}
          disabled={saving || !form.name}
          className="campus-gradient flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? 'Enregistrement...' : shop ? 'Enregistrer' : 'Créer ma boutique'}
        </button>
      </GlassCard>
    </div>
  );
}
