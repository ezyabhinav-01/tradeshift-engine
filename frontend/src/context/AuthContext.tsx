import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { useLearnStore } from '../store/useLearnStore';

interface User {
  id: number;
  email: string;
  full_name?: string;
  dob?: string;
  phone_number?: string;
  demat_id?: string;
  experience_level?: string;
  investment_goals?: string;
  risk_tolerance?: string;
  occupation?: string;
  city?: string;
  balance: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: any) => Promise<any>;
  register: (data: any) => Promise<void>;
  verifySignupOtp: (email: string, otp: string) => Promise<void>;
  finalizeSignupPin: (email: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('ts_cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!user); // instantly false if cached

  const checkAuth = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data);
      localStorage.setItem('ts_cached_user', JSON.stringify(response.data));
    } catch (error) {
      try {
        await axios.post('/auth/refresh');
        const retryResponse = await axios.get('/auth/me');
        setUser(retryResponse.data);
        localStorage.setItem('ts_cached_user', JSON.stringify(retryResponse.data));
      } catch (refreshError) {
        setUser(null);
        localStorage.removeItem('ts_cached_user');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (credentials: any) => {
    const response = await axios.post('/auth/login', credentials);
    if (!response.data.status) {
      setUser(response.data);
      localStorage.setItem('ts_cached_user', JSON.stringify(response.data));
    }
    return response.data;
  };

  const register = async (data: any) => {
    await axios.post('/auth/register/request', data);
  };

  const verifySignupOtp = async (email: string, otp: string) => {
    await axios.post('/auth/register/verify', { email, otp_code: otp });
  };

  const finalizeSignupPin = async (email: string, pin: string) => {
    const response = await axios.post('/auth/register/set-pin', { email, pin });
    setUser(response.data);
    localStorage.setItem('ts_cached_user', JSON.stringify(response.data));
  };

  const logout = async () => {
    try {
      await axios.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      useLearnStore.getState().resetStore();
      setUser(null);
      localStorage.removeItem('ts_cached_user');
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifySignupOtp, finalizeSignupPin, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
