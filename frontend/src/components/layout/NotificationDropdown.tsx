import { useEffect, useState } from 'react';
import { Bell, Check, Info, AlertTriangle, AlertCircle, X, CheckCheck } from 'lucide-react';
import { getNotifications, markAsRead, markAllAsRead, type Notification } from '../../services/NotificationService';
import { useAuth } from '../../context/AuthContext';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && user) {
      loadNotifications();
    }
  }, [isOpen, user]);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const data = await getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await markAsRead(id);
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, is_read: true } : n
      ));
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertTriangle className="text-amber-500" size={18} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={18} />;
      case 'success':
        return <Check className="text-green-500" size={18} />;
      default:
        return <Info className="text-blue-500" size={18} />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-white/[0.02]">
          <h3 className="font-semibold text-slate-800 dark:text-gray-200 flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <span className="bg-tv-primary text-white text-[10px] px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllAsRead}
              className="text-xs text-tv-primary hover:underline flex items-center gap-1"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-4 flex justify-center">
              <div className="w-5 h-5 border-2 border-tv-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-gray-400">
              <Bell className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">You have no notifications yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-4 flex gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors ${!notification.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                >
                  <div className="mt-1 shrink-0">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm tracking-tight ${!notification.is_read ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-600 dark:text-gray-300'}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <span className="text-[10px] text-slate-400 dark:text-gray-500 mt-2 block">
                      {formatTime(notification.created_at)}
                    </span>
                  </div>
                  {!notification.is_read && (
                    <button 
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="shrink-0 group flex items-start justify-center p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full h-fit transition-colors"
                      title="Mark as read"
                    >
                      <div className="w-2 h-2 rounded-full bg-tv-primary group-hover:bg-transparent transition-colors"></div>
                      <Check className="hidden group-hover:block text-slate-600 dark:text-white" size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-2 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
           <button 
            onClick={onClose}
            className="w-full text-xs text-center text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white py-1"
           >
             Close
           </button>
        </div>
      </div>
    </>
  );
}
