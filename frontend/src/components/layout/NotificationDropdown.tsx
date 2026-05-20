import { useState } from 'react';
import { Bell, Check, Info, AlertTriangle, AlertCircle, CheckCheck, RefreshCw } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications();
  const [activeTab, setActiveTab] = useState<'official' | 'personal'>('official');

  const handleMarkAsRead = async (id: number) => {
    await markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  if (!isOpen) return null;

  const unreadCountOfficial = notifications.filter(n => n.category === 'official' && !n.is_read).length;
  const unreadCountPersonal = notifications.filter(n => n.category === 'personal' && !n.is_read).length;
  const filteredNotifications = notifications.filter(n => n.category === activeTab);

  const getIcon = (type: string, category: string) => {
    if (category === 'official') {
        return <CheckCheck className="text-indigo-500" size={18} />;
    }
    switch (type) {
      case 'alert':
        return <AlertTriangle className="text-amber-500" size={18} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={18} />;
      case 'success':
        return <Check className="text-emerald-500" size={18} />;
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
      <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-white/[0.02]">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
            Notifications
          </h3>
          <button 
            onClick={handleMarkAllAsRead}
            className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 transition-colors flex items-center gap-1 uppercase tracking-wider"
          >
            Mark all read
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-100/50 dark:bg-white/[0.02] p-2 flex gap-1 border-b border-slate-100 dark:border-white/5">
            <button
                onClick={() => setActiveTab('official')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'official' 
                        ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm' 
                        : 'text-slate-500 dark:text-gray-400 hover:bg-slate-200/50 dark:hover:bg-white/5'
                }`}
            >
                Official
                {unreadCountOfficial > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] px-1 rounded-full min-w-[14px]">
                        {unreadCountOfficial}
                    </span>
                )}
            </button>
            <button
                onClick={() => setActiveTab('personal')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'personal' 
                        ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm' 
                        : 'text-slate-500 dark:text-gray-400 hover:bg-slate-200/50 dark:hover:bg-white/5'
                }`}
            >
                Activity
                {unreadCountPersonal > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] px-1 rounded-full min-w-[14px]">
                        {unreadCountPersonal}
                    </span>
                )}
            </button>
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-12 flex justify-center">
              <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-gray-400">
              <Bell className="mx-auto mb-3 opacity-20" size={40} />
              <p className="text-sm font-black tracking-tight">No {activeTab} notifications</p>
              <p className="text-[10px] opacity-60 mt-1">Updates will appear here as they happen.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredNotifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-4 flex gap-4 hover:bg-slate-50 dark:hover:bg-indigo-500/[0.02] transition-colors relative group ${!notification.is_read ? 'bg-indigo-500/[0.01]' : ''}`}
                >
                  <div className={`mt-1 h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      notification.category === 'official' 
                        ? 'bg-indigo-500/10 border-indigo-500/10' 
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200/50 dark:border-white/5'
                  }`}>
                    {getIcon(notification.type, notification.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm tracking-tight leading-snug ${!notification.is_read ? 'text-slate-900 dark:text-white font-black' : 'text-slate-600 dark:text-gray-400 font-bold'}`}>
                      {notification.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                      {notification.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-black uppercase text-slate-400 dark:text-gray-600">
                           {formatTime(notification.created_at)}
                        </span>
                        {!notification.is_read && (
                            <span className="w-1 h-1 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50" />
                        )}
                    </div>
                  </div>
                  {!notification.is_read && (
                    <button 
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg h-fit text-indigo-500"
                      title="Mark read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01] flex justify-center">
           <button 
            onClick={onClose}
            className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
           >
             Close Feed
           </button>
        </div>
      </div>
    </>
  );
}
