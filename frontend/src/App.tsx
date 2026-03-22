import { ThemeProvider } from './context/ThemeContext';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/layout/layout';
import Home from './pages/Home';
import Home1 from './pages/Home1';
import ResearchHub from './pages/ResearchHub';
import AuthLayout from './components/auth/AuthLayout';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import ScreenerPage from './pages/ScreenerPage';
import MarketPage from './pages/MarketPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import PortfolioPage from './pages/PortfolioPage';
import LearnPage from './pages/LearnPage';
import NewsPage from './pages/NewsPage';
import { Toaster } from 'sonner';
import { ChatBot } from './components/ChatBot/ChatBot';

import { useChartPersistence } from './hooks/useChartPersistence';

function ChartPersistenceManager() {
  useChartPersistence();
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ChartPersistenceManager />
        <GameProvider>
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="trade" element={<Home />} />
                <Route path="home1" element={<Home1 />} />
                <Route path="markets" element={<MarketPage />} />
                <Route path="screener" element={<ScreenerPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="portfolio" element={<PortfolioPage />} />
                <Route path="learn" element={<LearnPage />} />
                <Route path="news" element={<NewsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="research/:symbol" element={<ResearchHub />} />
              </Route>
              <Route path="/auth" element={<AuthLayout />}>
                <Route path="sign-in" element={<SignIn />} />
                <Route path="sign-up" element={<SignUp />} />
              </Route>
            </Routes>
            <Toaster />
            <ChatBot />
          </ThemeProvider>
        </GameProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}