import React, { useState } from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { 
  Bell, 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  CheckSquare, 
  RefreshCw, 
  ShieldCheck, 
  Activity,
  History,
  TrendingUp,
  AlertOctagon
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

const getNotificationIcon = (type: string, category: string) => {
  if (category === 'official') {
    return <ShieldCheck className="w-6 h-6 text-indigo-500" />;
  }
  
  switch (type) {
    case 'success': return <TrendingUp className="w-5 h-5 text-emerald-500" />;
    case 'error': return <AlertOctagon className="w-5 h-5 text-rose-500" />;
    case 'alert': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    case 'system': return <Activity className="w-5 h-5 text-blue-500" />;
    default: return <Info className="w-5 h-5 text-slate-500" />;
  }
};

const NotificationsPage: React.FC = () => {
  const { notifications, loading, fetchNotifications, markAsRead } = useNotifications();
  const [activeTab, setActiveTab] = useState<'official' | 'personal'>('official');

  const filteredNotifications = notifications.filter(n => n.category === activeTab);
  const unreadOfficial = notifications.filter(n => n.category === 'official' && !n.is_read).length;
  const unreadPersonal = notifications.filter(n => n.category === 'personal' && !n.is_read).length;

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-[#111111]/80 border border-slate-200 dark:border-white/5 p-8 rounded-2xl backdrop-blur-xl shadow-xl">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2 flex items-center gap-3">
             <Bell className="w-8 h-8 text-indigo-500" /> Notifications
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            Stay informed with official updates and track your real-time account activity.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchNotifications}
            className="flex items-center gap-2 h-10 px-4 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all font-bold text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Sync
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all font-bold shadow-lg shadow-indigo-600/20 text-xs"
          >
            <CheckSquare className="w-3.5 h-3.5" /> Mark All Read
          </Button>
        </div>
      </div>

      {/* Tabs Control */}
      <div className="flex gap-1 p-1 bg-slate-200/50 dark:bg-white/5 rounded-2xl w-full max-w-md mx-auto md:mx-0">
        <button
          onClick={() => setActiveTab('official')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${
            activeTab === 'official' 
              ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-lg' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'
          }`}
        >
          <ShieldCheck size={18} />
          Official Desk
          {unreadOfficial > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px]">
              {unreadOfficial}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('personal')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${
            activeTab === 'personal' 
              ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-lg' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'
          }`}
        >
          <Activity size={18} />
          Account Activity
          {unreadPersonal > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px]">
              {unreadPersonal}
            </span>
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="py-32 text-center bg-white dark:bg-white/[0.01] border border-dashed border-slate-200 dark:border-white/5 rounded-3xl">
            {activeTab === 'official' ? (
              <ShieldCheck className="w-16 h-16 text-slate-200 dark:text-white/5 mx-auto mb-4" />
            ) : (
              <History className="w-16 h-16 text-slate-200 dark:text-white/5 mx-auto mb-4" />
            )}
            <p className="text-slate-500 dark:text-gray-500 font-black text-lg">
              {activeTab === 'official' ? 'No announcements yet.' : 'Your activity feed is empty.'}
            </p>
            <p className="text-slate-400 dark:text-gray-600 text-sm mt-1">
              New updates will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredNotifications.map((notification) => (
              <div 
                key={notification.id}
                className={`group p-1 rounded-2xl transition-all border ${
                  !notification.is_read 
                    ? 'border-indigo-500/20 bg-indigo-500/[0.02] active-notif' 
                    : 'border-slate-100 dark:border-white/5 bg-white dark:bg-white/[0.02]'
                } hover:shadow-xl hover:shadow-black/5`}
              >
                <div className="p-5 flex gap-5">
                  <div className={`mt-1 h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                    notification.category === 'official' 
                      ? 'bg-indigo-500/10 text-indigo-600' 
                      : 'bg-slate-100 dark:bg-white/5'
                  }`}>
                    {getNotificationIcon(notification.type, notification.category)}
                  </div>
                  
                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <h4 className={`text-lg font-black truncate tracking-tight transition-colors ${
                          !notification.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                        }`}>
                          {notification.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
                             {format(new Date(notification.created_at), 'PPP')}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-500">
                             {format(new Date(notification.created_at), 'p')}
                          </span>
                        </div>
                      </div>
                      
                      {!notification.is_read && (
                        <button 
                          onClick={() => markAsRead(notification.id)}
                          className="px-3 h-8 rounded-lg bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20"
                        >
                          Mark Viewed
                        </button>
                      )}
                    </div>
                    
                    <div className="relative">
                       <p className={`text-sm leading-relaxed font-medium p-4 rounded-xl border ${
                         !notification.is_read 
                          ? 'bg-white dark:bg-black/20 border-indigo-500/10 text-slate-700 dark:text-slate-200' 
                          : 'bg-slate-50 dark:bg-white/[0.01] border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400'
                       }`}>
                         {notification.content}
                       </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
