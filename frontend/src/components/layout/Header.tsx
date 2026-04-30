import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertCircle, Info, AlertTriangle, X, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationApi } from '../../services/api';

// ---------------------------------------------------------------------------
// Notification feed
// ---------------------------------------------------------------------------
// The backend computes notifications live from operational state. The
// frontend handles "read/dismissed" entirely in localStorage — once a user
// dismisses a notification, its id goes into a Set and never appears again
// in this browser. New notifications (with new ids) show up normally.
// ---------------------------------------------------------------------------

type NotifType = 'info' | 'warning' | 'urgent';
interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  link?: string;
  timestamp: string;
}

const DISMISSED_KEY = 'medbook.notifications.dismissed';
const loadDismissed = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};
const saveDismissed = (set: Set<string>) => {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore — storage full or disabled. Not worth blocking UI.
  }
};

const ICONS: Record<NotifType, React.ReactNode> = {
  info:    <Info size={16} className="text-blue-600" />,
  warning: <AlertTriangle size={16} className="text-amber-600" />,
  urgent:  <AlertCircle size={16} className="text-red-600" />,
};

const TYPE_BG: Record<NotifType, string> = {
  info:    'bg-blue-50',
  warning: 'bg-amber-50',
  urgent:  'bg-red-50',
};

const Header: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load notifications on mount and whenever the user changes (login / logout).
  // We deliberately do NOT poll on a timer — the rate limiter would dislike
  // it and the value of real-time bells in a thesis demo is low.
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list();
      setNotifications(res.data.data ?? []);
    } catch {
      // Silently fail — a broken bell shouldn't break the page.
    } finally {
      setLoading(false);
    }
  };

  const visible = notifications.filter((n) => !dismissed.has(n.id));
  const unreadCount = visible.length;

  const handleBellClick = () => {
    const next = !open;
    setOpen(next);
    // Refresh on open so the user sees current state
    if (next) fetchNotifications();
  };

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(dismissed);
    newSet.add(id);
    setDismissed(newSet);
    saveDismissed(newSet);
  };

  const handleDismissAll = () => {
    const newSet = new Set(dismissed);
    visible.forEach((n) => newSet.add(n.id));
    setDismissed(newSet);
    saveDismissed(newSet);
  };

  const handleClick = (n: Notification) => {
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  };

  const formatTime = (iso: string): string => {
    const d = new Date(iso);
    const diffMs = d.getTime() - Date.now();
    const diffH = Math.round(diffMs / (1000 * 60 * 60));
    if (Math.abs(diffH) < 1) return 'just now';
    if (diffH > 0 && diffH < 24) return `in ${diffH}h`;
    if (diffH < 0 && diffH > -24) return `${Math.abs(diffH)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="flex items-center justify-end gap-3 w-full">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handleBellClick}
          className="relative p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          aria-label="Notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                <p className="text-xs text-gray-500">
                  {unreadCount === 0 ? 'You are all caught up' : `${unreadCount} unread`}
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleDismissAll}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading && visible.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
              ) : visible.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No new notifications</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {visible.map((n) => (
                    <li
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`group flex items-start gap-3 px-4 py-3 ${TYPE_BG[n.type]} ${
                        n.link ? 'cursor-pointer hover:brightness-95' : ''
                      } transition-all`}
                    >
                      <div className="flex-shrink-0 mt-0.5">{ICONS[n.type]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{formatTime(n.timestamp)}</p>
                      </div>
                      <button
                        onClick={(e) => handleDismiss(n.id, e)}
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Dismiss"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
          <span className="text-xs font-semibold text-primary-700">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </span>
        </div>
        <span className="text-sm font-medium text-gray-700 hidden lg:inline">
          {user?.role === 'doctor' ? 'Dr. ' : ''}{user?.firstName} {user?.lastName}
        </span>
      </div>
    </div>
  );
};

export default Header;