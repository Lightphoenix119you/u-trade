import { useState, useEffect } from 'react';
import { Mail, Lock, User, Phone, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { signInSchema, signUpSchema } from '@/lib/validation';
import { GlassCard } from '@/components/GlassCard';
import { CampusSelector } from '@/components/CampusSelector';

interface AuthPageProps {
  mode: 'signin' | 'signup';
  navigate: (path: string) => void;
}

export function AuthPage({ mode, navigate }: AuthPageProps) {
  const { signIn, signUp } = useAuth();
  const { campuses } = useCampus();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [form, setForm] = useState<{
    email: string; password: string; full_name: string; phone: string; campus_id: string | null;
  }>({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    campus_id: campuses[0]?.id || null,
  });
  const [isGuest, setIsGuest] = useState(false);

  // Pré-remplit depuis un lien de parrainage partagé (#/signup?ref=CODE) —
  // ne bloque rien si absent, juste un confort.
  useEffect(() => {
    const match = window.location.hash.match(/[?&]ref=([^&]+)/);
    if (match) setReferralCode(decodeURIComponent(match[1]).toUpperCase());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const parsed = signInSchema.safeParse({ email: form.email, password: form.password });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message || 'Formulaire invalide');
          setLoading(false);
          return;
        }
        const { error: err } = await signIn(parsed.data.email, parsed.data.password);
        if (err) {
          setError(err === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : err);
          setLoading(false);
          return;
        }
        navigate('/');
      } else {
        const parsed = signUpSchema.safeParse(form);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message || 'Formulaire invalide');
          setLoading(false);
          return;
        }
        const { error: err } = await signUp(
          parsed.data.email,
          parsed.data.password,
          parsed.data.full_name,
          parsed.data.phone,
          parsed.data.campus_id,
          referralCode,
        );
        if (err) {
          setError(
            err.includes('already')
              ? 'Un compte existe déjà avec cet email'
              : err,
          );
          setLoading(false);
          return;
        }
        navigate('/');
      }
    } catch {
      setError('Une erreur est survenue. Réessayez.');
      setLoading(false);
    }
  };

  const update = (key: keyof typeof form, value: string | null) => {
    setForm((f) => ({ ...f, [key]: value }) as typeof f);
  };

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="campus-gradient mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl campus-glow">
            <span className="text-2xl font-black text-white">U</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === 'signin' ? 'Connexion' : 'Rejoindre U. Trade'}
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {mode === 'signin'
              ? 'Connectez-vous pour accéder au marketplace'
              : 'Créez votre compte étudiant en quelques secondes'}
          </p>
        </div>

        <GlassCard strong className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => update('full_name', e.target.value)}
                    placeholder="Jean Mukendi"
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-white/30"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="jean@unikin.ac.cd"
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-white/30"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">
                  Numéro de téléphone{isGuest && <span className="font-normal text-white/40"> (Optionnel)</span>}
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    placeholder={isGuest ? '+33 6 12 34 56 78 (facultatif)' : '0812345678'}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-white/30"
                  />
                </div>
                <p className="mt-1 text-xs text-white/30">Reçu pour le code de livraison (OTP)</p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder={mode === 'signup' ? '6 caractères minimum' : '••••••••'}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-white/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-white/70">Votre campus</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsGuest((v) => !v);
                      update('campus_id', isGuest ? campuses[0]?.id || null : null);
                    }}
                    className="text-xs font-medium campus-text hover:underline"
                  >
                    {isGuest ? '← Choisir un campus' : "Continuer en tant qu'invité"}
                  </button>
                </div>
                {isGuest ? (
                  <p className="rounded-lg border border-dashed border-white/15 bg-white/5 p-3 text-sm text-white/50">
                    Compte invité — explore, achète et publie des annonces sans être rattaché à un
                    campus fixe. Tu pourras choisir n'importe quel point de rendez-vous existant en
                    publiant une annonce.
                  </p>
                ) : (
                  <CampusSelector
                    inline
                    hideAllOption
                    value={form.campus_id}
                    onChange={(id) => update('campus_id', id)}
                  />
                )}
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">
                  Code de parrainage / promo <span className="font-normal text-white/40">(Optionnel)</span>
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="Ex: A1B2C3"
                  maxLength={20}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm uppercase outline-none transition focus:border-white/30"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="campus-gradient flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Chargement...' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </GlassCard>

        <p className="mt-6 text-center text-sm text-white/50">
          {mode === 'signin' ? "Pas encore de compte ? " : 'Déjà inscrit ? '}
          <button
            onClick={() => navigate(mode === 'signin' ? '/signup' : '/signin')}
            className="campus-text font-semibold hover:underline"
          >
            {mode === 'signin' ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  );
}
