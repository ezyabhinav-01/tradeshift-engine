import React from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { Bell, Info, AlertTriangle, CheckCircle, XCircle, CheckSquare, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
    case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    default: return <Info className="w-5 h-5 text-blue-500" />;
  }
};

const NotificationsPage: React.FC = () => {
  const { notifications, loading, fetchNotifications, markAsRead } = useNotifications();

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-gradient-to-br from-slate-200/50 via-slate-100 to-slate-200 dark:from-blue-900/10 dark:via-black dark:to-black min-h-screen text-black dark:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-xl backdrop-blur-md">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1 font-['Montserrat'] flex items-center gap-3">
             <Bell className="w-8 h-8 text-tv-primary" /> Notifications Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-2">
            Stay updated with the latest alerts from the TradeShift Admin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchNotifications}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white border border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg bg-white dark:bg-white/5 transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white border border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg bg-white dark:bg-white/5 transition-all shadow-sm"
          >
            <CheckSquare className="w-4 h-4" /> Mark all read
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.03)] transition-all">
        {notifications.length === 0 ? (
          <div className="py-24 text-center">
            <Bell className="w-16 h-16 text-slate-200 dark:text-white/5 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-gray-500 font-medium">No notifications in your history.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {notifications.map((notification) => (
              <div 
                key={notification.id}
                className={`p-6 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors relative group ${!notification.is_read ? 'bg-blue-50/30 dark:bg-blue-500/[0.03]' : ''}`}
              >
                <div className="flex gap-4">
                  <div className="mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className={`text-lg font-bold tracking-tight ${notification.is_read ? 'text-slate-700 dark:text-gray-300' : 'text-slate-900 dark:text-white'}`}>
                          {notification.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1 uppercase font-bold tracking-widest">
                          {format(new Date(notification.created_at), 'PPP • p')}
                        </p>
                      </div>
                      {!notification.is_read && (
                        <Button 
                          onClick={() => markAsRead(notification.id)}
                          variant="ghost" 
                          size="sm"
                          className="h-8 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-100/50 text-blue-700 hover:bg-blue-200/50 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 border border-blue-200/50 dark:border-blue-500/20 transition-all"
                        >
                          Mark as Read
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed font-medium bg-slate-50 dark:bg-white/[0.01] p-3 rounded-lg border border-slate-100 dark:border-white/5 shadow-inner dark:shadow-none">
                      {notification.content}
                    </p>
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
