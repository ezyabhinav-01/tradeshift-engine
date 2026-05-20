import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { wsUrl } from '../utils/api';

export interface Notification {
  id: number;
  user_id: number | null;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'alert' | 'system';
  category: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const upsertNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => {
      const exists = prev.some((item) => item.id === notification.id);
      const next = exists
        ? prev.map((item) => (item.id === notification.id ? { ...item, ...notification } : item))
        : [notification, ...prev];

      return next.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    if (!notification.is_read) {
      const toastFn = notification.type === 'error'
        ? toast.error
        : notification.type === 'warning'
          ? toast.warning
          : notification.type === 'success'
            ? toast.success
            : toast.info;

      toastFn(notification.title, {
        description: notification.content,
        duration: 6000,
      });
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await axios.get('/api/notifications/');
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    fetchNotifications();
    // Keep a quiet polling fallback in case a mobile network suspends websockets.
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, user]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      clearReconnectTimer();
      const socket = new WebSocket(wsUrl('/ws/orders'));
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message?.type === 'notification:new' && message.data) {
            upsertNotification(message.data as Notification);
          }
        } catch (error) {
          console.error('Failed to parse notification websocket message:', error);
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        const attempt = Math.min(reconnectAttemptsRef.current + 1, 6);
        reconnectAttemptsRef.current = attempt;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 15000);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close(1000);
        socketRef.current = null;
      }
    };
  }, [upsertNotification, user]);

  const markAsRead = async (id: number) => {
    try {
      await axios.patch(`/api/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
        toast.error("Failed to update notification");
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post('/api/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
      toast.error("Failed to update notifications");
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
