import { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, Building2, DollarSign, Shield, Settings, Image as ImageIcon,
  Plus, Edit2, Save, X, Trash2, Check, TrendingUp, Wallet,
  Users, Flag, Ban, AlertTriangle, Package, MessageCircle, PauseCircle, UserCog, ShieldOff, Search, MapPin, ThumbsUp, Gift,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { GlassCard } from '@/components/GlassCard';
import { ImageUploader } from '@/components/ImageUploader';
import { getCampusIcon } from '@/components/CampusIcons';
import { campusSchema, hubSchema, settingsSchema, adBannerSchema } from '@/lib/validation';
import { formatUSD, slugify } from '@/lib/format';
import type { Campus, CampusHub, Transaction, Report, PhoneBlacklist, AdBanner, AppSettings, Shop, Order, CampusRequest, Listing, AdminMember, AdminPermission, AdminUser, MeetingPointSuggestion } from '@/lib/types';

interface AdminProps {
  navigate: (path: string) => void;
  setFlash: (flash: { type: 'error' | 'success' | 'info'; message: string }) => void;
}

type AdminTab = 'overview' | 'campuses' | 'financial' | 'moderation' | 'team' | 'users' | 'meeting-points' | 'referrals' | 'settings' | 'ads';

export function AdminPage({ navigate, setFlash }: AdminProps) {
  const { profile, loading } = useAuth();
  const { campuses, refreshCampuses, refreshSettings } = useCampus();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const isAdminRole = profile?.role === 'admin' || profile?.role === 'campus_admin' || profile?.role === 'super_admin';
  const isSuperAdmin = profile?.role === 'super_admin';

  useEffect(() => {
    // Attend que la session/le profil Supabase aient fini de charger avant de
    // juger de l'accès — sinon un admin légitime se fait rediriger pendant
    // le court instant où `profile` vaut encore null au premier rendu.
    if (loading) return;

    if (!profile || !isAdminRole) {
      setFlash({
        type: 'error',
        message: profile
          ? 'Accès restreint. Cette page est réservée aux administrateurs.'
          : 'Vous devez être connecté pour accéder au panneau d\'administration.',
      });
      navigate('/');
    }
  }, [loading, profile, isAdminRole, navigate, setFlash]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="skeleton h-10 w-10 rounded-full" />
      </div>
    );
  }

  if (!profile || !isAdminRole) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="skeleton h-10 w-10 rounded-full" />
      </div>
    );
  }

  const allTabs: { key: AdminTab; label: string; icon: typeof LayoutDashboard; superAdminOnly?: boolean }[] = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
    { key: 'campuses', label: 'Campus', icon: Building2 },
    { key: 'financial', label: 'Finances', icon: DollarSign, superAdminOnly: true },
    { key: 'moderation', label: 'Modération', icon: Shield },
    { key: 'team', label: 'Équipe & Modération', icon: Users, superAdminOnly: true },
    { key: 'users', label: 'Utilisateurs', icon: UserCog, superAdminOnly: true },
    { key: 'meeting-points', label: 'Points de rendez-vous', icon: MapPin, superAdminOnly: true },
    { key: 'referrals', label: 'Parrainage', icon: Gift, superAdminOnly: true },
    { key: 'settings', label: 'Paramètres', icon: Settings, superAdminOnly: true },
    { key: 'ads', label: 'Publicités', icon: ImageIcon },
  ];
  const tabs = allTabs.filter((t) => !t.superAdminOnly || isSuperAdmin);

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">Panneau d'administration</h1>

      {/* Tab nav */}
      <div className="mb-6 flex max-w-full flex-nowrap gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === t.key ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {msg && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{msg}</div>}

      {tab === 'overview' && <OverviewTab campuses={campuses} isSuperAdmin={isSuperAdmin} campusId={profile.campus_id} />}
      {tab === 'campuses' && <CampusesTab setError={setError} setMsg={setMsg} refresh={refreshCampuses} isSuperAdmin={isSuperAdmin} />}
      {tab === 'financial' && isSuperAdmin && <FinancialTab />}
      {tab === 'moderation' && <ModerationTab setError={setError} setMsg={setMsg} isSuperAdmin={isSuperAdmin} campusId={profile.campus_id} />}
      {tab === 'team' && isSuperAdmin && <TeamTab setError={setError} setMsg={setMsg} />}
      {tab === 'users' && isSuperAdmin && <UsersTab setError={setError} setMsg={setMsg} />}
      {tab === 'meeting-points' && isSuperAdmin && <MeetingPointsAdminTab setError={setError} setMsg={setMsg} />}
      {tab === 'referrals' && isSuperAdmin && <ReferralsAdminTab setError={setError} setMsg={setMsg} />}
      {tab === 'settings' && isSuperAdmin && <SettingsTab setError={setError} setMsg={setMsg} refresh={refreshSettings} />}
      {tab === 'ads' && <AdsTab setError={setError} setMsg={setMsg} isSuperAdmin={isSuperAdmin} campusId={profile.campus_id} />}
    </div>
  );
}

// ============================================================
// OVERVIEW
// ============================================================
function OverviewTab({ campuses, isSuperAdmin, campusId }: { campuses: Campus[]; isSuperAdmin: boolean; campusId: string | null }) {
  const [stats, setStats] = useState({ listings: 0, orders: 0, users: 0, escrowBalance: 0, pendingReports: 0, pendingShops: 0 });
  const displayedCampuses = isSuperAdmin ? campuses : campuses.filter((c) => c.id === campusId);

  useEffect(() => {
    (async () => {
      let listingsQ = supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active');
      let ordersQ = supabase.from('orders').select('*', { count: 'exact', head: true });
      let usersQ = supabase.from('profiles').select('*', { count: 'exact', head: true });
      let shopsQ = supabase.from('shops').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending');

      if (!isSuperAdmin && campusId) {
        listingsQ = listingsQ.eq('campus_id', campusId);
        ordersQ = ordersQ.eq('campus_id', campusId);
        usersQ = usersQ.eq('campus_id', campusId);
        shopsQ = shopsQ.eq('campus_id', campusId);
      }

      const [l, o, u, s] = await Promise.all([listingsQ, ordersQ, usersQ, shopsQ]);

      // Signalements et solde séquestre sont des vues globales/financières —
      // réservées au super_admin (cohérent avec les onglets Finances/Modération).
      let pendingReports = 0;
      let escrowBalance = 0;
      if (isSuperAdmin) {
        const { count: r } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open');
        const { data: lockTxns } = await supabase.from('transactions').select('amount_usd').eq('type', 'escrow_lock');
        const { data: releaseTxns } = await supabase.from('transactions').select('amount_usd').eq('type', 'payout');
        const locked = (lockTxns || []).reduce((sum, t) => sum + Number(t.amount_usd), 0);
        const released = (releaseTxns || []).reduce((sum, t) => sum + Number(t.amount_usd), 0);
        pendingReports = r || 0;
        escrowBalance = locked - released;
      }

      setStats({
        listings: l.count || 0,
        orders: o.count || 0,
        users: u.count || 0,
        escrowBalance,
        pendingReports,
        pendingShops: s.count || 0,
      });
    })();
  }, [isSuperAdmin, campusId]);

  const statCards = [
    { label: 'Annonces actives', value: stats.listings, icon: TrendingUp, color: 'text-blue-400' },
    { label: 'Commandes totales', value: stats.orders, icon: Wallet, color: 'text-emerald-400' },
    { label: 'Utilisateurs', value: stats.users, icon: Users, color: 'text-purple-400' },
    ...(isSuperAdmin
      ? [
          { label: 'Solde séquestre', value: formatUSD(stats.escrowBalance), icon: DollarSign, color: 'text-amber-400' },
          { label: 'Signalements', value: stats.pendingReports, icon: Flag, color: 'text-red-400' },
        ]
      : []),
    { label: 'Boutiques en attente', value: stats.pendingShops, icon: Building2, color: 'text-cyan-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <GlassCard key={stat.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-xl font-bold">{stat.value}</div>
                  <div className="text-xs text-white/40">{stat.label}</div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">{isSuperAdmin ? 'Campus actifs' : 'Votre campus'}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {displayedCampuses.map((c) => {
            const Icon = getCampusIcon(c.icon_name);
            return (
              <GlassCard key={c.id} className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${c.primary_color}25` }}>
                  <Icon className="h-5 w-5" style={{ color: c.accent_color }} />
                </div>
                <div className="truncate">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-white/40">{c.city}</div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CAMPUSES
// ============================================================
function CampusesTab({ setError, setMsg, refresh, isSuperAdmin }: { setError: (s: string | null) => void; setMsg: (s: string | null) => void; refresh: () => Promise<void>; isSuperAdmin: boolean }) {
  const { campuses } = useCampus();
  const { profile } = useAuth();
  const [campusSubTab, setCampusSubTab] = useState<'list' | 'requests'>('list');
  const [requests, setRequests] = useState<CampusRequest[]>([]);
  const [editing, setEditing] = useState<Campus | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [hubs, setHubs] = useState<CampusHub[]>([]);
  const [showHubForm, setShowHubForm] = useState(false);
  const [newHub, setNewHub] = useState({ name: '', description: '' });
  const [form, setForm] = useState({ name: '', slug: '', city: 'Kinshasa', primary_color: '#2563eb', secondary_color: '#0ea5e9', accent_color: '#22d3ee', icon_name: 'GraduationCap' });

  const loadRequests = useCallback(async () => {
    const { data } = await supabase
      .from('campus_requests')
      .select('*, requester:profiles!campus_requests_requested_by_fkey(*)')
      .order('created_at', { ascending: false });
    setRequests((data as CampusRequest[]) || []);
  }, []);

  useEffect(() => {
    if (isSuperAdmin && campusSubTab === 'requests') loadRequests();
  }, [isSuperAdmin, campusSubTab, loadRequests]);

  const approveRequest = async (id: string) => {
    const { error: err } = await supabase.rpc('approve_campus_request', { request_id: id });
    if (err) { setError(err.message); return; }
    setMsg('Campus créé à partir de la demande');
    loadRequests();
    refresh();
  };

  const rejectRequest = async (id: string) => {
    const { error: err } = await supabase
      .from('campus_requests')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (err) { setError(err.message); return; }
    setMsg('Demande rejetée');
    loadRequests();
  };

  const loadHubs = useCallback(async (campusId: string) => {
    const { data } = await supabase.from('campus_hubs').select('*').eq('campus_id', campusId).order('sort_order');
    setHubs((data as CampusHub[]) || []);
  }, []);

  const startEdit = (campus: Campus) => {
    setEditing(campus);
    setForm({
      name: campus.name, slug: campus.slug, city: campus.city,
      primary_color: campus.primary_color, secondary_color: campus.secondary_color,
      accent_color: campus.accent_color, icon_name: campus.icon_name,
    });
    setShowForm(true);
    loadHubs(campus.id);
  };

  const save = async () => {
    setError(null);
    const parsed = campusSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message); return; }
    const data = { ...parsed.data, slug: parsed.data.slug || slugify(parsed.data.name) };
    if (editing) {
      const { error: err } = await supabase.from('campuses').update(data).eq('id', editing.id);
      if (err) { setError(err.message); return; }
      setMsg('Campus mis à jour');
    } else {
      const { error: err } = await supabase.from('campuses').insert(data);
      if (err) { setError(err.message); return; }
      setMsg('Campus créé');
    }
    setShowForm(false);
    setEditing(null);
    refresh();
  };

  const addHub = async () => {
    if (!editing || !newHub.name) return;
    const parsed = hubSchema.safeParse({ campus_id: editing.id, name: newHub.name, description: newHub.description });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message); return; }
    const { error: err } = await supabase.from('campus_hubs').insert(parsed.data);
    if (err) { setError(err.message); return; }
    setNewHub({ name: '', description: '' });
    setShowHubForm(false);
    loadHubs(editing.id);
    setMsg('Point de rendez-vous ajouté');
  };

  const deleteHub = async (hubId: string) => {
    const { error: err } = await supabase.from('campus_hubs').delete().eq('id', hubId);
    if (err) { setError(err.message); return; }
    if (editing) loadHubs(editing.id);
  };

  const iconOptions = ['GraduationCap', 'BookOpen', 'Landmark', 'Building2', 'Library', 'School', 'Award', 'Trophy', 'Star', 'Users', 'FlaskConical', 'Microscope', 'Palette'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Gestion des campus</h2>
          {isSuperAdmin && (
            <div className="flex gap-1 rounded-lg bg-white/5 p-1">
              <button onClick={() => setCampusSubTab('list')} className={`rounded-md px-2.5 py-1 text-xs font-medium ${campusSubTab === 'list' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Campus</button>
              <button onClick={() => setCampusSubTab('requests')} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${campusSubTab === 'requests' ? 'bg-white/10 text-white' : 'text-white/50'}`}>
                Demandes
                {requests.filter((r) => r.status === 'pending').length > 0 && (
                  <span className="rounded-full bg-amber-500/80 px-1.5 text-[10px] font-bold text-white">{requests.filter((r) => r.status === 'pending').length}</span>
                )}
              </button>
            </div>
          )}
        </div>
        {isSuperAdmin && campusSubTab === 'list' && (
          <button onClick={() => { setEditing(null); setShowForm(true); setForm({ name: '', slug: '', city: 'Kinshasa', primary_color: '#2563eb', secondary_color: '#0ea5e9', accent_color: '#22d3ee', icon_name: 'GraduationCap' }); }} className="campus-gradient flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> Nouveau campus
          </button>
        )}
      </div>

      {campusSubTab === 'requests' ? (
        <div className="space-y-2">
          {requests.length === 0 ? (
            <p className="text-sm text-white/40">Aucune demande</p>
          ) : (
            requests.map((r) => (
              <GlassCard key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{r.university_name}</div>
                    <div className="text-xs text-white/40">{r.city} · demandé par {r.requester?.full_name || '—'}</div>
                    <div className="text-xs text-white/40">Contact : {r.contact_info}</div>
                  </div>
                  <span className={`flex-shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
                    r.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                    r.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {r.status}
                  </span>
                </div>
                {r.suggested_meeting_points?.length > 0 && (
                  <div className="mt-2 text-xs text-white/50">
                    Points suggérés : {r.suggested_meeting_points.map((p) => p.name).join(', ')}
                  </div>
                )}
                {r.status === 'pending' && (
                  <div className="mt-3 flex gap-1.5">
                    <button onClick={() => approveRequest(r.id)} className="rounded-lg bg-emerald-500/80 px-2.5 py-1.5 text-xs font-semibold text-white">
                      Approuver (crée le campus)
                    </button>
                    <button onClick={() => rejectRequest(r.id)} className="rounded-lg bg-red-500/80 px-2.5 py-1.5 text-xs font-semibold text-white">
                      Rejeter
                    </button>
                  </div>
                )}
              </GlassCard>
            ))
          )}
        </div>
      ) : (
        <>
      {showForm && (
        <GlassCard className="p-5" strong>
          <h3 className="mb-4 text-sm font-semibold">{editing ? 'Modifier' : 'Créer'} un campus</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="text" placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30" />
            <input type="text" placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30" />
            <input type="text" placeholder="Ville" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30" />
            <select value={form.icon_name} onChange={(e) => setForm({ ...form, icon_name: e.target.value })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none">
              {iconOptions.map((ic) => <option key={ic} value={ic} className="bg-gray-900">{ic}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/50">Primaire</label>
              <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="h-8 w-12 rounded border border-white/10 bg-transparent" />
              <span className="text-xs text-white/40">{form.primary_color}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/50">Secondaire</label>
              <input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} className="h-8 w-12 rounded border border-white/10 bg-transparent" />
              <span className="text-xs text-white/40">{form.secondary_color}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/50">Accent</label>
              <input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="h-8 w-12 rounded border border-white/10 bg-transparent" />
              <span className="text-xs text-white/40">{form.accent_color}</span>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={save} className="campus-gradient flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white"><Save className="h-4 w-4" /> Enregistrer</button>
            <button onClick={() => setShowForm(false)} className="glass rounded-lg px-4 py-2 text-sm">Annuler</button>
          </div>

          {/* Logo upload — only possible once the campus exists (id needed for the storage path) */}
          {editing && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <h4 className="mb-3 text-sm font-semibold">Logo de l'université</h4>
              <div className="flex items-center gap-4">
                <ImageUploader
                  bucket="campus-logos"
                  pathPrefix={editing.id}
                  currentUrl={editing.logo_url}
                  shape="square"
                  sizeClass="h-16 w-16"
                  fallbackLabel={editing.name.charAt(0)}
                  onUploaded={async (url) => {
                    const { error: err } = await supabase.from('campuses').update({ logo_url: url }).eq('id', editing.id);
                    if (err) { setError(err.message); return; }
                    setEditing({ ...editing, logo_url: url });
                    setMsg('Logo mis à jour');
                    refresh();
                  }}
                />
                <p className="text-xs text-white/40">PNG/JPG, 4 Mo max. Visible publiquement.</p>
              </div>
            </div>
          )}

          {/* Hubs management */}
          {editing && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Points de rendez-vous</h4>
                <button onClick={() => setShowHubForm((v) => !v)} className="flex items-center gap-1 text-xs campus-text"><Plus className="h-3 w-3" /> Ajouter</button>
              </div>
              {showHubForm && (
                <div className="mb-3 flex gap-2">
                  <input type="text" placeholder="Nom du point" value={newHub.name} onChange={(e) => setNewHub({ ...newHub, name: e.target.value })} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
                  <input type="text" placeholder="Description" value={newHub.description} onChange={(e) => setNewHub({ ...newHub, description: e.target.value })} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
                  <button onClick={addHub} className="campus-gradient rounded-lg px-3 py-2 text-sm font-semibold text-white">OK</button>
                </div>
              )}
              <div className="space-y-2">
                {hubs.map((hub) => (
                  <div key={hub.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm">
                    <div>
                      <span className="font-medium">{hub.name}</span>
                      {hub.description && <span className="ml-2 text-xs text-white/40">{hub.description}</span>}
                    </div>
                    <button onClick={() => deleteHub(hub.id)} className="text-red-400/60 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                {hubs.length === 0 && <p className="text-xs text-white/30">Aucun point de rendez-vous</p>}
              </div>
            </div>
          )}
        </GlassCard>
      )}

      <div className="space-y-2">
        {campuses.map((c) => {
          const Icon = getCampusIcon(c.icon_name);
          return (
            <GlassCard key={c.id} className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${c.primary_color}25` }}>
                <Icon className="h-5 w-5" style={{ color: c.accent_color }} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs text-white/40">{c.city} · {c.slug}</div>
              </div>
              <div className="flex gap-1.5">
                <div className="h-6 w-6 rounded border border-white/10" style={{ backgroundColor: c.primary_color }} />
                <div className="h-6 w-6 rounded border border-white/10" style={{ backgroundColor: c.secondary_color }} />
                <div className="h-6 w-6 rounded border border-white/10" style={{ backgroundColor: c.accent_color }} />
              </div>
              {(isSuperAdmin || c.id === profile?.campus_id) && (
                <button onClick={() => startEdit(c)} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white"><Edit2 className="h-4 w-4" /></button>
              )}
            </GlassCard>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// FINANCIAL
// ============================================================
function FinancialTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [extraStats, setExtraStats] = useState({ totalSales: 0, completedOrders: 0, activeShops: 0 });

  const load = useCallback(async () => {
    let q = supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter !== 'all') q = q.eq('type', filter);
    const { data } = await q;
    setTransactions((data as Transaction[]) || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const { data: completed } = await supabase.from('orders').select('price_usd').eq('status', 'completed');
      const totalSales = (completed || []).reduce((sum, o) => sum + Number(o.price_usd), 0);
      const { count: activeShops } = await supabase
        .from('shops')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'approved')
        .eq('subscription_status', 'active');
      setExtraStats({ totalSales, completedOrders: completed?.length || 0, activeShops: activeShops || 0 });
    })();
  }, []);

  const totals = transactions.reduce((acc, t) => {
    if (t.type === 'escrow_lock') acc.locked += t.amount_usd;
    if (t.type === 'payout') acc.released += t.amount_usd;
    if (t.type === 'commission') acc.commission += t.amount_usd;
    if (t.type === 'refund') acc.refunded += t.amount_usd;
    return acc;
  }, { locked: 0, released: 0, commission: 0, refunded: 0 });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-4">
          <div className="text-xs text-white/40">Total des ventes</div>
          <div className="mt-1 text-xl font-bold text-white">{formatUSD(extraStats.totalSales)}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs text-white/40">Commissions perçues (6%)</div>
          <div className="mt-1 text-xl font-bold text-emerald-400">{formatUSD(totals.commission)}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs text-white/40">Commandes complétées</div>
          <div className="mt-1 text-xl font-bold text-white">{extraStats.completedOrders}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs text-white/40">Boutiques actives</div>
          <div className="mt-1 text-xl font-bold text-white">{extraStats.activeShops}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs text-white/40">Séquestre actuel</div>
          <div className="mt-1 text-xl font-bold text-amber-400">{formatUSD(totals.locked - totals.released - totals.refunded)}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs text-white/40">Versé aux vendeurs</div>
          <div className="mt-1 text-xl font-bold text-blue-400">{formatUSD(totals.released)}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs text-white/40">Remboursements</div>
          <div className="mt-1 text-xl font-bold text-red-400">{formatUSD(totals.refunded)}</div>
        </GlassCard>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-white/70">Transactions récentes</h3>
      </div>

      <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto no-scrollbar">
        {['all', 'escrow_lock', 'payout', 'commission', 'refund', 'boost', 'badge', 'urgent'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${filter === f ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'}`}>
            {f === 'all' ? 'Tous' : f}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-white/40">Chargement...</p> : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <GlassCard key={t.id} className="flex items-center justify-between p-3">
              <div>
                <div className="text-sm font-medium">{t.description || t.type}</div>
                <div className="text-xs text-white/40">{t.type} · {new Date(t.created_at).toLocaleString('fr-FR')}</div>
              </div>
              <div className={`text-sm font-bold ${t.type === 'commission' || t.type === 'boost' || t.type === 'badge' || t.type === 'urgent' ? 'text-emerald-400' : 'text-white/70'}`}>
                {formatUSD(t.amount_usd)}
              </div>
            </GlassCard>
          ))}
          {transactions.length === 0 && <p className="text-sm text-white/40">Aucune transaction</p>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MODERATION
// ============================================================
function ModerationTab({
  setError, setMsg, isSuperAdmin, campusId,
}: {
  setError: (s: string | null) => void; setMsg: (s: string | null) => void; isSuperAdmin: boolean; campusId: string | null;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [blacklist, setBlacklist] = useState<PhoneBlacklist[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [disputes, setDisputes] = useState<Order[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [subTab, setSubTab] = useState<'reports' | 'blacklist' | 'shops' | 'disputes' | 'listings'>(isSuperAdmin ? 'reports' : 'shops');
  const [newPhone, setNewPhone] = useState('');
  const [durationDrafts, setDurationDrafts] = useState<Record<string, number>>({});
  const [expandedChat, setExpandedChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ id: string; sender_id: string; content: string; created_at: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const scopedShops = isSuperAdmin ? shops : shops.filter((s) => s.campus_id === campusId);

  const loadReports = useCallback(async () => {
    const { data } = await supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(*)').order('created_at', { ascending: false });
    setReports((data as Report[]) || []);
  }, []);
  const loadBlacklist = useCallback(async () => {
    const { data } = await supabase.from('phone_blacklist').select('*').order('created_at', { ascending: false });
    setBlacklist((data as PhoneBlacklist[]) || []);
  }, []);
  const loadShops = useCallback(async () => {
    const { data } = await supabase.from('shops').select('*').order('created_at', { ascending: false });
    setShops((data as Shop[]) || []);
  }, []);
  const loadDisputes = useCallback(async () => {
    if (!isSuperAdmin) return;
    const { data } = await supabase
      .from('orders')
      .select(`
        id, buyer_id, seller_id, listing_id, shop_id, campus_id, hub_id,
        price_usd, commission_rate, commission_usd, seller_payout_usd, status,
        escrow_revealed_at, production_notes, reference_image_urls, is_custom,
        paid_at, delivered_at, completed_at, disputed_at, dispute_reason,
        created_at, updated_at,
        listing:listings(*), buyer:profiles!orders_buyer_id_fkey(*), seller:profiles!orders_seller_id_fkey(*)
      `)
      .eq('status', 'disputed')
      .order('disputed_at', { ascending: false });
    setDisputes((data as unknown as Order[]) || []);
  }, [isSuperAdmin]);

  const loadListings = useCallback(async () => {
    let q = supabase.from('listings').select('*').order('created_at', { ascending: false }).limit(60);
    if (!isSuperAdmin && campusId) q = q.eq('campus_id', campusId);
    const { data } = await q;
    setListings((data as Listing[]) || []);
  }, [isSuperAdmin, campusId]);

  useEffect(() => { loadReports(); loadBlacklist(); loadShops(); loadDisputes(); loadListings(); }, [loadReports, loadBlacklist, loadShops, loadDisputes, loadListings]);

  const resolveReport = async (id: string, status: string) => {
    const { error: err } = await supabase.from('reports').update({ status }).eq('id', id);
    if (err) { setError(err.message); return; }
    setMsg('Signalement ' + (status === 'resolved' ? 'résolu' : 'ignoré'));
    loadReports();
  };

  const addBlacklist = async () => {
    if (!newPhone) return;
    const { error: err } = await supabase.from('phone_blacklist').insert({ phone: newPhone, reason: 'Ajouté par admin' });
    if (err) { setError(err.message); return; }
    setNewPhone('');
    setMsg('Numéro banni');
    loadBlacklist();
  };

  const removeBlacklist = async (id: string) => {
    const { error: err } = await supabase.from('phone_blacklist').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    loadBlacklist();
  };

  const approveShop = async (id: string, status: string) => {
    const { error: err } = await supabase.rpc('admin_moderate_shop_approval', { p_shop_id: id, p_status: status });
    if (err) { setError(err.message); return; }
    setMsg(status === 'approved' ? 'Boutique approuvée' : 'Boutique rejetée');
    loadShops();
  };

  const deleteShop = async (id: string, name: string) => {
    if (!window.confirm(`Supprimer définitivement la boutique "${name}" ? Ses annonces resteront mais ne seront plus rattachées à une boutique.`)) return;
    const { error: err } = await supabase.from('shops').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    setMsg('Boutique supprimée');
    loadShops();
  };

  const resolveDispute = async (orderId: string, resolution: 'complete' | 'refund') => {
    const fn = resolution === 'complete' ? 'admin_resolve_dispute_complete' : 'admin_resolve_dispute_refund';
    const { error: err } = await supabase.rpc(fn, { order_id: orderId });
    if (err) { setError(err.message); return; }
    setMsg(resolution === 'complete' ? 'Commande finalisée en faveur du vendeur' : 'Commande annulée, acheteur remboursé');
    loadDisputes();
  };

  const toggleChatHistory = async (orderId: string) => {
    if (expandedChat === orderId) { setExpandedChat(null); return; }
    setExpandedChat(orderId);
    setChatLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, content, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    setChatMessages(data || []);
    setChatLoading(false);
  };

  const moderateListing = async (id: string, status: 'active' | 'paused' | 'rejected') => {
    const { error: err } = await supabase.rpc('admin_update_listing', { p_listing_id: id, p_status: status });
    if (err) { setError(err.message); return; }
    setMsg(status === 'active' ? 'Annonce réactivée' : status === 'paused' ? 'Annonce suspendue' : 'Annonce rejetée');
    loadListings();
  };

  const deleteListing = async (id: string, title: string) => {
    if (!window.confirm(`Supprimer définitivement l'annonce "${title}" ?`)) return;
    const { error: err } = await supabase.from('listings').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    setMsg('Annonce supprimée');
    loadListings();
  };

  const setSubscription = async (shopId: string, status: string, rentExpiresAtIso?: string) => {
    const { error: err } = await supabase.rpc('set_shop_subscription', {
      p_shop_id: shopId,
      p_status: status,
      p_rent_expires_at: rentExpiresAtIso ?? null,
    });
    if (err) { setError(err.message); return; }
    setMsg('Abonnement mis à jour');
    loadShops();
  };

  const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  };

  const activateWithDuration = (shop: Shop, months: number) => {
    const expiry = addMonths(new Date(), months);
    setSubscription(shop.id, 'active', expiry.toISOString());
  };

  const renewOneMonth = (shop: Shop) => {
    const base = shop.rent_expires_at && new Date(shop.rent_expires_at) > new Date() ? new Date(shop.rent_expires_at) : new Date();
    setSubscription(shop.id, 'active', addMonths(base, 1).toISOString());
  };

  const DURATIONS = [
    { label: '1 mois', months: 1 },
    { label: '3 mois', months: 3 },
    { label: '6 mois', months: 6 },
    { label: '1 an', months: 12 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex max-w-full flex-nowrap gap-1 overflow-x-auto no-scrollbar">
        {isSuperAdmin && (
          <>
            <button onClick={() => setSubTab('reports')} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${subTab === 'reports' ? 'bg-white/10 text-white' : 'text-white/50'}`}><Flag className="h-4 w-4" /> Signalements</button>
            <button onClick={() => setSubTab('blacklist')} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${subTab === 'blacklist' ? 'bg-white/10 text-white' : 'text-white/50'}`}><Ban className="h-4 w-4" /> Blacklist</button>
            <button onClick={() => setSubTab('disputes')} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${subTab === 'disputes' ? 'bg-white/10 text-white' : 'text-white/50'}`}>
              <AlertTriangle className="h-4 w-4" /> Litiges
              {disputes.length > 0 && <span className="rounded-full bg-red-500/80 px-1.5 text-[10px] font-bold text-white">{disputes.length}</span>}
            </button>
            <button onClick={() => setSubTab('listings')} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${subTab === 'listings' ? 'bg-white/10 text-white' : 'text-white/50'}`}><Package className="h-4 w-4" /> Annonces</button>
          </>
        )}
        <button onClick={() => setSubTab('shops')} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${subTab === 'shops' ? 'bg-white/10 text-white' : 'text-white/50'}`}><Building2 className="h-4 w-4" /> Boutiques</button>
      </div>

      {subTab === 'disputes' && isSuperAdmin && (
        <div className="space-y-3">
          {disputes.length === 0 ? (
            <p className="text-sm text-white/40">Aucun litige en cours</p>
          ) : disputes.map((o) => (
            <GlassCard key={o.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{o.listing?.title || 'Annonce supprimée'}</div>
                  <div className="mt-0.5 text-xs text-white/40">{formatUSD(o.price_usd)} · ouvert {new Date(o.disputed_at || o.created_at).toLocaleString('fr-FR')}</div>
                </div>
                <span className="flex-shrink-0 rounded-md bg-red-500/20 px-2 py-1 text-xs font-bold text-red-300">LITIGE</span>
              </div>

              {/* Cartes des deux parties */}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 p-2.5">
                  {o.buyer?.avatar_url ? (
                    <img src={o.buyer.avatar_url} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">{o.buyer?.full_name?.charAt(0) || '?'}</div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-white/30">Acheteur</div>
                    <div className="truncate text-sm">{o.buyer?.full_name || '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 p-2.5">
                  {o.seller?.avatar_url ? (
                    <img src={o.seller.avatar_url} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">{o.seller?.full_name?.charAt(0) || '?'}</div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-white/30">Vendeur</div>
                    <div className="truncate text-sm">{o.seller?.full_name || '—'}</div>
                  </div>
                </div>
              </div>

              {o.dispute_reason && (
                <p className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white/70">{o.dispute_reason}</p>
              )}

              <button
                onClick={() => toggleChatHistory(o.id)}
                className="mt-2 flex items-center gap-1.5 text-xs text-white/40 hover:text-white"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {expandedChat === o.id ? 'Masquer la conversation' : 'Voir la conversation'}
              </button>

              {expandedChat === o.id && (
                <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2.5">
                  {chatLoading ? (
                    <p className="text-xs text-white/30">Chargement...</p>
                  ) : chatMessages.length === 0 ? (
                    <p className="text-xs text-white/30">Aucun message échangé.</p>
                  ) : (
                    chatMessages.map((m) => (
                      <div key={m.id} className={`text-xs ${m.sender_id === o.buyer_id ? 'text-blue-300' : 'text-emerald-300'}`}>
                        <span className="font-semibold">{m.sender_id === o.buyer_id ? o.buyer?.full_name || 'Acheteur' : o.seller?.full_name || 'Vendeur'} :</span>{' '}
                        <span className="text-white/70">{m.content}</span>
                        <span className="ml-1.5 text-white/20">{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                <button onClick={() => resolveDispute(o.id, 'refund')} className="rounded-lg bg-orange-500/80 px-2.5 py-1.5 text-xs font-semibold text-white">
                  Rembourser l'acheteur
                </button>
                <button onClick={() => resolveDispute(o.id, 'complete')} className="rounded-lg bg-emerald-500/80 px-2.5 py-1.5 text-xs font-semibold text-white">
                  Payer le vendeur
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {subTab === 'listings' && isSuperAdmin && (
        <div className="space-y-2">
          {listings.length === 0 ? (
            <p className="text-sm text-white/40">Aucune annonce</p>
          ) : listings.map((l) => (
            <GlassCard key={l.id} className="flex items-center gap-3 p-3">
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-white/5">
                {l.image_urls?.[0] && <img src={l.image_urls[0]} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{l.title}</div>
                <div className="text-xs text-white/40">{formatUSD(l.price_usd)} · {l.status}</div>
              </div>
              <div className="flex flex-shrink-0 gap-1.5">
                {l.status !== 'paused' && (
                  <button onClick={() => moderateListing(l.id, 'paused')} className="rounded-lg p-2 text-white/40 hover:bg-orange-500/10 hover:text-orange-400" title="Suspendre">
                    <PauseCircle className="h-4 w-4" />
                  </button>
                )}
                {l.status !== 'active' && (
                  <button onClick={() => moderateListing(l.id, 'active')} className="rounded-lg p-2 text-white/40 hover:bg-emerald-500/10 hover:text-emerald-400" title="Réactiver">
                    <Check className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => deleteListing(l.id, l.title)} className="rounded-lg p-2 text-white/40 hover:bg-red-500/10 hover:text-red-400" title="Supprimer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {subTab === 'reports' && (
        <div className="space-y-2">
          {reports.length === 0 ? <p className="text-sm text-white/40">Aucun signalement</p> : reports.map((r) => (
            <GlassCard key={r.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold uppercase">{r.target_type}</span>
                    <span className={`text-xs ${r.status === 'open' ? 'text-red-400' : 'text-white/40'}`}>{r.status}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-white/70">{r.reason}</p>
                  <p className="mt-1 text-xs text-white/30">Par {r.reporter?.full_name || 'Anonyme'}</p>
                </div>
                {r.status === 'open' && (
                  <div className="flex gap-1.5">
                    <button onClick={() => resolveReport(r.id, 'resolved')} className="rounded-lg bg-emerald-500/80 px-2.5 py-1.5 text-xs font-semibold text-white"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => resolveReport(r.id, 'dismissed')} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {subTab === 'blacklist' && (
        <div className="space-y-3">
          <GlassCard className="flex gap-2 p-3">
            <input type="text" placeholder="Numéro à bannir" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
            <button onClick={addBlacklist} className="campus-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white">Bannir</button>
          </GlassCard>
          {blacklist.length === 0 ? <p className="text-sm text-white/40">Aucun numéro banni</p> : blacklist.map((b) => (
            <GlassCard key={b.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-mono text-sm">{b.phone}</div>
                <div className="text-xs text-white/40">{b.reason}</div>
              </div>
              <button onClick={() => removeBlacklist(b.id)} className="text-red-400/60 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </GlassCard>
          ))}
        </div>
      )}

      {subTab === 'shops' && (
        <div className="space-y-2">
          {scopedShops.length === 0 ? <p className="text-sm text-white/40">Aucune boutique</p> : scopedShops.map((s) => {
            const rentLabel = s.rent_expires_at ? new Date(s.rent_expires_at).toLocaleDateString('fr-FR') : null;
            const subBadge =
              s.subscription_status === 'active'
                ? { label: rentLabel ? `Actif — expire le ${rentLabel}` : 'Actif', className: 'bg-emerald-500/20 text-emerald-300' }
              : s.subscription_status === 'pending'
                ? { label: 'En attente', className: 'bg-amber-500/20 text-amber-300' }
                : { label: s.subscription_status === 'suspended' ? 'Suspendu' : 'Expiré', className: 'bg-red-500/20 text-red-300' };
            const selectedMonths = durationDrafts[s.id] || 1;
            return (
              <GlassCard key={s.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{s.name}</div>
                    <div className="text-xs text-white/40">{s.is_custom_shop ? 'Boutique créateur' : 'Boutique standard'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${s.approval_status === 'approved' ? 'text-emerald-400' : s.approval_status === 'pending' ? 'text-amber-400' : 'text-red-400'}`}>{s.approval_status}</span>
                    {s.approval_status === 'pending' && (
                      <>
                        <button onClick={() => approveShop(s.id, 'approved')} className="rounded-lg bg-emerald-500/80 px-2.5 py-1.5 text-xs font-semibold text-white">Approuver</button>
                        <button onClick={() => approveShop(s.id, 'rejected')} className="rounded-lg bg-red-500/80 px-2.5 py-1.5 text-xs font-semibold text-white">Rejeter</button>
                      </>
                    )}
                    {isSuperAdmin && (
                      <button onClick={() => deleteShop(s.id, s.name)} className="rounded-lg p-1.5 text-white/30 hover:bg-red-500/10 hover:text-red-400" title="Supprimer la boutique">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {s.approval_status === 'approved' && (
                  <div className="mt-3 space-y-2.5 border-t border-white/10 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${subBadge.className}`}>
                        {subBadge.label}
                      </span>
                      {!s.is_storefront_visible && (
                        <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-white/40">Vitrine masquée par le vendeur</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        value={selectedMonths}
                        onChange={(e) => setDurationDrafts({ ...durationDrafts, [s.id]: Number(e.target.value) })}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none"
                      >
                        {DURATIONS.map((d) => (
                          <option key={d.months} value={d.months} className="bg-gray-900">{d.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => activateWithDuration(s, selectedMonths)}
                        className="rounded-lg bg-emerald-500/80 px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        Activer
                      </button>
                      <button onClick={() => renewOneMonth(s)} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/15">
                        Renouveler (+1 mois)
                      </button>
                      <button onClick={() => setSubscription(s.id, 'suspended')} className="rounded-lg bg-orange-500/80 px-2.5 py-1.5 text-xs font-semibold text-white">
                        Suspendre
                      </button>
                      <button onClick={() => setSubscription(s.id, 'expired')} className="rounded-lg bg-red-500/80 px-2.5 py-1.5 text-xs font-semibold text-white">
                        Marquer expiré
                      </button>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ÉQUIPE & MODÉRATION (RBAC)
// ============================================================
const PERMISSION_LABELS: { key: AdminPermission; label: string; superAdminOnly?: boolean }[] = [
  { key: 'manage_products', label: 'Modération des annonces' },
  { key: 'manage_reviews', label: 'Modération des avis' },
  { key: 'handle_disputes', label: 'Gestion des litiges' },
  { key: 'manage_users', label: 'Gestion des utilisateurs' },
  { key: 'view_financials', label: 'Vue des métriques financières', superAdminOnly: true },
];

function TeamTab({ setError, setMsg }: { setError: (s: string | null) => void; setMsg: (s: string | null) => void }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'super_admin' | 'admin' | 'moderator'>('moderator');
  const [permissions, setPermissions] = useState<AdminPermission[]>(['manage_products', 'manage_reviews']);
  const [submitting, setSubmitting] = useState(false);
  // Action en attente de confirmation — changement de rôle ou retrait de grade.
  const [pendingAction, setPendingAction] = useState<
    { type: 'change'; member: AdminMember; newRole: 'super_admin' | 'admin' | 'moderator' } | { type: 'revoke'; member: AdminMember } | null
  >(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_members')
      .select('*, profile:profiles!admin_members_user_id_fkey(*)')
      .order('created_at', { ascending: false });
    setMembers((data as unknown as AdminMember[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const superAdminCount = members.filter((m) => m.role === 'super_admin').length;

  const togglePermission = (perm: AdminPermission) => {
    setPermissions((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));
  };

  const handlePromote = async () => {
    if (!email.trim()) { setError('Saisissez un email'); return; }
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.rpc('assign_admin_role', {
      target_email: email.trim(),
      role_name: role,
      // view_financials reste filtré côté serveur aussi si le rôle n'est pas super_admin.
      custom_permissions: role === 'super_admin' ? permissions : permissions.filter((p) => p !== 'view_financials'),
    });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    setMsg(`${email.trim()} a été promu ${role}`);
    setEmail('');
    setPermissions(['manage_products', 'manage_reviews']);
    load();
  };

  // Les deux actions sensibles (changer un rôle, retirer un grade) passent
  // par la même confirmation avant d'atteindre la base — jamais déclenchées
  // directement au clic.
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    setError(null);
    setConfirming(true);
    const { error: err } =
      pendingAction.type === 'change'
        ? await supabase.rpc('update_admin_role', { target_user_id: pendingAction.member.user_id, role_name: pendingAction.newRole })
        : await supabase.rpc('revoke_admin_role', { target_user_id: pendingAction.member.user_id });
    setConfirming(false);
    if (err) { setError(err.message); setPendingAction(null); return; }
    setMsg(pendingAction.type === 'change' ? 'Rôle mis à jour' : 'Grade retiré');
    setPendingAction(null);
    load();
  };

  return (
    <div className="space-y-4">
      <GlassCard className="p-5" strong>
        <h3 className="mb-4 text-sm font-semibold">Promouvoir un membre du staff</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs text-white/50">Email de l'utilisateur (déjà inscrit)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="utilisateur@exemple.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-white/50">Rôle</label>
            <div className="flex gap-1.5">
              {(['moderator', 'admin', 'super_admin'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${role === r ? 'campus-gradient text-white' : 'bg-white/5 text-white/50'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-white/50">Permissions</label>
            <div className="space-y-1.5">
              {PERMISSION_LABELS.map((p) => {
                const disabled = p.superAdminOnly && role !== 'super_admin';
                return (
                  <label key={p.key} className={`flex items-center gap-2 text-sm ${disabled ? 'text-white/20' : 'text-white/70'}`}>
                    <input
                      type="checkbox"
                      checked={disabled ? false : permissions.includes(p.key)}
                      disabled={disabled}
                      onChange={() => togglePermission(p.key)}
                      className="rounded border-white/20 bg-white/5"
                    />
                    {p.label}
                    {p.superAdminOnly && <span className="text-[10px] text-white/30">(Super Admin uniquement)</span>}
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handlePromote}
            disabled={submitting}
            className="campus-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Promotion...' : 'Promouvoir'}
          </button>
        </div>
      </GlassCard>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-white/70">Membres du staff</h3>
        {loading ? (
          <p className="text-sm text-white/40">Chargement...</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-white/40">Aucun membre pour le moment</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const isSelf = m.user_id === user?.id;
              // Dernier super_admin visible dans cette liste : on désactive
              // aussi préventivement côté UI, même si la vraie garantie est
              // côté serveur (le comptage y porte sur profiles, plus fiable).
              const isLastSuperAdmin = m.role === 'super_admin' && superAdminCount <= 1;
              const locked = isSelf || isLastSuperAdmin;
              return (
                <GlassCard key={m.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        {m.profile?.full_name || '—'}
                        {isSelf && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
                            Vous
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/40">{m.role}</div>
                    </div>
                    {!isSelf && (
                      <button
                        onClick={() => setPendingAction({ type: 'revoke', member: m })}
                        disabled={isLastSuperAdmin}
                        title={isLastSuperAdmin ? 'Impossible : dernier super_admin du système' : undefined}
                        className="flex-shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Retirer le grade
                      </button>
                    )}
                  </div>

                  {/* Sélecteur de rôle en place — désactivé pour soi-même et
                      pour le dernier super_admin restant. */}
                  <div className="mt-2 flex gap-1.5">
                    {(['moderator', 'admin', 'super_admin'] as const).map((r) => (
                      <button
                        key={r}
                        disabled={locked || r === m.role}
                        onClick={() => setPendingAction({ type: 'change', member: m, newRole: r })}
                        title={isSelf ? 'Vous ne pouvez pas modifier votre propre rôle' : isLastSuperAdmin ? 'Impossible : dernier super_admin du système' : undefined}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                          r === m.role
                            ? 'campus-gradient text-white'
                            : 'bg-white/5 text-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white/5'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.permissions.length === 0 ? (
                      <span className="text-xs text-white/30">Aucune permission</span>
                    ) : (
                      m.permissions.map((p) => (
                        <span key={p} className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-white/60">
                          {PERMISSION_LABELS.find((pl) => pl.key === p)?.label || p}
                        </span>
                      ))
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation — changer un rôle ou retirer un grade ne s'applique
          jamais directement au clic. */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !confirming && setPendingAction(null)} />
          <div className="glass-strong relative z-10 w-full max-w-sm rounded-2xl border border-amber-500/20 p-6 shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <h3 className="text-center text-base font-bold">Confirmer l'action</h3>
            <p className="mt-2 text-center text-sm text-white/60">
              {pendingAction.type === 'change' ? (
                <>Attention ! Changer le rôle d'un membre peut modifier ses autorisations et l'accès aux données financières.</>
              ) : (
                <>Retirer le grade de <strong>{pendingAction.member.profile?.full_name || 'ce membre'}</strong> supprimera immédiatement tous ses accès admin.</>
              )}
            </p>
            {pendingAction.type === 'change' && (
              <p className="mt-2 text-center text-xs text-white/40">
                {pendingAction.member.profile?.full_name || 'Ce membre'} : {pendingAction.member.role} → {pendingAction.newRole}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPendingAction(null)}
                disabled={confirming}
                className="glass flex-1 rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmPendingAction}
                disabled={confirming}
                className="flex-1 rounded-lg bg-amber-500/90 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
              >
                {confirming ? 'Confirmation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}

// ============================================================
// UTILISATEURS (Super Admin)
// ============================================================
function UsersTab({ setError, setMsg }: { setError: (s: string | null) => void; setMsg: (s: string | null) => void }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'campus_admin' | 'super_admin'>('all');
  const [pendingAction, setPendingAction] = useState<
    { type: 'role'; target: AdminUser; newRole: 'user' | 'campus_admin' } | { type: 'status'; target: AdminUser; suspend: boolean } | null
  >(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('get_all_users');
    if (err) {
      setError(err.message);
    } else {
      setUsers((data as AdminUser[]) || []);
    }
    setLoading(false);
  }, [setError]);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter((u) => {
    const matchesSearch =
      !search.trim() ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    setError(null);
    setConfirming(true);
    const { error: err } =
      pendingAction.type === 'role'
        ? await supabase.rpc('update_user_role', { target_user_id: pendingAction.target.id, new_role: pendingAction.newRole })
        : await supabase.rpc('toggle_user_status', { target_user_id: pendingAction.target.id, is_suspended: pendingAction.suspend });
    setConfirming(false);
    if (err) { setError(err.message); setPendingAction(null); return; }
    setMsg(pendingAction.type === 'role' ? 'Rôle mis à jour' : pendingAction.suspend ? 'Compte suspendu' : 'Compte réactivé');
    setPendingAction(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Utilisateurs <span className="text-sm font-normal text-white/40">({users.length} inscrits)</span>
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm outline-none focus:border-white/30"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {(['all', 'user', 'campus_admin', 'super_admin'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${roleFilter === r ? 'bg-white/10 text-white' : 'text-white/50'}`}
            >
              {r === 'all' ? 'Tous' : r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-white/40">Chargement...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-white/40">Aucun utilisateur ne correspond</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const isSelf = u.id === currentUser?.id;
            return (
              <GlassCard key={u.id} className="p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
                        {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">{u.full_name || 'Sans nom'}</span>
                        {isSelf && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/50">Vous</span>}
                      </div>
                      <div className="truncate text-xs text-white/40">{u.email}</div>
                      <div className="text-[11px] text-white/30">
                        Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')}
                        {u.last_sign_in_at && ` · vu le ${new Date(u.last_sign_in_at).toLocaleDateString('fr-FR')}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
                    <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                      u.role === 'super_admin' ? 'bg-cyan-500/20 text-cyan-300' :
                      u.role === 'campus_admin' ? 'bg-emerald-500/20 text-emerald-300' :
                      'bg-white/10 text-white/50'
                    }`}>
                      {u.role}
                    </span>
                    {u.is_suspended && (
                      <span className="rounded-md bg-red-500/20 px-2 py-1 text-[11px] font-bold text-red-300">Suspendu</span>
                    )}

                    {!isSelf && u.role !== 'super_admin' && (
                      <>
                        {u.role === 'user' ? (
                          <button
                            onClick={() => setPendingAction({ type: 'role', target: u, newRole: 'campus_admin' })}
                            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/15"
                          >
                            Promouvoir Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => setPendingAction({ type: 'role', target: u, newRole: 'user' })}
                            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/15"
                          >
                            Rétrograder
                          </button>
                        )}
                        <button
                          onClick={() => setPendingAction({ type: 'status', target: u, suspend: !u.is_suspended })}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                            u.is_suspended ? 'bg-emerald-500/80 text-white' : 'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                          }`}
                        >
                          <ShieldOff className="h-3 w-3" /> {u.is_suspended ? 'Réactiver' : 'Suspendre'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !confirming && setPendingAction(null)} />
          <div className="glass-strong relative z-10 w-full max-w-sm rounded-2xl border border-amber-500/20 p-6 shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <h3 className="text-center text-base font-bold">Confirmer l'action</h3>
            <p className="mt-2 text-center text-sm text-white/60">
              {pendingAction.type === 'role' ? (
                <>Changer le rôle de <strong>{pendingAction.target.full_name || pendingAction.target.email}</strong> modifie ses accès sur la plateforme.</>
              ) : pendingAction.suspend ? (
                <>Suspendre <strong>{pendingAction.target.full_name || pendingAction.target.email}</strong> l'empêchera immédiatement de se connecter.</>
              ) : (
                <>Réactiver <strong>{pendingAction.target.full_name || pendingAction.target.email}</strong> lui rendra l'accès à son compte.</>
              )}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPendingAction(null)}
                disabled={confirming}
                className="glass flex-1 rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmPendingAction}
                disabled={confirming}
                className="flex-1 rounded-lg bg-amber-500/90 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
              >
                {confirming ? 'Confirmation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// POINTS DE RENDEZ-VOUS (propositions à approuver/rejeter)
// ============================================================
function MeetingPointsAdminTab({ setError, setMsg }: { setError: (s: string | null) => void; setMsg: (s: string | null) => void }) {
  const [suggestions, setSuggestions] = useState<MeetingPointSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('meeting_point_suggestions_with_votes')
      .select('*')
      .order('vote_count', { ascending: false });
    setSuggestions((data as MeetingPointSuggestion[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = suggestions.filter((s) => s.status === filter);

  const handleDecision = async (id: string, decision: 'approve' | 'reject') => {
    setBusyId(id);
    setError(null);
    const { error: err } = await supabase.rpc(
      decision === 'approve' ? 'approve_meeting_point_suggestion' : 'reject_meeting_point_suggestion',
      { suggestion_id: id }
    );
    setBusyId(null);
    if (err) { setError(err.message); return; }
    setMsg(decision === 'approve' ? 'Point de rendez-vous approuvé et ajouté au campus' : 'Proposition rejetée');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 rounded-lg bg-white/5 p-1">
        {(['pending', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${filter === f ? 'bg-white/10 text-white' : 'text-white/50'}`}
          >
            {f === 'pending' ? 'En attente' : f === 'approved' ? 'Approuvés' : 'Rejetés'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-white/40">Chargement...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-white/40">Aucune proposition {filter === 'pending' ? 'en attente' : filter === 'approved' ? 'approuvée' : 'rejetée'}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <GlassCard key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{s.name}</h3>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-white/40">
                    <MapPin className="h-3 w-3" /> {s.campus_name}
                  </div>
                  {s.description && <p className="mt-1.5 text-sm text-white/60">{s.description}</p>}
                  <p className="mt-1.5 text-[11px] text-white/30">Proposé par {s.proposed_by_name}</p>
                </div>
                <div className="flex flex-shrink-0 flex-col items-center gap-1">
                  <span className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold">
                    <ThumbsUp className="h-3 w-3" /> {s.vote_count}
                  </span>
                </div>
              </div>
              {s.status === 'pending' && (
                <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
                  <button
                    onClick={() => handleDecision(s.id, 'approve')}
                    disabled={busyId === s.id}
                    className="flex-1 rounded-lg bg-emerald-500/80 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Approuver
                  </button>
                  <button
                    onClick={() => handleDecision(s.id, 'reject')}
                    disabled={busyId === s.id}
                    className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Rejeter
                  </button>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PARRAINAGE (campagne + suivi)
// ============================================================
interface ReferralOverviewRow {
  id: string;
  full_name: string;
  referral_code: string;
  referral_count: number;
  referral_benefits_until: string | null;
  benefits_active: boolean;
}

function ReferralsAdminTab({ setError, setMsg }: { setError: (s: string | null) => void; setMsg: (s: string | null) => void }) {
  const { settings } = useCampus();
  const [rows, setRows] = useState<ReferralOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(true);
  const [benefitDays, setBenefitDays] = useState(30);
  const [discountPercent, setDiscountPercent] = useState(0.02);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setActive(settings.referral_campaign_active);
    setBenefitDays(settings.referral_benefit_days);
    setDiscountPercent(settings.referral_discount_percent);
  }, [settings]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('get_referral_overview');
    if (err) { setError(err.message); } else { setRows((data as ReferralOverviewRow[]) || []); }
    setLoading(false);
  }, [setError]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setError(null);
    setSaving(true);
    const { error: err } = await supabase.rpc('update_referral_settings', {
      p_active: active,
      p_benefit_days: benefitDays,
      p_discount_percent: discountPercent,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setMsg('Réglages de parrainage mis à jour');
  };

  return (
    <div className="space-y-4">
      <GlassCard className="p-5" strong>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Campagne de parrainage</h3>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => setActive((v) => !v)}
            className={`relative h-6 w-11 flex-shrink-0 overflow-hidden rounded-full transition ${active ? 'campus-gradient' : 'bg-white/15'}`}
          >
            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${active ? 'translate-x-[18px]' : 'translate-x-0'}`} />
          </button>
        </div>
        <p className="mb-3 text-xs text-white/40">
          Désactivée, les codes restent utilisables (liés pour le suivi) mais ne déclenchent plus de récompense pour le parrain.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/50">Durée de l'avantage (jours)</label>
            <input
              type="number"
              min={1}
              value={benefitDays}
              onChange={(e) => setBenefitDays(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Réduction de commission (0-1)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
            />
            <p className="mt-1 text-xs text-white/30">-{(discountPercent * 100).toFixed(0)} points de commission pendant l'avantage</p>
          </div>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="campus-gradient mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </GlassCard>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-white/70">Parrainages actifs</h3>
        {loading ? (
          <p className="text-sm text-white/40">Chargement...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-white/40">Aucun parrainage pour le moment</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <GlassCard key={r.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{r.full_name}</div>
                    <div className="font-mono text-xs text-white/40">{r.referral_code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{r.referral_count} filleul{r.referral_count > 1 ? 's' : ''}</div>
                    <span className={`text-[11px] ${r.benefits_active ? 'text-emerald-300' : 'text-white/30'}`}>
                      {r.benefits_active ? 'Avantage actif' : 'Aucun avantage actif'}
                    </span>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================
function SettingsTab({ setError, setMsg, refresh }: { setError: (s: string | null) => void; setMsg: (s: string | null) => void; refresh: () => Promise<void> }) {
  const { settings } = useCampus();
  const [form, setForm] = useState<AppSettings | null>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);

  if (!form) return <p className="text-sm text-white/40">Chargement...</p>;

  const save = async () => {
    setError(null);
    const parsed = settingsSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message); return; }
    setSaving(true);
    const { error: err } = await supabase.from('app_settings').update({
      usd_to_fc_rate: parsed.data.usd_to_fc_rate,
      commission_tier_under5: parsed.data.commission_tier_under5,
      commission_tier_mid: parsed.data.commission_tier_mid,
      commission_tier_mid_threshold: parsed.data.commission_tier_mid_threshold,
      commission_tier_custom: parsed.data.commission_tier_custom,
      guest_fee_extra_percent: parsed.data.guest_fee_extra_percent,
      boost_price_usd: parsed.data.boost_price_usd,
      verified_badge_price_usd: parsed.data.verified_badge_price_usd,
      urgent_price_usd: parsed.data.urgent_price_usd,
      mobile_money_instructions: parsed.data.mobile_money_instructions,
    }).eq('id', 1);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setMsg('Paramètres enregistrés');
    refresh();
  };

  const num = (key: keyof AppSettings, value: string) => setForm({ ...form, [key]: parseFloat(value) || 0 });

  return (
    <div className="space-y-4">
      <GlassCard className="p-5" strong>
        <h3 className="mb-4 text-sm font-semibold">Taux de change & Commissions</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/50">Taux USD → FC</label>
            <input type="number" value={form.usd_to_fc_rate} onChange={(e) => num('usd_to_fc_rate', e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Seuil tarif moyen (USD)</label>
            <input type="number" value={form.commission_tier_mid_threshold} onChange={(e) => num('commission_tier_mid_threshold', e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Commission sous seuil (0-1)</label>
            <input type="number" step="0.01" min="0" max="1" value={form.commission_tier_under5} onChange={(e) => num('commission_tier_under5', e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
            <p className="mt-1 text-xs text-white/30">{(form.commission_tier_under5 * 100).toFixed(0)}%</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Commission tarif moyen (0-1)</label>
            <input type="number" step="0.01" min="0" max="1" value={form.commission_tier_mid} onChange={(e) => num('commission_tier_mid', e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
            <p className="mt-1 text-xs text-white/30">{(form.commission_tier_mid * 100).toFixed(0)}%</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Commission sur-mesure (0-1)</label>
            <input type="number" step="0.01" min="0" max="1" value={form.commission_tier_custom} onChange={(e) => num('commission_tier_custom', e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
            <p className="mt-1 text-xs text-white/30">{(form.commission_tier_custom * 100).toFixed(0)}%</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Surtaxe vendeur invité (0-1)</label>
            <input type="number" step="0.001" min="0" max="1" value={form.guest_fee_extra_percent} onChange={(e) => num('guest_fee_extra_percent', e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
            <p className="mt-1 text-xs text-white/30">+{(form.guest_fee_extra_percent * 100).toFixed(1)}% — s'ajoute à la commission normale quand le vendeur n'a pas de campus fixe</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Prix des options payantes</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-white/50">Boost (USD)</label>
            <input type="number" step="0.5" value={form.boost_price_usd} onChange={(e) => num('boost_price_usd', e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Badge Vérifié (USD)</label>
            <input type="number" step="0.5" value={form.verified_badge_price_usd} onChange={(e) => num('verified_badge_price_usd', e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Urgent (USD)</label>
            <input type="number" step="0.5" value={form.urgent_price_usd} onChange={(e) => num('urgent_price_usd', e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Instructions Mobile Money</h3>
        <textarea value={form.mobile_money_instructions} onChange={(e) => setForm({ ...form, mobile_money_instructions: e.target.value })} rows={3} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
      </GlassCard>

      <button onClick={save} disabled={saving} className="campus-gradient flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        <Save className="h-4 w-4" /> {saving ? 'Sauvegarde...' : 'Enregistrer les paramètres'}
      </button>
    </div>
  );
}

// ============================================================
// ADS
// ============================================================
function AdsTab({
  setError, setMsg, isSuperAdmin, campusId,
}: {
  setError: (s: string | null) => void; setMsg: (s: string | null) => void; isSuperAdmin: boolean; campusId: string | null;
}) {
  const { campuses } = useCampus();
  const [ads, setAds] = useState<AdBanner[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', image_url: '', link_url: '#', campus_id: isSuperAdmin ? '' : (campusId || ''), placement: 'marketplace_top' as const });

  const scopedAds = isSuperAdmin ? ads : ads.filter((a) => a.campus_id === campusId);

  const load = useCallback(async () => {
    const { data } = await supabase.from('ad_banners').select('*').order('created_at', { ascending: false });
    setAds((data as AdBanner[]) || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError(null);
    const parsed = adBannerSchema.safeParse({ ...form, campus_id: form.campus_id || null });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message); return; }
    const { error: err } = await supabase.from('ad_banners').insert(parsed.data);
    if (err) { setError(err.message); return; }
    setMsg('Bannière créée');
    setShowForm(false);
    setForm({ title: '', image_url: '', link_url: '#', campus_id: isSuperAdmin ? '' : (campusId || ''), placement: 'marketplace_top' });
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    const { error: err } = await supabase.from('ad_banners').update({ is_active: !active }).eq('id', id);
    if (err) { setError(err.message); return; }
    load();
  };

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('ad_banners').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bannières publicitaires</h2>
        <button onClick={() => setShowForm((v) => !v)} className="campus-gradient flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Nouvelle bannière</button>
      </div>

      {showForm && (
        <GlassCard className="space-y-3 p-5" strong>
          <input type="text" placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
          <input type="url" placeholder="URL de l'image" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
          <input type="url" placeholder="URL du lien" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
          {isSuperAdmin ? (
            <select value={form.campus_id} onChange={(e) => setForm({ ...form, campus_id: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none">
              <option value="" className="bg-gray-900">Tous les campus</option>
              {campuses.map((c) => <option key={c.id} value={c.id} className="bg-gray-900">{c.name}</option>)}
            </select>
          ) : (
            <p className="text-xs text-white/40">Campus : {campuses.find((c) => c.id === campusId)?.name || '—'}</p>
          )}
          <select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value as typeof form.placement })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none">
            <option value="marketplace_top" className="bg-gray-900">Haut du marché</option>
            <option value="marketplace_side" className="bg-gray-900">Côté du marché</option>
            <option value="home_hero" className="bg-gray-900">Accueil Hero</option>
          </select>
          <button onClick={save} className="campus-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white">Créer</button>
        </GlassCard>
      )}

      <div className="space-y-2">
        {scopedAds.map((ad) => (
          <GlassCard key={ad.id} className="flex items-center gap-3 p-3">
            <img src={ad.image_url} alt="" className="h-12 w-20 flex-shrink-0 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium">{ad.title}</div>
              <div className="text-xs text-white/40">{ad.placement} · {ad.impressions} impressions</div>
            </div>
            <button onClick={() => toggle(ad.id, ad.is_active)} className={`rounded-lg px-2 py-1 text-xs font-semibold ${ad.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
              {ad.is_active ? 'Actif' : 'Inactif'}
            </button>
            <button onClick={() => remove(ad.id)} className="text-red-400/60 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
          </GlassCard>
        ))}
        {scopedAds.length === 0 && <p className="text-sm text-white/40">Aucune bannière</p>}
      </div>
    </div>
  );
}
