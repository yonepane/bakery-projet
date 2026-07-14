/**
 * AuthContext — User authentication & session.
 * Small, rarely changes. Consumed by: Dashboard.tsx, POSPanel, SettingsPanel.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../lib/http';
import { api, processSyncQueue } from '../../lib/api';
import { type Language } from '../../i18n';
import type { UserSession } from './types';

interface AuthContextValue {
  user: UserSession | null;
  setUser: (u: UserSession | null) => void;
  authMode: 'login' | 'signup';
  setAuthMode: (m: 'login' | 'signup') => void;
  loginForm: { username: string; password: string };
  setLoginForm: React.Dispatch<React.SetStateAction<{ username: string; password: string }>>;
  signupForm: { username: string; password: string; confirmPassword: string };
  setSignupForm: React.Dispatch<React.SetStateAction<{ username: string; password: string; confirmPassword: string }>>;
  isAuthSubmitting: boolean;
  setIsAuthSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  handleLogin: (e: React.FormEvent) => Promise<void>;
  handleSignup: (e: React.FormEvent) => Promise<void>;
  handleGoogleSuccess: (response: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { t } = useTranslation();

  const [user, setUser] = useState<UserSession | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [signupForm, setSignupForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthSubmitting(true);
    try {
      const res = await http.post('/auth/login', loginForm);
      const { access_token, refresh_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      if (refresh_token) localStorage.setItem('bakery_refresh_token', refresh_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
    } catch (err) {
      // Toast will be added by parent via NotificationContext
      console.error('Login failed:', err);
      throw err;
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [loginForm]);

  const handleSignup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupForm.password !== signupForm.confirmPassword) {
      throw new Error(t('passwords_do_not_match'));
    }
    setIsAuthSubmitting(true);
    try {
      await http.post('/auth/signup', {
        username: signupForm.username,
        password: signupForm.password
      });
      const res = await http.post('/auth/login', {
        username: signupForm.username,
        password: signupForm.password
      });
      const { access_token, refresh_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      if (refresh_token) localStorage.setItem('bakery_refresh_token', refresh_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Signup failed');
    } finally {
      setIsAuthSubmitting(false);
    }
  }, [signupForm, t]);

  const handleGoogleSuccess = useCallback(async (response: any) => {
    try {
      const res = await http.post('/auth/google', { credential: response.credential });
      const { access_token, refresh_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      if (refresh_token) localStorage.setItem('bakery_refresh_token', refresh_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
    } catch (err) {
      console.error('Google sign-in failed:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('bakery_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error('Error loading user from storage', e);
      localStorage.removeItem('bakery_user');
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, setUser,
      authMode, setAuthMode,
      loginForm, setLoginForm,
      signupForm, setSignupForm,
      isAuthSubmitting, setIsAuthSubmitting,
      handleLogin, handleSignup, handleGoogleSuccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
};