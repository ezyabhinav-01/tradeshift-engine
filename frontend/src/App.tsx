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
import PortfolioPage_old from './pages/PortfolioPage'; // Renamed to avoid clash
import LearnPage from './pages/LearnPage';
import NewsPage from './pages/NewsPage';
import CommunityPage from './pages/CommunityPage';
import HelpPage from './pages/HelpPage';

import { useChartPersistence } from './hooks/useChartPersistence';

function ChartPersistenceManager() {
  useChartPersistence();
  return null;
}

export default function App() {
  return (
    <>
      <ChartPersistenceManager />
      <GameProvider>
        <AuthProvider>
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
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
              <Route path="portfolio-old" element={<PortfolioPage_old />} />
              <Route path="learn" element={<LearnPage />} />
              <Route path="news" element={<NewsPage />} />
              <Route path="community" element={<CommunityPage />} />
              <Route path="help" element={<HelpPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="research/:symbol" element={<ResearchHub />} />
            </Route>
          </Routes>
          <Toaster />
          <ChatBot />
        </ThemeProvider>
      </AuthProvider>
    </GameProvider>
    </>
  );
}