import React from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { Bell, Check, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    default: return <Info className="w-4 h-4 text-blue-500" />;
  }
};

const NotificationPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { notifications, markAsRead } = useNotifications();

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
        <h3 className="text-sm font-bold dark:text-white flex items-center gap-2">
          <Bell className="w-4 h-4" /> Notifications
        </h3>
        <Link 
          to="/notifications" 
          onClick={onClose}
          className="text-xs text-tv-primary hover:underline font-medium"
        >
          View all
        </Link>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500 dark:text-gray-500 text-xs">
            No notifications yet
          </div>
        ) : (
          notifications.slice(0, 5).map((notification) => (
            <div 
              key={notification.id}
              className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group relative ${!notification.is_read ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''}`}
            >
              <div className="flex gap-3">
                <div className="mt-1 flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className={`text-sm font-semibold truncate ${notification.is_read ? 'text-slate-700 dark:text-gray-300' : 'text-slate-900 dark:text-white'}`}>
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                        className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Mark as read"
                      >
                        <Check size={12} className="text-slate-500" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                    {notification.content}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1 cursor-default">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {notifications.length > 5 && (
        <div className="px-4 py-2 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
          <Link 
            to="/notifications" 
            onClick={onClose}
            className="text-xs text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white w-full text-center block font-medium"
          >
            See {notifications.length - 5} more
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
