import React, { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { GoogleLogin } from '@react-oauth/google';
import { useTranslation } from 'react-i18next';
import { GOOGLE_CLIENT_ID } from '../constants';
import http from '../../../lib/http';
import { useNotificationSelector, useServerDataSelector } from '../DashboardContext';
import { type Language } from '../../../i18n';
import type { UserSession } from '../types';
import {
  Box, Sun, Moon, ChevronRight, ChevronLeft, ChevronDown,
  CheckCircle, Info, Brain, XCircle, Truck, ChefHat, MessageSquare,
  Send, Eye, EyeOff, BarChart2, Users, Clock, Bell, ClipboardList, Activity
} from 'lucide-react';

interface AuthGateProps {
  user: UserSession | null;
  setUser: (u: UserSession | null) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ user, setUser }) => {
  const { t, i18n } = useTranslation();
  const { addToast } = useNotificationSelector();
  const { setLoading, fetchData } = useServerDataSelector();

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [signupForm, setSignupForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: FormEvent) => {
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
      addToast(t('invalid_credentials'), 'error');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (signupForm.password !== signupForm.confirmPassword) {
      addToast(t('passwords_do_not_match'), 'error');
      return;
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
      addToast(t('bakery_ready'), 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Signup failed', 'error');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (response: any) => {
    try {
      const res = await http.post('/auth/google', { credential: response.credential });
      const { access_token, refresh_token, username, role } = res.data;
      localStorage.setItem('bakery_token', access_token);
      if (refresh_token) localStorage.setItem('bakery_refresh_token', refresh_token);
      localStorage.setItem('bakery_user', JSON.stringify({ username, role }));
      setUser({ username, role });
      addToast(t('welcome_back'), 'success');
    } catch (err) {
      addToast(t('google_sign_in_failed'), 'error');
    }
  };

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('bakery_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error('Error loading user from storage', e);
      localStorage.removeItem('bakery_user');
      setLoading(false);
    }
  }, []);

  // Mobile View
  const mobileView = (
    <div className="lg:hidden flex w-full flex-col items-center justify-center min-h-screen min-h-[100dvh] p-6 relative">
      <div className="absolute inset-0 z-0">
        <img src="/pain.png" alt={t('premium_bakery_background')} className="w-full h-full object-cover opacity-40 grayscale-[0.2]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/80 to-[#060606]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.15)_0%,transparent_80%)]"></div>
      </div>
      <div className="relative z-10 w-full max-w-sm rounded-[2rem] border border-white/10 bg-black/60 backdrop-blur-2xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="h-16 w-16 rounded-full overflow-hidden border border-gold/40 shadow-[0_0_20px_rgba(212,175,55,0.4)] mb-6">
            <img src="/columbina-login.jpg" alt={t('crest')} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-light tracking-[0.2em] uppercase text-white font-serif leading-none">
            {t('bakery')}<span className="font-bold text-gold">OS</span>
          </h1>
        </div>
        <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="space-y-6">
          <div className="relative group">
            <input
              id="mobile-username"
              type="text"
              value={authMode === 'login' ? loginForm.username : signupForm.username}
              onChange={e => authMode === 'login'
                ? setLoginForm({ ...loginForm, username: e.target.value })
                : setSignupForm({ ...signupForm, username: e.target.value })}
              className="monolith-input peer"
              placeholder=" "
              required
            />
            <label htmlFor="mobile-username" className="monolith-label">
              {authMode === 'login' ? 'Username' : 'Username'}
            </label>
            <div className="monolith-input-highlight" />
          </div>
          <div className="relative group">
            <input
              id="mobile-password"
              type={showPassword ? 'text' : 'password'}
              value={authMode === 'login' ? loginForm.password : signupForm.password}
              onChange={e => authMode === 'login'
                ? setLoginForm({ ...loginForm, password: e.target.value })
                : setSignupForm({ ...signupForm, password: e.target.value })}
              className="monolith-input peer pr-10"
              placeholder=" "
              required
            />
            <label htmlFor="mobile-password" className="monolith-label">{t('password')}</label>
            <div className="monolith-input-highlight" />
          </div>
          <button
            type="submit"
            disabled={isAuthSubmitting}
            className="monolith-btn mt-8 h-12 text-xs font-bold tracking-widest"
          >
            {isAuthSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="login-spinner" /> {t('authenticating')}
              </span>
            ) : (
              authMode === 'login' ? 'Login' : 'Sign Up'
            )}
          </button>
        </form>
        <div className="w-full mt-10">
          <div className="flex items-center gap-4 mb-6 opacity-50">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/50" />
            <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-white/70">{t('external_protocol')}</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/50" />
          </div>
          <div className="h-[44px] w-full mx-auto overflow-hidden rounded-xl border border-white/10 hover:border-gold/40 transition-colors bg-white/[0.03]">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => addToast(t('link_failed'), 'error')}
              theme="filled_black"
              shape="rectangular"
              width={400}
            />
          </div>
        </div>
        <div className="absolute bottom-6 left-0 right-0 z-10 text-center flex flex-col gap-2 opacity-80">
          <div className="text-[9px] uppercase tracking-widest text-white/40">
            &copy; {new Date().getFullYear()} BakeryOS
          </div>
          <div className="flex justify-center gap-4 text-[9px] uppercase tracking-wider text-white/40">
            <a href="#" className="hover:text-gold transition-colors">{t('privacy_policy')}</a>
            <span className="text-white/10">•</span>
            <a href="#" className="hover:text-gold transition-colors">{t('terms_of_service')}</a>
          </div>
        </div>
      </div>
    </div>
  );

  // Desktop View
  const desktopView = (
    <div className="hidden lg:grid min-h-screen min-h-[100dvh] w-full grid-cols-12 grid-rows-1 p-6 gap-6">
      <div className="col-span-8 relative rounded-[2rem] overflow-hidden border border-white/10 bg-[#0a0a0b] shadow-2xl flex flex-col justify-between p-16 group">
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <img src="/pain.png" alt={t('premium_bakery')} className="w-full h-full object-cover opacity-60 mix-blend-luminosity scale-105 transition-transform duration-1000 group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/60 to-[#0a0a0b]/20"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0b]/80 via-transparent to-[#0d0d0f]"></div>
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-[radial-gradient(circle,rgba(212,175,55,0.15)_0%,transparent_70%)] blur-3xl"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] bg-[radial-gradient(circle,rgba(212,175,55,0.1)_0%,transparent_60%)] blur-3xl"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
        </div>
        <div className="relative z-10 flex justify-between items-start">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 rounded-full overflow-hidden border border-gold/40 shadow-[0_0_30px_rgba(212,175,55,0.5)]">
              <img src="/columbina-login.jpg" alt={t('crest')} className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-4xl font-light tracking-[0.2em] uppercase text-white font-serif leading-none">
                {t('bakery')}<span className="font-bold text-gold">OS</span>
              </h1>
              <p className="text-[10px] tracking-[0.4em] uppercase text-gold/60 mt-2 font-semibold">{t('enterprise_terminal')}</p>
            </div>
          </div>
          <div className="text-right flex gap-8">
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2">{t('mainframe')}</div>
              <div className="flex items-center gap-2 text-sm font-light text-white/70">
                <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" /> {t('active')}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2">{t('protocol')}</div>
              <div className="text-sm font-light text-white/70">{t('aes_256')}</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 max-w-3xl mt-auto">
          <div className="flex items-center gap-6 text-[9px] uppercase tracking-widest text-white/40 w-fit">
            <div>&copy; {new Date().getFullYear()} BakeryOS</div>
            <a href="#" className="hover:text-gold transition-colors">{t('privacy_policy')}</a>
            <a href="#" className="hover:text-gold transition-colors">{t('terms_of_service')}</a>
          </div>
        </div>
      </div>
      <div className="col-span-4 relative rounded-[2rem] overflow-hidden border border-white/10 bg-[#0d0d0f] shadow-2xl flex flex-col items-center justify-center p-12 lg:p-16">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.05)_0%,transparent_50%)] pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-[340px]">
          <div className="flex w-full mb-12 border-b border-white/10">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 pb-4 text-[11px] font-bold tracking-widest uppercase transition-colors relative ${authMode === 'login' ? 'text-gold' : 'text-white/30 hover:text-white/60'}`}
              type="button"
            >
              Login
              {authMode === 'login' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-gold shadow-[0_0_10px_rgba(212,175,55,0.8)]" />}
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 pb-4 text-[11px] font-bold tracking-widest uppercase transition-colors relative ${authMode === 'signup' ? 'text-gold' : 'text-white/30 hover:text-white/60'}`}
              type="button"
            >
              Sign Up
              {authMode === 'signup' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-gold shadow-[0_0_10px_rgba(212,175,55,0.8)]" />}
            </button>
          </div>
          <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="w-full space-y-8">
            <div className="relative group">
              <input
                id="desktop-username"
                type="text"
                value={authMode === 'login' ? loginForm.username : signupForm.username}
                onChange={e => authMode === 'login'
                  ? setLoginForm({ ...loginForm, username: e.target.value })
                  : setSignupForm({ ...signupForm, username: e.target.value })}
                className="monolith-input peer text-lg"
                placeholder=" "
                required
              />
              <label htmlFor="desktop-username" className="monolith-label text-sm">
                {authMode === 'login' ? 'Username' : 'Username'}
              </label>
              <div className="monolith-input-highlight" />
            </div>
            <div className="relative group">
              <input
                id="desktop-password"
                type={showPassword ? 'text' : 'password'}
                value={authMode === 'login' ? loginForm.password : signupForm.password}
                onChange={e => authMode === 'login'
                  ? setLoginForm({ ...loginForm, password: e.target.value })
                  : setSignupForm({ ...signupForm, password: e.target.value })}
                className="monolith-input peer pr-10 text-lg"
                placeholder=" "
                required
              />
              <label htmlFor="desktop-password" className="monolith-label text-sm">{t('password')}</label>
              <div className="monolith-input-highlight" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 bottom-3 text-white/30 hover:text-gold transition-colors p-2"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {authMode === 'signup' && (
              <div className="relative group">
                <input
                  id="desktop-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={signupForm.confirmPassword}
                  onChange={e => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                  className="monolith-input peer text-lg"
                  placeholder=" "
                  required
                />
                <label htmlFor="desktop-confirm-password" className="monolith-label text-sm">{t('confirm_password')}</label>
                <div className="monolith-input-highlight" />
              </div>
            )}
            <button
              type="submit"
              disabled={isAuthSubmitting}
              className="monolith-btn mt-10 h-14 text-sm font-bold tracking-widest"
            >
              {isAuthSubmitting
                ? <span className="flex items-center justify-center gap-3"><span className="login-spinner" /> {t('authenticating')}</span>
                : (authMode === 'login' ? 'Login' : 'Sign Up')}
            </button>
          </form>
          <div className="w-full mt-14">
            <div className="flex items-center gap-4 mb-8 opacity-40">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white" />
              <span className="text-[9px] tracking-[0.2em] uppercase font-bold">{t('external_protocol')}</span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white" />
            </div>
            <div className="h-[48px] w-full mx-auto overflow-hidden rounded-[1rem] border border-white/10 hover:border-gold/40 transition-colors bg-white/[0.02]">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => addToast(t('link_failed'), 'error')}
                theme="filled_black"
                shape="rectangular"
                width={400}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (user) return null;

  return (
    <main className="min-h-screen min-h-[100dvh] w-full bg-[#060606] text-white overflow-hidden font-sans" role="main">
      <AnimatePresence mode="wait">
        {mobileView}
        {desktopView}
      </AnimatePresence>
    </main>
  );
};