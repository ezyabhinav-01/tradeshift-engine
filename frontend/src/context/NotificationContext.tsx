import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

export interface Notification {
  id: number;
  user_id: number | null;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  is_read: boolean;
  created_at: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await axios.get('/api/notifications/');
      setNotifications(response.data);
      setUnreadCount(response.data.filter((n: Notification) => !n.is_read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    // Poll for notifications every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id: number) => {
    try {
      await axios.patch(`/api/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
        toast.error("Failed to update notification");
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, fetchNotifications, markAsRead }}>
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
