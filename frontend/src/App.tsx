import { lazy, Suspense, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { AccessProvider } from './hooks/useAccessControl';
import { NotificationProvider } from './context/NotificationContext';
import { TutorialProvider } from './context/TutorialContext';
import { TutorialOverlay } from './components/tutorial/TutorialOverlay';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import PinVerification from './pages/auth/PinVerification';
import ForgotPassword from './pages/auth/ForgotPassword';

import Layout from './components/layout/layout';
import Home from './pages/Home';
import LandingPage from './pages/LandingPage';
import ResearchHub from './pages/ResearchHub';
import SettingsPage from './pages/SettingsPage';
import PortfolioPage from './pages/PortfolioPage'; // Renamed to avoid clash
import LessonViewerPage from './pages/LessonViewerPage';
import ModuleDetailPage from './pages/ModuleDetailPage';
import SubModuleDetailPage from './pages/SubModuleDetailPage';
import TrackDetailPage from './pages/TrackDetailPage';
import SecretDetailPage from './pages/SecretDetailPage';
import CommunityPage from './pages/CommunityPage';
import NotificationsPage from './pages/NotificationsPage';
import HelpPage from './pages/HelpPage';

import { useChartPersistence } from './hooks/useChartPersistence';
import { usePageTracking } from './hooks/usePageTracking';
import { Bot } from 'lucide-react';

const MarketPage = lazy(() => import('./pages/MarketPage'));
const ScreenerPage = lazy(() => import('./pages/ScreenerPage'));
const LearnPage = lazy(() => import('./pages/LearnPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));

function ChartPersistenceManager() {
  useChartPersistence();
  return null;
}

function RouteLoader() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="h-10 w-10 rounded-full border-4 border-tv-primary/30 border-t-tv-primary animate-spin" />
    </div>
  );
}

function AppContent() {
  usePageTracking();

  useEffect(() => {
    const win = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let idleId: number | undefined;

    const warmup = () => {
      void import('./pages/MarketPage');
      void import('./pages/ScreenerPage');
      void import('./pages/NewsPage');
      void import('./pages/LearnPage');
    };

    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(warmup, { timeout: 5000 });
    } else {
      const timeout = window.setTimeout(warmup, 2500);
      return () => window.clearTimeout(timeout);
    }

    return () => {
      if (idleId !== undefined && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
      }
    };
  }, []);

  return (
    <>
      <ChartPersistenceManager />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/pin-verify" element={<PinVerification />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route element={<Layout />}>
            <Route path="trade" element={<Home />} />
            <Route path="markets" element={<MarketPage />} />
            <Route path="screener" element={<ScreenerPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="learn" element={<LearnPage />} />
            <Route path="learn/track/:trackId" element={<TrackDetailPage />} />
            <Route path="learn/module/:moduleId" element={<ModuleDetailPage />} />
            <Route path="learn/chapter/:subModuleId" element={<SubModuleDetailPage />} />
            <Route path="learn/secret/:secretId" element={<SecretDetailPage />} />
            <Route path="learn/:trackId/:lessonId" element={<LessonViewerPage />} />
            <Route path="news" element={<NewsPage />} />
            <Route path="community" element={<CommunityPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="help" element={<HelpPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="research/:symbol" element={<ResearchHub />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
      <div className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:right-5 md:bottom-5 z-50 pointer-events-none">
        <div className="flex items-center justify-center rounded-full border border-white/20 bg-black/70 p-2 backdrop-blur-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10">
            <Bot size={18} className="text-emerald-400" />
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <AccessProvider>
          <NotificationProvider>
            <GameProvider>
              <TutorialProvider>
                <AppContent />
                <TutorialOverlay />
              </TutorialProvider>
            </GameProvider>
          </NotificationProvider>
        </AccessProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
