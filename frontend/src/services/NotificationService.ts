import axios from 'axios';

import { API_BASE } from '../utils/api';

// Assuming vite proxies /api requests to backend
const api = axios.create({
    baseURL: `${API_BASE}/api/notifications`,
    withCredentials: true,
});

export interface Notification {
    id: number;
    title: string;
    content: string;
    type: string;
    category: string;
    is_read: boolean;
    created_at: string;
}

export const getNotifications = async (): Promise<Notification[]> => {
    const response = await api.get('/');
    return response.data;
};

export const markAsRead = async (id: number): Promise<Notification> => {
    const response = await api.patch(`/${id}/read`);
    return response.data;
};

export const markAllAsRead = async () => {
    const response = await api.post('/mark-all-read');
    return response.data;
};
