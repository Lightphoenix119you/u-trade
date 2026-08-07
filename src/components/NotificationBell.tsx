import { useEffect, useRef, useState } from 'react';
import { Bell, Check, X, Package, AlertTriangle, Info } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { timeAgo } from '../lib/format';
import type { Notification } from '../lib/types';

interface NotificationBellProps {
  navigate: (path: string) => void;
}

function typeIcon(type: Notification['type']) {
  if (type === 'order') return Package;
  if (type === 'dispute') return AlertTriangle;
  return Info;
}

export function NotificationBell({ navigate }: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    setOpen(false);
    if (n.link_url) navigate(n.link_url);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-white/60 transition hover:bg-white/5 hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[100] mt-2 max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-2 shadow-2xl">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="flex items-center gap-1 text-xs text-white/40 transition hover:text-white">
                <Check className="h-3 w-3" /> Tout marquer lu
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-white/30">Aucune notification</p>
          ) : (
            <div className="space-y-0.5">
              {notifications.map((n) => {
                const Icon = typeIcon(n.type);
                return (
                  <div
                    key={n.id}
                    className={`group flex items-start gap-2.5 rounded-lg px-3 py-2.5 transition hover:bg-white/10 ${!n.read ? 'bg-white/5' : ''}`}
                  >
                    <button onClick={() => handleClick(n)} className="flex flex-1 items-start gap-2.5 text-left">
                      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${n.type === 'dispute' ? 'text-red-400' : 'text-white/40'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {!n.read && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />}
                          <span className="truncate text-sm font-medium text-white">{n.title}</span>
                        </div>
                        <p className="line-clamp-2 text-xs text-white/50">{n.message}</p>
                        <span className="text-[11px] text-white/30">{timeAgo(n.created_at)}</span>
                      </div>
                    </button>
                    <button
                      onClick={() => removeNotification(n.id)}
                      className="flex-shrink-0 rounded p-1 text-white/0 transition group-hover:text-white/30 hover:!text-white/70"
                      aria-label="Supprimer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
