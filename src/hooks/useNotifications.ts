import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Notification } from '@/lib/types';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const load = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error) setNotifications((data as Notification[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Temps réel : nouvelles notifications reçues en direct, mises à jour
  // (ex. lues depuis un autre onglet) reflétées aussi.
  // ⚠️ Nécessite `alter publication supabase_realtime add table notifications`
  // (fait dans 008_notifications.sql) — sinon cet abonnement ne reçoit rien,
  // sans erreur visible.
  useEffect(() => {
    // Garde explicite sur user?.id (pas juste `user`) : tant que ce n'est
    // pas une chaîne valide, on ne construit même pas le nom du canal ni le
    // filtre — impossible de se retrouver avec `user_id=eq.undefined`.
    const uid = user?.id;
    if (!uid) return;

    // Filet de sécurité client, en plus du filtre serveur : même si un
    // événement passait malgré tout (mauvais filtre, RLS mal appliquée à la
    // diffusion...), on ignore silencieusement tout ce qui n'appartient pas
    // réellement à cet utilisateur avant de toucher au state React. Cette
    // vérification ne dépend d'aucune hypothèse sur la cause exacte d'une
    // éventuelle fuite — elle garantit juste que l'affichage, lui, ne fuira
    // jamais, quoi qu'il arrive en amont.
    const belongsToMe = (row: { user_id?: string }) => row.user_id === uid;

    const channel = supabase
      .channel(`notifications-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => {
          const incoming = payload.new as Notification;
          if (!belongsToMe(incoming)) return;
          setNotifications((prev) => [incoming, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => {
          const updated = payload.new as Notification;
          if (!belongsToMe(updated)) return;
          setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))); // optimiste
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) load(); // resynchronise si l'update a échoué
  }, [load]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    const hasUnread = notifications.some((n) => !n.read);
    if (!hasUnread) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); // optimiste
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    if (error) load();
  }, [user, notifications, load]);

  const removeNotification = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id)); // optimiste
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) load();
  }, [load]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, removeNotification, refresh: load };
}
