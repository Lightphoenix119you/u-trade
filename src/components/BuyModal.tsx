import { useEffect, useState } from 'react';
import {
  X, MapPin, Shield, Smartphone, CheckCircle, Clock, Handshake,
  AlertCircle, Package, Palette, Upload,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { GlassCard } from '@/components/GlassCard';
import { formatUSD, formatFC, computeCommission } from '@/lib/format';
import { detectBlockedContent } from '@/lib/antiCircumvention';
import type { ListingWithRelations, CampusHub } from '@/lib/types';

interface BuyModalProps {
  isOpen: boolean;
  listing: ListingWithRelations | null;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

export function BuyModal({ isOpen, listing, onClose, onSuccess }: BuyModalProps) {
  const { user } = useAuth();
  const { settings } = useCampus();
  const [hubs, setHubs] = useState<CampusHub[]>([]);
  const [hubId, setHubId] = useState('');
  const [step, setStep] = useState<'details' | 'payment' | 'success'>('details');
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [productionNotes, setProductionNotes] = useState('');
  const [notesWarn, setNotesWarn] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<string[]>([]);
  const [refImgInput, setRefImgInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [hubsLoading, setHubsLoading] = useState(true);
  const [hubsError, setHubsError] = useState(false);

  // Doit être un vrai effet (et donc rester AVANT le "return null" ci-dessous,
  // les hooks ne peuvent pas être conditionnels) pour pouvoir gérer proprement
  // le chargement et une éventuelle erreur — l'ancienne version faisait le
  // fetch directement dans le corps du rendu, sans .catch() ni état d'erreur :
  // en cas d'échec ou de campus sans aucun hub configuré, la section
  // "Point de rendez-vous" restait silencieusement vide et bloquait l'achat.
  useEffect(() => {
    if (!listing) return;
    let cancelled = false;
    setHubsLoading(true);
    setHubsError(false);

    supabase
      .from('campus_hubs')
      .select('*')
      .eq('campus_id', listing.campus_id)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setHubsError(true);
          setHubs([]);
        } else {
          setHubs((data as CampusHub[]) || []);
        }
        setHubsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setHubsError(true);
          setHubsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [listing?.id, listing?.campus_id]);

  if (!isOpen || !listing) return null;

  const resetAndClose = () => {
    setStep('details');
    setError(null);
    setOrderId(null);
    setOtpCode(null);
    setHubId('');
    setProductionNotes('');
    setRefImages([]);
    onClose();
  };

  const rate = settings?.usd_to_fc_rate ?? 2800;
  const commission = computeCommission(listing.price_usd, listing.type === 'custom', settings);
  const isCustom = listing.type === 'custom';

  const addRefImage = () => {
    const url = refImgInput.trim();
    if (!url) return;
    try {
      new URL(url);
      if (refImages.length >= 5) { setError('5 images maximum'); return; }
      setRefImages([...refImages, url]);
      setRefImgInput('');
      setError(null);
    } catch {
      setError('URL invalide');
    }
  };

  const createOrderAndPay = async () => {
    if (!user) return;
    if (hubs.length > 0 && !hubId) { setError('Sélectionnez un point de rendez-vous'); return; }
    if (!listing.campus_id) { setError("Cette annonce n'a pas de campus associé — impossible de continuer."); return; }
    setError(null);
    setProcessing(true);

    try {
      // Repli défensif : la vérification faite dans ListingDetail.tsx peut
      // être contournée par un double-clic rapide ou un second onglet déjà
      // ouvert sur cette modale — on revérifie juste avant l'insertion.
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('buyer_id', user.id)
        .in('status', ['pending_payment', 'paid', 'in_delivery'])
        .maybeSingle();

      if (existing) {
        setError('Vous avez déjà une commande en cours pour cette annonce.');
        return;
      }

      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          seller_id: listing.seller_id,
          listing_id: listing.id,
          shop_id: listing.shop_id ?? null, // nullable : une annonce hors boutique n'en a pas, c'est normal
          campus_id: listing.campus_id,
          hub_id: hubId || null,
          price_usd: listing.price_usd,
          commission_rate: commission.rate,
          commission_usd: commission.commission,
          seller_payout_usd: commission.payout,
          status: 'pending_payment',
          is_custom: isCustom,
          production_notes: productionNotes || null,
          reference_image_urls: refImages,
          // escrow_code / escrow_code_hash : ne se règlent jamais ici.
          // Générés côté serveur par la RPC confirm_order_payment juste
          // après cette insertion.
        })
        .select()
        .single();

      if (orderErr) {
        // 23505 = violation de l'index unique côté base (voir
        // 010_prevent_duplicate_orders.sql) — la vraie garantie contre une
        // course entre la vérification ci-dessus et cette insertion.
        if (orderErr.code === '23505') {
          setError('Vous avez déjà une commande en cours pour cette annonce.');
        } else {
          setError('Erreur lors de la création de la commande : ' + orderErr.message);
        }
        return;
      }

      // RPC plutôt que la edge function escrow (abandonnée — indéployable
      // sous Termux/Android) : génère l'OTP et son hash côté serveur, aucune
      // dépendance réseau externe à Supabase lui-même.
      const { data: otp, error: rpcError } = await supabase.rpc('confirm_order_payment', {
        p_order_id: orderData.id,
      });

      if (rpcError) {
        setError(rpcError.message || 'Erreur lors du paiement');
        return;
      }

      setOrderId(orderData.id);
      setOtpCode(otp);
      setStep('success');
    } catch (err) {
      setError(
        err instanceof Error
          ? `Erreur : ${err.message}`
          : 'Une erreur inattendue est survenue. Réessayez.'
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step === 'success' ? undefined : resetAndClose} />

      <div className="glass-strong relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {step === 'success' ? 'Commande confirmée' : isCustom ? 'Commander (sur-mesure)' : 'Acheter'}
          </h2>
          {step !== 'success' && (
            <button type="button" onClick={resetAndClose} className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Step indicator */}
        {step !== 'success' && (
          <div className="mb-5 flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs ${step === 'details' ? 'text-white' : 'text-white/40'}`}>
              <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${step === 'details' ? 'campus-bg text-white' : 'bg-white/10'}`}>1</div>
              Détails
            </div>
            <div className="h-px flex-1 bg-white/10" />
            <div className={`flex items-center gap-1.5 text-xs ${step === 'payment' ? 'text-white' : 'text-white/40'}`}>
              <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${step === 'payment' ? 'campus-bg text-white' : 'bg-white/10'}`}>2</div>
              Paiement
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4">
            <GlassCard className="p-4" strong>
              <div className="flex gap-3">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white/5">
                  {listing.image_urls[0] && <img src={listing.image_urls[0]} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{listing.title}</h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-white/40">
                    {isCustom ? <Palette className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                    {isCustom ? 'Commande sur-mesure' : 'Objet seconde main'}
                  </div>
                  <div className="mt-1 text-base font-bold campus-gradient-text">{formatUSD(listing.price_usd)}</div>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-xs">
                <div className="flex justify-between text-white/50">
                  <span>Prix</span><span>{formatUSD(listing.price_usd)}</span>
                </div>
                <div className="flex justify-between text-white/50">
                  <span>Commission plateforme ({(commission.rate * 100).toFixed(0)}%)</span>
                  <span>{formatUSD(commission.commission)}</span>
                </div>
                <div className="flex justify-between font-semibold text-white">
                  <span>Total à payer</span><span>{formatUSD(listing.price_usd)}</span>
                </div>
                <div className="text-right text-white/40">{formatFC(listing.price_usd, rate)}</div>
              </div>
            </GlassCard>

            {isCustom && (
              <GlassCard className="p-4">
                <h3 className="mb-2 text-xs font-semibold">Consignes pour le créateur</h3>
                <textarea
                  value={productionNotes}
                  onChange={(e) => {
                    setProductionNotes(e.target.value);
                    setNotesWarn(detectBlockedContent(e.target.value));
                  }}
                  placeholder="Couleurs, style, dimensions, texte à inclure..."
                  rows={3}
                  className={`w-full rounded-lg border bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30 ${notesWarn ? 'border-amber-500/40' : 'border-white/10'}`}
                />
                {notesWarn && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
                    <Shield className="h-3.5 w-3.5 flex-shrink-0" /> {notesWarn}
                  </div>
                )}
                <label className="mb-1.5 mt-3 block text-xs text-white/50">Photos de référence (optionnel)</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={refImgInput}
                    onChange={(e) => setRefImgInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRefImage())}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                  />
                  <button type="button" onClick={addRefImage} className="glass flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
                    <Upload className="h-4 w-4" />
                  </button>
                </div>
                {refImages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {refImages.map((url, i) => (
                      <div key={i} className="group relative h-14 w-14 overflow-hidden rounded-lg">
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <button type="button" onClick={() => setRefImages(refImages.filter((_, idx) => idx !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5">
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            <GlassCard className="p-4">
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <MapPin className="h-4 w-4 campus-text" />
                {hubId
                  ? `Point de rendez-vous : ${hubs.find((h) => h.id === hubId)?.name || ''}`
                  : 'Point de rendez-vous'}
              </label>

              {hubsLoading ? (
                <p className="text-sm text-white/40">Chargement des points de rendez-vous...</p>
              ) : hubsError ? (
                <p className="text-sm text-red-400">
                  Impossible de charger les points de rendez-vous. Réessayez ou contactez le vendeur directement.
                </p>
              ) : hubs.length === 0 ? (
                <p className="text-sm text-white/50">
                  Point de rendez-vous : <span className="italic text-white/40">À convenir avec le vendeur</span>
                </p>
              ) : (
                <div className="space-y-1.5">
                  {hubs.map((hub) => (
                    <button
                      key={hub.id}
                      onClick={() => setHubId(hub.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition ${
                        hubId === hub.id ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-white/40" />
                      <div>
                        <div className="font-medium">{hub.name}</div>
                        {hub.description && <div className="text-xs text-white/40">{hub.description}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </GlassCard>

            <button
              onClick={() => setStep('payment')}
              disabled={hubsLoading || (hubs.length > 0 && !hubId)}
              className="campus-gradient flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Continuer vers le paiement
            </button>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <GlassCard className="p-4" strong>
              <div className="mb-3 flex items-center gap-2">
                <Smartphone className="h-4 w-4 campus-text" />
                <h3 className="text-sm font-semibold">Paiement Mobile Money</h3>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                {settings?.mobile_money_instructions || 'Payez via M-Pesa, Airtel Money ou Orange Money.'}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                <span className="text-white/50">Montant total</span>
                <div className="text-right">
                  <div className="font-bold campus-gradient-text">{formatUSD(listing.price_usd)}</div>
                  <div className="text-xs text-white/40">{formatFC(listing.price_usd, rate)}</div>
                </div>
              </div>
            </GlassCard>

            <div className="flex gap-2">
              <button onClick={() => setStep('details')} className="glass flex-1 rounded-xl py-2.5 text-sm font-semibold text-white">
                Retour
              </button>
              <button
                onClick={createOrderAndPay}
                disabled={processing}
                className="campus-gradient flex flex-[2] items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                {processing ? 'Traitement...' : "J'ai payé — Confirmer"}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && orderId && (
          <div className="space-y-4">
            <GlassCard className="p-5 text-center" strong glow>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 pulse-ring">
                <CheckCircle className="h-7 w-7 text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold">Paiement confirmé !</h2>
              <p className="mt-1 text-sm text-white/50">
                L'argent est bloqué par la plateforme. Récupérez votre objet au point de rendez-vous.
              </p>

              <div className="mt-5 rounded-xl border border-white/15 bg-white/5 p-4">
                <p className="mb-2 text-xs uppercase tracking-wider text-white/40">Votre code OTP de livraison</p>
                <div className="flex justify-center gap-2.5">
                  {otpCode?.split('').map((digit, i) => (
                    <div key={i} className="campus-gradient flex h-12 w-10 items-center justify-center rounded-xl text-xl font-black text-white">
                      {digit}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-white/40">
                  <Handshake className="mr-1 inline h-3.5 w-3.5" />
                  Donnez ce code au vendeur <strong>en main propre</strong> au rendez-vous.
                </p>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-amber-400/70">
                <Clock className="h-3.5 w-3.5" /> Ne communiquez jamais ce code par message, uniquement de vive voix.
              </div>
            </GlassCard>

            <button
              onClick={() => { onSuccess(orderId); resetAndClose(); }}
              className="campus-gradient w-full rounded-xl py-3 text-sm font-bold text-white"
            >
              Suivre ma commande
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
