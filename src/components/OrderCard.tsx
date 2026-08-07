import { useCallback, useEffect, useState } from 'react';
import {
  Clock, MapPin, Package, Palette, AlertCircle, CheckCircle, Handshake,
  Flag, Lock, Smartphone, Eye, EyeOff, Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { GlassCard } from '@/components/GlassCard';
import { OrderChat } from '@/components/OrderChat';
import { formatUSD, formatFC, timeAgo } from '@/lib/format';
import { reviewSchema } from '@/lib/validation';
import type { Order, Listing, ListingReview } from '@/lib/types';

interface OrderCardProps {
  orderId: string;
  navigate: (path: string) => void;
  /** Version condensée pour intégration inline (ex. dans un fil de messages) */
  compact?: boolean;
}

const STATUS_FLOW: { key: string; label: string; icon: typeof Clock }[] = [
  { key: 'pending_payment', label: 'Paiement en attente', icon: Smartphone },
  { key: 'paid', label: 'Payé — En livraison', icon: Handshake },
  { key: 'completed', label: 'Complétée', icon: CheckCircle },
];

// ⚠️ Ne JAMAIS inclure escrow_code / escrow_code_hash ici (ni select('*')).
// Le code OTP en clair ne doit jamais transiter par une lecture directe de
// cette ligne pour le VENDEUR — sinon il pourrait le lire dans les DevTools
// sans jamais rencontrer l'acheteur, ce qui contourne toute la sécurité du
// dépôt fiduciaire. La vérification vendeur passe exclusivement par la RPC
// validate_escrow_otp (hash SHA-256 côté serveur) ; l'acheteur, lui, peut
// légitimement lire son propre code via fallbackRevealFromTable ci-dessous,
// strictement filtré sur buyer_id = auth.uid().
const ORDER_SAFE_COLUMNS = `
  id, buyer_id, seller_id, listing_id, shop_id, campus_id, hub_id,
  price_usd, commission_rate, commission_usd, seller_payout_usd, status,
  escrow_revealed_at, production_notes, reference_image_urls, is_custom,
  paid_at, delivered_at, completed_at, disputed_at, dispute_reason,
  created_at, updated_at,
  listing:listings(*), buyer:profiles!orders_buyer_id_fkey(*),
  seller:profiles!orders_seller_id_fkey(*), hub:campus_hubs(*)
`;

export function OrderCard({ orderId, navigate, compact }: OrderCardProps) {
  const { user } = useAuth();
  const { settings } = useCampus();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [otpInput, setOtpInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [revealedOtp, setRevealedOtp] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [existingReview, setExistingReview] = useState<ListingReview | null>(null);
  const [reviewLoaded, setReviewLoaded] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SAFE_COLUMNS)
      .eq('id', orderId)
      .maybeSingle();
    if (error || !data) {
      setLoading(false);
      return;
    }
    const ord = data as unknown as Order;
    setOrder(ord);
    setLoading(false);

    if (ord.status === 'completed') {
      const { data: reviewData } = await supabase
        .from('listing_reviews')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      setExistingReview((reviewData as ListingReview) || null);
      setReviewLoaded(true);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  // Le vendeur saisit le code de l'acheteur : vérifié côté serveur via la
  // RPC validate_escrow_otp (hash SHA-256, jamais le code en clair exposé
  // au vendeur). Remplace l'ancien appel à l'edge function "escrow", qui
  // ne peut plus être déployée (CLI Supabase indisponible sous Termux).
  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otpInput)) {
      setActionError('Code: 6 chiffres');
      return;
    }
    setActionError(null);
    setProcessing(true);
    try {
      const { data: success, error: rpcError } = await supabase.rpc('validate_escrow_otp', {
        p_order_id: orderId,
        p_otp: otpInput,
      });

      if (rpcError) {
        setActionError(rpcError.message);
        return;
      }
      if (success) {
        setActionMsg('Paiement débloqué au vendeur ! Transaction complétée.');
        setOtpInput('');
        load();
      } else {
        setActionError('Code incorrect.');
      }
    } finally {
      setProcessing(false);
    }
  };

  // Lecture sécurisée du code par l'acheteur : strictement filtrée sur
  // buyer_id = auth.uid() (RLS + ce filtre explicite le garantissent tous
  // les deux) — jamais accessible au vendeur par ce biais.
  const fallbackRevealFromTable = async () => {
    if (!user) {
      setActionError('Vous devez être connecté.');
      return;
    }
    const { data, error } = await supabase
      .from('orders')
      .select('escrow_code, status')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .maybeSingle();

    if (error || !data?.escrow_code || !['paid', 'in_delivery'].includes(data.status)) {
      setActionError('Code indisponible ou expiré pour cette commande.');
      return;
    }
    setRevealedOtp(data.escrow_code);
  };

  const handleRevealOtp = async () => {
    setRevealing(true);
    try {
      await fallbackRevealFromTable();
    } finally {
      setRevealing(false);
    }
  };

  const handleDispute = async () => {
    if (disputeReason.length < 5) {
      setActionError('Raison: 5 caractères minimum');
      return;
    }
    setActionError(null);
    setProcessing(true);
    try {
      const { error: rpcError } = await supabase.rpc('order_open_dispute', {
        p_order_id: orderId,
        p_reason: disputeReason,
      });

      if (rpcError) {
        setActionError(rpcError.message);
        return;
      }
      setActionMsg("Litige ouvert. L'administrateur a été notifié.");
      setShowDispute(false);
      setDisputeReason('');
      load();
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm('Annuler cette commande ?')) return;
    setActionError(null);
    setProcessing(true);
    try {
      const { error: rpcError } = await supabase.rpc('cancel_order', { p_order_id: orderId });
      if (rpcError) {
        setActionError(rpcError.message);
        return;
      }
      setActionMsg('Commande annulée.');
      load();
    } finally {
      setProcessing(false);
    }
  };

  // Petit utilitaire commun aux actions du litige à 2 niveaux — même forme
  // (RPC sans argument, message de succès, rechargement) pour éviter de
  // répéter 5 fois le même bloc try/finally.
  const runOrderRpc = async (fn: string, successMsg: string, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActionError(null);
    setProcessing(true);
    try {
      const { error: rpcError } = await supabase.rpc(fn, { p_order_id: orderId });
      if (rpcError) {
        setActionError(rpcError.message);
        return;
      }
      setActionMsg(successMsg);
      load();
    } finally {
      setProcessing(false);
    }
  };

  // Niveau 1 — l'acheteur demande une annulation amiable
  const handleRequestCancellation = () =>
    runOrderRpc(
      'buyer_request_cancellation',
      'Demande envoyée au vendeur. Il a la main pour accepter ou refuser.',
      'Demander l\'annulation de cette commande au vendeur ?'
    );

  // Niveau 1 — le vendeur accepte : remboursement direct, pas d'admin
  const handleAcceptCancellation = () =>
    runOrderRpc(
      'seller_accept_cancellation',
      "Annulation acceptée. L'acheteur est remboursé.",
      "Accepter l'annulation et rembourser l'acheteur ?"
    );

  // Niveau 1 → 2 — le vendeur refuse, ça devient un vrai litige admin
  const handleRejectCancellation = () =>
    runOrderRpc(
      'seller_reject_cancellation',
      "Litige ouvert. L'administrateur va arbitrer.",
      "Refuser la demande et escalader vers l'administration ?"
    );

  // Niveau 2 — l'acheteur escalade lui-même après 24h sans réponse
  const handleEscalateBuyer = () =>
    runOrderRpc(
      'buyer_escalate_dispute',
      "Litige escaladé. L'administrateur va arbitrer.",
      "Escalader vers l'administration ? Le vendeur n'a pas répondu depuis 24h."
    );

  // Bonus — annulation directe côté vendeur, tant que ce n'est pas livré/complété
  const handleSellerCancelOrder = () =>
    runOrderRpc(
      'seller_cancel_order',
      "Vente annulée. L'acheteur est remboursé si un paiement avait été fait.",
      'Abandonner et annuler cette vente ?'
    );

  const handleSubmitReview = async () => {
    if (!user || !order) return;
    setReviewError(null);
    const parsed = reviewSchema.safeParse({ rating: reviewRating, comment: reviewComment });
    if (!parsed.success) {
      setReviewError(parsed.error.issues[0]?.message || 'Avis invalide');
      return;
    }
    setSubmittingReview(true);
    const { data, error } = await supabase
      .from('listing_reviews')
      .insert({
        order_id: order.id,
        listing_id: order.listing_id,
        shop_id: order.shop_id,
        reviewer_id: user.id,
        seller_id: order.seller_id,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      })
      .select()
      .single();
    setSubmittingReview(false);
    if (error) {
      setReviewError(error.message);
      return;
    }
    setExistingReview(data as ListingReview);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-24 w-full rounded-xl" />
        {!compact && <div className="skeleton h-40 w-full rounded-xl" />}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-white/40">Commande introuvable.</p>
      </div>
    );
  }

  const rate = settings?.usd_to_fc_rate ?? 2800;
  const isBuyer = user?.id === order.buyer_id;
  const isSeller = user?.id === order.seller_id;
  const listing = order.listing as Listing | undefined;
  const currentStep = STATUS_FLOW.findIndex((s) => s.key === order.status);
  const isDisputed = order.status === 'disputed';
  const isCompleted = order.status === 'completed';
  const isRefunded = order.status === 'refunded';
  const isDisputePending = order.status === 'dispute_pending';
  const canEscalate =
    !!order.dispute_requested_at &&
    Date.now() - new Date(order.dispute_requested_at).getTime() > 24 * 60 * 60 * 1000;

  return (
    <div>
      {actionMsg && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {actionMsg}
        </div>
      )}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {actionError}
        </div>
      )}

      {/* Status header */}
      <GlassCard className="mb-4 p-5" strong>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Commande #{order.id.slice(0, 8)}</h1>
            <p className="text-xs text-white/40">{timeAgo(order.created_at)}</p>
          </div>
          <div className={`rounded-lg px-3 py-1 text-xs font-bold ${
            isCompleted ? 'bg-emerald-500/20 text-emerald-300' :
            isDisputed ? 'bg-red-500/20 text-red-300' :
            isDisputePending ? 'bg-amber-500/20 text-amber-300' :
            isRefunded ? 'bg-orange-500/20 text-orange-300' :
            'bg-white/10 text-white/60'
          }`}>
            {isDisputed ? 'LITIGE' : isDisputePending ? "DEMANDE D'ANNULATION" : isCompleted ? 'COMPLÉTÉE / LIVRÉE' : isRefunded ? 'REMBOURSÉE' : order.status === 'paid' ? 'EN LIVRAISON' : 'EN COURS'}
          </div>
        </div>

        {!isDisputed && !isRefunded && (
          <div className="flex items-center gap-1">
            {STATUS_FLOW.map((step, i) => {
              const Icon = step.icon;
              const done = i <= currentStep;
              return (
                <div key={step.key} className="flex flex-1 items-center">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition ${done ? 'campus-bg text-white' : 'bg-white/10 text-white/30'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {i < STATUS_FLOW.length - 1 && <div className={`h-0.5 flex-1 ${i < currentStep ? 'campus-bg' : 'bg-white/10'}`} />}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {listing && (
        <GlassCard className="mb-4 p-4">
          <div className="flex gap-3">
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-white/5">
              {listing.image_urls?.[0] && <img src={listing.image_urls[0]} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1">
              <button onClick={() => navigate(`/listing/${listing.id}`)} className="text-left">
                <h3 className="truncate font-semibold hover:underline">{listing.title}</h3>
              </button>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-white/40">
                {order.is_custom ? <Palette className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                {order.is_custom ? 'Commande sur-mesure' : 'Objet seconde main'}
              </div>
              <div className="mt-1 font-bold campus-gradient-text">{formatUSD(order.price_usd)}</div>
            </div>
          </div>
        </GlassCard>
      )}

      {!compact && order.hub && (
        <GlassCard className="mb-4 p-4">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 campus-text" />
            <span className="font-medium">Rendez-vous : {order.hub.name}</span>
          </div>
          {order.hub.description && <p className="mt-1 text-xs text-white/40">{order.hub.description}</p>}
        </GlassCard>
      )}

      {!compact && order.status !== 'cancelled' && (isBuyer || isSeller) && (
        <GlassCard className="mb-4 p-4">
          <OrderChat
            orderId={order.id}
            otherUserId={isBuyer ? order.seller_id : order.buyer_id}
            orderStatus={order.status}
          />
        </GlassCard>
      )}

      {!compact && order.is_custom && order.production_notes && (
        <GlassCard className="mb-4 p-4">
          <h4 className="mb-1 text-sm font-semibold">Consignes du client</h4>
          <p className="whitespace-pre-wrap text-sm text-white/60">{order.production_notes}</p>
          {order.reference_image_urls?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {order.reference_image_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="h-16 w-16 overflow-hidden rounded-lg">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {!compact && (
        <GlassCard className="mb-4 p-4">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-white/50"><span>Prix</span><span>{formatUSD(order.price_usd)}</span></div>
            <div className="flex justify-between text-white/50">
              <span>Commission ({(order.commission_rate * 100).toFixed(0)}%)</span><span>{formatUSD(order.commission_usd)}</span>
            </div>
            {isSeller && (
              <div className="flex justify-between font-semibold text-emerald-300">
                <span>Votre gain net</span><span>{formatUSD(order.seller_payout_usd)}</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-1.5 text-xs text-white/30">{formatFC(order.price_usd, rate)}</div>
          </div>
        </GlassCard>
      )}

      {/* Acheteur : annulation — pending_payment reste directe (rien n'a été
          payé). paid/in_delivery passe par la demande amiable niveau 1
          (buyer_request_cancellation), pas une réécriture directe du statut
          — l'argent est en séquestre, le vendeur doit avoir la main. */}
      {isBuyer && order.status === 'pending_payment' && (
        <GlassCard className="mb-4 p-4">
          <p className="mb-2 text-sm text-white/50">Paiement non finalisé. Vous pouvez annuler cette tentative.</p>
          <button
            onClick={handleCancelOrder}
            disabled={processing}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            {processing ? 'Annulation...' : 'Annuler la commande'}
          </button>
        </GlassCard>
      )}

      {isBuyer && (order.status === 'paid' || order.status === 'in_delivery') && (
        <GlassCard className="mb-4 p-4">
          <p className="mb-2 text-sm text-white/50">
            Cette commande est déjà payée. Demandez l'annulation au vendeur — s'il ne répond pas ou refuse, un administrateur tranchera.
          </p>
          <button
            onClick={handleRequestCancellation}
            disabled={processing}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            Demander l'annulation
          </button>
        </GlassCard>
      )}

      {/* Niveau 1 — demande en attente, vue acheteur : patiente ou escalade après 24h */}
      {isBuyer && isDisputePending && (
        <GlassCard className="mb-4 border-amber-500/20 p-4">
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <Clock className="h-4 w-4" /> <span className="font-semibold">Demande d'annulation envoyée</span>
          </div>
          <p className="mt-1.5 text-sm text-white/50">En attente de la réponse du vendeur.</p>
          <button
            onClick={handleEscalateBuyer}
            disabled={processing || !canEscalate}
            title={!canEscalate ? 'Disponible 24h après votre demande' : undefined}
            className="mt-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {canEscalate ? "Escalader vers l'administration" : "Escalade possible dans 24h si pas de réponse"}
          </button>
        </GlassCard>
      )}

      {/* Niveau 1 — demande en attente, vue vendeur : accepter ou refuser/escalader */}
      {isSeller && isDisputePending && (
        <GlassCard className="mb-4 border-amber-500/20 p-4" strong glow>
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <AlertCircle className="h-4 w-4" /> <span className="font-semibold">L'acheteur demande l'annulation</span>
          </div>
          {order.dispute_reason && <p className="mt-1.5 text-sm text-white/60">{order.dispute_reason}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleAcceptCancellation}
              disabled={processing}
              className="rounded-lg bg-emerald-500/80 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Accepter l'annulation
            </button>
            <button
              onClick={handleRejectCancellation}
              disabled={processing}
              className="rounded-lg bg-red-500/80 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Refuser / Escalader
            </button>
          </div>
        </GlassCard>
      )}

      {/* Bonus — annulation directe côté vendeur, tant que ce n'est pas livré/complété */}
      {isSeller && ['pending_payment', 'paid', 'in_delivery'].includes(order.status) && (
        <GlassCard className="mb-4 p-4">
          <p className="mb-2 text-sm text-white/50">Vous pouvez annuler cette vente à tout moment avant la livraison.</p>
          <button
            onClick={handleSellerCancelOrder}
            disabled={processing}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            Abandonner / Annuler la vente
          </button>
        </GlassCard>
      )}

      {/* Seller: OTP verification */}
      {isSeller && order.status === 'paid' && (
        <GlassCard className="mb-4 border-emerald-500/20 p-5" strong glow>
          <div className="mb-3 flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-400" />
            <h3 className="font-semibold">Vérification du code OTP</h3>
          </div>
          <p className="mb-3 text-sm text-white/50">
            L'acheteur doit vous donner son code à 6 chiffres en main propre au rendez-vous.
            Saisissez-le ci-dessous pour débloquer votre paiement.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-40 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-center text-2xl font-bold tracking-widest outline-none focus:border-white/30"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={processing || otpInput.trim().length !== 6}
              className="campus-gradient flex-1 rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {processing ? 'Vérification...' : 'Valider la livraison'}
            </button>
          </div>
        </GlassCard>
      )}

      {/* Buyer: waiting for delivery + revoir mon code */}
      {isBuyer && order.status === 'paid' && (
        <GlassCard className="mb-4 border-emerald-500/20 p-5">
          <div className="flex items-center gap-2 text-sm">
            <Handshake className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold">En attente de livraison</span>
          </div>
          <p className="mt-1.5 text-sm text-white/50">
            Rendez-vous au point de rencontre. Donnez votre code OTP au vendeur en main propre
            une fois l'objet récupéré — jamais par message.
          </p>

          <div className="mt-3 border-t border-white/10 pt-3">
            {revealedOtp ? (
              <div className="flex items-center justify-center gap-2.5">
                {revealedOtp.split('').map((digit, i) => (
                  <div key={i} className="campus-gradient flex h-11 w-9 items-center justify-center rounded-lg text-lg font-black text-white">
                    {digit}
                  </div>
                ))}
              </div>
            ) : (
              <button
                onClick={handleRevealOtp}
                disabled={revealing}
                className="glass flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              >
                <Eye className="h-4 w-4" /> {revealing ? 'Chargement...' : 'Revoir mon code'}
              </button>
            )}
            {revealedOtp && (
              <button
                onClick={() => setRevealedOtp(null)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs text-white/30 hover:text-white/50"
              >
                <EyeOff className="h-3 w-3" /> Masquer
              </button>
            )}
          </div>
        </GlassCard>
      )}

      {/* Dispute */}
      {(isBuyer || isSeller) && !isCompleted && !isDisputed && !isDisputePending && !isRefunded && order.status !== 'pending_payment' && (
        <div className="mb-4">
          {!showDispute ? (
            <button
              onClick={() => setShowDispute(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
            >
              <Flag className="h-4 w-4" /> Signaler un problème (Litige)
            </button>
          ) : (
            <GlassCard className="p-4">
              <h4 className="mb-2 text-sm font-semibold text-red-300">Ouvrir un litige</h4>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Expliquez le problème rencontré..."
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
              <div className="mt-2 flex gap-2">
                <button onClick={() => setShowDispute(false)} className="glass flex-1 rounded-lg py-2 text-sm font-medium">Annuler</button>
                <button onClick={handleDispute} disabled={processing} className="flex-1 rounded-lg bg-red-500/80 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {processing ? 'Envoi...' : 'Confirmer le litige'}
                </button>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {isDisputed && (
        <GlassCard className="mb-4 border-red-500/30 p-4">
          <div className="flex items-center gap-2 text-sm text-red-300">
            <AlertCircle className="h-5 w-5" /><span className="font-semibold">Litige en cours</span>
          </div>
          <p className="mt-1.5 text-sm text-white/50">{order.dispute_reason}</p>
          <p className="mt-2 text-xs text-white/30">L'administrateur examine la situation. Le paiement reste bloqué.</p>
        </GlassCard>
      )}

      {isCompleted && (
        <GlassCard className="p-4 border-emerald-500/20">
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle className="h-5 w-5" /><span className="font-semibold">Transaction complétée / Livrée</span>
          </div>
          <p className="mt-1.5 text-sm text-white/50">
            {isSeller ? 'Vous avez reçu votre paiement.' : 'Le vendeur a reçu son paiement.'}
          </p>
        </GlassCard>
      )}

      {/* Avis — uniquement l'acheteur, uniquement une fois la commande
          complétée, un seul avis par commande (contrainte unique côté base) */}
      {isCompleted && isBuyer && reviewLoaded && (
        <GlassCard className="mt-4 p-4">
          {existingReview ? (
            <div>
              <h4 className="mb-1.5 text-sm font-semibold">Votre avis</h4>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-4 w-4 ${n <= existingReview.rating ? 'fill-amber-400 text-amber-400' : 'text-white/15'}`} />
                ))}
              </div>
              {existingReview.comment && <p className="mt-1.5 text-sm text-white/60">{existingReview.comment}</p>}
            </div>
          ) : (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Évaluez le vendeur</h4>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setReviewRating(n)}>
                    <Star className={`h-6 w-6 transition ${n <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-white/15 hover:text-white/30'}`} />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Votre expérience avec ce vendeur (optionnel)..."
                rows={3}
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
              {reviewError && <p className="mt-1.5 text-xs text-red-400">{reviewError}</p>}
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="campus-gradient mt-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submittingReview ? 'Envoi...' : "Publier l'avis"}
              </button>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
