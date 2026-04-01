import { ThemeProvider } from './context/ThemeContext';
import { Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { Toaster } from 'sonner';
import { ChatBot } from './components/ChatBot/ChatBot';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';

import Layout from './components/layout/layout';
import Home from './pages/Home';
import Home1 from './pages/Home1';
import ResearchHub from './pages/ResearchHub';
import ScreenerPage from './pages/ScreenerPage';
import MarketPage from './pages/MarketPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import PortfolioPage from './pages/PortfolioPage'; // Renamed to avoid clash
import LearnPage from './pages/LearnPage';
import LessonViewerPage from './pages/LessonViewerPage';
import ModuleDetailPage from './pages/ModuleDetailPage';
import TrackDetailPage from './pages/TrackDetailPage';
import NewsPage from './pages/NewsPage';
import CommunityPage from './pages/CommunityPage';
import HelpPage from './pages/HelpPage';

import { useChartPersistence } from './hooks/useChartPersistence';
import { usePageTracking } from './hooks/usePageTracking';

function ChartPersistenceManager() {
  useChartPersistence();
  return null;
}

export default function App() {
  usePageTracking();
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ChartPersistenceManager />
      <GameProvider>
        <AuthProvider>
          <Routes>
              <Route path="/" element={<Navigate to="/home1" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

            <Route element={<Layout />}>
              <Route path="trade" element={<Home />} />
              <Route path="home1" element={<Home1 />} />
              <Route path="markets" element={<MarketPage />} />
              <Route path="screener" element={<ScreenerPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="portfolio" element={<PortfolioPage />} />
              <Route path="learn" element={<LearnPage />} />
              <Route path="learn/track/:trackId" element={<TrackDetailPage />} />
              <Route path="learn/module/:moduleId" element={<ModuleDetailPage />} />
              <Route path="learn/:trackId/:lessonId" element={<LessonViewerPage />} />
              <Route path="news" element={<NewsPage />} />
              <Route path="community" element={<CommunityPage />} />
              <Route path="help" element={<HelpPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="research/:symbol" element={<ResearchHub />} />
            </Route>
          </Routes>
          <Toaster />
          <ChatBot />
        </AuthProvider>
      </GameProvider>
    </ThemeProvider>
  );
}