import axios from 'axios';

import { API_BASE } from '../utils/api';

const API_URL = `${API_BASE}/auth`;

// Create axios instance with credentials support (Cookies)
const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // Sends HttpOnly Cookies
});

export const register = async (userData: any) => {
    // The backend now sets the cookie automatically
    const response = await api.post('/register', userData);
    return response.data;
};

export const login = async (userData: any) => {
    // The backend now sets the cookie automatically
    const response = await api.post('/login', userData);
    return response.data; // Returns User object
};

export const logout = async () => {
    const response = await api.post('/logout');
    return response.data;
};

export const checkAuthStatus = async () => {
    // Verify cookie validity
    const response = await api.get('/me');
    return response.data;
};
