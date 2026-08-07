import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, ShieldAlert, ShieldCheck, CheckCheck, BellRing, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { detectBlockedContent, sanitizeText } from '@/lib/antiCircumvention';
import { messageSchema } from '@/lib/validation';
import type { Message, Profile, OrderStatus } from '@/lib/types';

interface OrderChatProps {
  orderId: string;
  otherUserId: string;
  orderStatus: OrderStatus;
}

const LOCKED_STATUSES: OrderStatus[] = ['disputed', 'refunded', 'cancelled', 'completed'];

const MAX_TEXTAREA_HEIGHT = 128; // px, ~ max-h-32
const MIN_TEXTAREA_HEIGHT = 40; // px, ~ 1 ligne

/*
 * Fil de discussion lié à une commande précise (order_id), pour convenir
 * d'un lieu de rendez-vous en toute confidentialité — style bulles WhatsApp.
 *
 * ⚠️ Table réelle : `messages` (colonne order_id), pas "order_messages" —
 * cette dernière n'existe pas dans le schéma. Deux niveaux de filtrage :
 * 1. Ici (client) : aperçu masqué en direct pendant la frappe via
 *    sanitizeText()/detectBlockedContent() (regex renforcées : téléphone,
 *    email, liens/réseaux sociaux).
 * 2. En base (trigger sanitize_message_content, déjà existant) : c'est LUI
 *    qui fait foi — calcule `content` à partir de `raw_content` à
 *    l'insertion, même si ce filtre client était contourné.
 *
 * Le message part toujours (masqué), il n'est jamais bloqué à l'envoi.
 */
export function OrderChat({ orderId, otherUserId, orderStatus }: OrderChatProps) {
  const { user } = useAuth();
  const isLocked = LOCKED_STATUSES.includes(orderStatus);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [unseenCount, setUnseenCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isWindowFocusedRef = useRef(true);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: msgs, error: msgsError }, { data: profile }] = await Promise.all([
      supabase.from('messages').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
      supabase.from('profiles').select('*').eq('id', otherUserId).maybeSingle(),
    ]);
    if (msgsError) {
      console.error('OrderChat: échec chargement des messages', msgsError);
      setChatError(`Impossible de charger la conversation : ${msgsError.message}`);
    }
    setMessages((msgs as Message[]) || []);
    setOtherUser((profile as Profile) || null);
    setLoading(false);
  }, [orderId, otherUserId]);

  useEffect(() => { load(); }, [load]);

  // Défilement automatique vers le bas à chaque nouveau message (pas de
  // scroll fluide au tout premier chargement, pour éviter un effet "saut").
  const firstLoadRef = useRef(true);
  useEffect(() => {
    if (loading) return;
    scrollToBottom(!firstLoadRef.current);
    firstLoadRef.current = false;
  }, [messages.length, loading, scrollToBottom]);

  // Suivi de la visibilité de l'onglet : sert à décider quand afficher le
  // badge "nouveaux messages" et à le remettre à zéro au retour sur l'onglet.
  useEffect(() => {
    const handleVisibility = () => {
      isWindowFocusedRef.current = document.visibilityState === 'visible';
      if (isWindowFocusedRef.current) {
        setUnseenCount(0);
        scrollToBottom(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [scrollToBottom]);

  // Bip discret synthétisé via Web Audio API — pas de fichier audio à
  // charger, juste une courte tonalité générée à la volée.
  const playNotificationSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.22);
      oscillator.onended = () => ctx.close();
    } catch {
      // Web Audio indisponible ou bloquée (pas d'interaction utilisateur
      // préalable) — silencieux, ce n'est qu'un agrément.
    }
  }, []);

  // Temps réel : ajoute le message directement depuis le payload reçu, sans
  // re-fetch complet — sender_id/content/created_at suffisent à l'affichage
  // d'une bulle, donc l'ajout est instantané. Déclenche aussi le son et le
  // badge visuel pour les messages venant de l'AUTRE utilisateur.
  useEffect(() => {
    const channel = supabase
      .channel(`order-chat-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev; // évite un doublon si déjà ajouté en optimiste
            return [...prev, incoming];
          });

          if (incoming.sender_id !== user?.id) {
            playNotificationSound();
            if (!isWindowFocusedRef.current) {
              setUnseenCount((c) => c + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, user?.id, playNotificationSound]);

  // Textarea auto-extensible : hauteur recalculée à chaque frappe, entre
  // MIN_TEXTAREA_HEIGHT (~1 ligne) et MAX_TEXTAREA_HEIGHT (~128px), au-delà
  // de quoi le défilement interne prend le relais (overflow-y-auto).
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  useEffect(() => { resizeTextarea(); }, [input, resizeTextarea]);

  const handleChange = (value: string) => {
    setInput(value);
    setWarning(detectBlockedContent(value));
  };

  const handleSend = async () => {
    if (!user || !input.trim() || sending || isLocked) return;
    const trimmed = input.trim();
    const parsed = messageSchema.safeParse({ raw_content: trimmed });
    if (!parsed.success) {
      setChatError(parsed.error.issues[0]?.message || 'Message invalide');
      return;
    }

    setChatError(null);
    setSending(true);

    // Calcule `content` ici plutôt que de compter uniquement sur le trigger
    // serveur sanitize_message_content : si ce trigger n'est pas actif sur
    // la base (migration jamais rejouée), l'insertion échouerait sur la
    // contrainte NOT NULL de `content`.
    const sanitized = sanitizeText(parsed.data.raw_content);

    // conversation_id est de type uuid NOT NULL en base : une conversation
    // OrderChat correspond 1:1 à une commande, order_id est donc déjà
    // l'identifiant stable et valide à utiliser ici.
    const { error } = await supabase.from('messages').insert({
      conversation_id: orderId,
      sender_id: user.id,
      recipient_id: otherUserId,
      order_id: orderId,
      raw_content: parsed.data.raw_content,
      content: sanitized,
      is_filtered: sanitized !== parsed.data.raw_content,
    });

    setSending(false);

    if (error) {
      console.error('OrderChat: échec envoi message', error);
      setChatError(
        error.code === '42501' || error.message.toLowerCase().includes('row-level security')
          ? "Vous n'êtes pas autorisé à envoyer un message pour cette commande."
          : `Échec de l'envoi : ${error.message}`
      );
      return;
    }

    setInput('');
    setWarning(null);
    requestAnimationFrame(resizeTextarea);
  };

  const previewMasked = warning ? sanitizeText(input) : null;

  return (
    <div className="flex h-full flex-col">
      {/* En-tête : avatar, nom, badge de sécurité, badge nouveaux messages */}
      <div className="mb-3 flex items-center gap-3 border-b border-white/10 pb-3">
        <div className="relative flex-shrink-0">
          {otherUser?.avatar_url ? (
            <img src={otherUser.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
              {otherUser?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          {unseenCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unseenCount > 9 ? '9+' : unseenCount}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{otherUser?.full_name || 'Utilisateur'}</div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400/80">
            <ShieldCheck className="h-3 w-3" /> Conversation sécurisée
          </div>
        </div>
        {unseenCount > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-[11px] font-medium text-red-300">
            <BellRing className="h-3 w-3" /> Nouveau
          </div>
        )}
      </div>

      {/* Bulles de messages */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 320, minHeight: 160 }}>
        {loading ? (
          <div className="flex h-full items-center justify-center py-10">
            <div className="skeleton h-6 w-6 rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-xs text-white/30">
            Aucun message. Convenez d'un lieu de rendez-vous ici.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? 'campus-gradient rounded-br-sm text-white'
                      : 'rounded-bl-sm bg-white/10 text-white/90'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  {m.is_filtered && (
                    <p className={`mt-1 text-[10px] italic ${mine ? 'text-white/70' : 'text-amber-400/70'}`}>
                      Coordonnées masquées
                    </p>
                  )}
                  <div
                    className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                      mine ? 'text-white/70' : 'text-white/30'
                    }`}
                  >
                    {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {mine && <CheckCheck className="h-3 w-3" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {isLocked ? (
        <div className="my-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-white/50">
          <Lock className="h-3.5 w-3.5 flex-shrink-0" />
          Cette conversation est verrouillée (commande terminée, annulée ou en litige).
        </div>
      ) : (
        <div className="my-2 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5 text-xs text-blue-300">
          <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" />
          Ne partagez jamais votre code OTP ici. Numéros, emails, liens et identifiants réseaux sociaux sont automatiquement masqués.
        </div>
      )}

      {chatError && (
        <p className="mb-1.5 text-xs text-red-400">{chatError}</p>
      )}
      {warning && !isLocked && (
        <p className="mb-1.5 text-xs text-amber-400">
          {warning} Aperçu envoyé : <span className="italic">{previewMasked}</span>
        </p>
      )}

      {/* Saisie — textarea auto-extensible, Entrée envoie, Maj+Entrée = saut de ligne */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={isLocked ? 'Conversation verrouillée' : 'Convenir du lieu de rendez-vous...'}
          rows={1}
          disabled={isLocked}
          style={{ minHeight: MIN_TEXTAREA_HEIGHT, maxHeight: MAX_TEXTAREA_HEIGHT }}
          className="max-h-32 flex-1 resize-none overflow-y-auto rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim() || isLocked}
          className="campus-gradient flex-shrink-0 rounded-lg px-3 py-2.5 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
