import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';

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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      // If access token is expired or missing, try silent refresh
      try {
        await axios.post('/auth/refresh');
        // If refresh succeeds, try getting the user profile again
        const retryResponse = await axios.get('/auth/me');
        setUser(retryResponse.data);
      } catch (refreshError) {
        setUser(null);
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
  };

  const logout = async () => {
    try {
      await axios.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Explicitly redirect to home page on logout
      // We don't call setUser(null) here to avoid React re-rendering the current protected page 
      // which might trigger a sub-redirect to /login before the browser can reload the home page.
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
