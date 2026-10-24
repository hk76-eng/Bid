import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, Info, AlertTriangle, Check } from 'lucide-react';
import { MotorideNotification } from '../../types/motoride';
import { motorideApi } from '../../services/motorideApi';
import { realtimeSync } from '../../services/realtimeSync';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReadCountChange?: (unreadCount: number) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onReadCountChange,
}) => {
  const [notifications, setNotifications] = useState<MotorideNotification[]>([]);

  useEffect(() => {
    loadNotifications();

    const unsub = realtimeSync.on('RIDE_UPDATED', () => {
      loadNotifications();
    });
    const unsubCreate = realtimeSync.on('RIDE_CREATED', () => {
      loadNotifications();
    });

    return () => {
      unsub();
      unsubCreate();
    };
  }, []);

  const loadNotifications = async () => {
    try {
      const list = await motorideApi.getNotifications();
      setNotifications(list);
      const unread = list.filter((n) => !n.is_read).length;
      onReadCountChange?.(unread);
    } catch {}
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    onReadCountChange?.(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-extrabold text-white">In-App Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
          {notifications.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">No notifications yet</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-2xl border transition-colors flex items-start gap-3 ${
                  n.is_read
                    ? 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                    : 'bg-slate-950 border-emerald-500/30 text-slate-200'
                }`}
              >
                <div className="mt-0.5">
                  {n.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                  {n.type === 'info' && <Info className="w-4 h-4 text-sky-400" />}
                  {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  {n.type === 'alert' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                </div>
                <div className="flex-1 text-xs">
                  <span className="font-bold block text-white">{n.title}</span>
                  <p className="mt-0.5 text-slate-300">{n.message}</p>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {new Date(n.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
