import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Sun, Moon, Search, Bell, LogOut, UserCircle, Newspaper, LayoutDashboard } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { NavItems } from './NavItems';
import { SymbolSearch } from '../features/SymbolSearch';
import { useGame } from '../../context/GameContext';
import { useMultiChartStore } from '../../store/useMultiChartStore';
import { useAuth } from '../../context/AuthContext';
import { NotificationDropdown } from './NotificationDropdown';
import { useNotifications } from '../../context/NotificationContext';

const Topbar = () => {
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const { setSymbol } = useGame();
  const { activeChartId } = useMultiChartStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className={`sticky top-0 h-14 min-h-[56px] flex items-center justify-between px-4 lg:px-6 transition-all duration-300 z-50 bg-white dark:bg-[#121212] border-b border-slate-200 dark:border-white/10 backdrop-blur-sm shadow-sm`}>
      <SymbolSearch
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelect={(symbol, token) => {
          setSymbol(symbol, token);
          if (activeChartId) {
            useMultiChartStore.getState().updateChart(activeChartId, { symbol });
          }
          // Redirect to trade page if not already there
          navigate('/trade');
        }}
        activeChartId={activeChartId}
      />

      {/* Left Section - Logo */}
      <div className="flex items-center gap-4 w-[250px] shrink-0">
        <Link to="/" className="flex items-center gap-3">
          <h1 className="hidden sm:block text-xl font-bold tracking-wide text-tv-text-primary">
            TRADE<span className="text-tv-primary">SHIFT</span>
          </h1>
        </Link>
      </div>

      {/* Center Section - Search & Nav */}
      <div className="flex-1 flex items-center justify-center gap-8">
        {/* Search Bar - Modal Trigger */}
        <div
          data-tutorial="global-symbol-search"
          onClick={() => setIsSearchOpen(true)}
          className="hidden md:flex items-center bg-slate-100 dark:bg-[#2a2e39] hover:bg-slate-200 dark:hover:bg-[#2a2e39]/80 border border-slate-200 dark:border-[#2a2e39] hover:border-tv-primary/40 dark:hover:border-tv-primary/40 rounded-full px-4 py-1.5 transition-all cursor-pointer group shrink-0"
        >
          <Search size={18} className="text-slate-500 dark:text-[#a3a6af] mr-2 group-hover:text-tv-text-primary transition-colors" />
          <span className="text-[15px] text-slate-600 dark:text-[#a3a6af] group-hover:text-tv-text-primary transition-colors select-none whitespace-nowrap overflow-hidden">
            Search symbol...
          </span>
        </div>

        {/* Mobile Search Icon */}
        <button
          data-tutorial="global-symbol-search"
          onClick={() => setIsSearchOpen(true)}
          className="md:hidden p-2 rounded-full text-tv-text-secondary hover:text-tv-text-primary transition-colors duration-300"
          title="Search"
        >
          <Search size={20} />
        </button>

        <div className="shrink-0 hidden lg:flex items-center">
          <NavItems />
        </div>
      </div>

      {/* Right Section - Settings & Profile (Desktop) */}
      <div className="hidden lg:flex items-center justify-end gap-4 xl:gap-5 w-auto shrink-0">
        {/* THEME TOGGLE BUTTON */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full text-tv-text-secondary hover:text-tv-text-primary hover:bg-tv-text-primary/10 transition-colors duration-300"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="h-6 w-[1px] bg-tv-border"></div>

        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`p-2 rounded-full transition-colors duration-300 relative ${isNotificationsOpen ? 'text-tv-primary bg-tv-primary/10' : 'text-tv-text-secondary hover:text-tv-text-primary hover:bg-tv-text-primary/10'}`}
            title="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-[#121212] animate-in zoom-in duration-300">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {isNotificationsOpen && (
            <NotificationDropdown
              isOpen={isNotificationsOpen}
              onClose={() => setIsNotificationsOpen(false)}
            />
          )}
        </div>

        <div className="h-6 w-[1px] bg-tv-border"></div>

        {loading ? (
          <div className="w-8 h-8 rounded-full animate-pulse bg-slate-200 dark:bg-white/5" />
        ) : user ? (
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-8 h-8 rounded-full bg-tv-primary flex items-center justify-center text-white font-bold text-xs shadow-sm border border-white/10"
              title="Account"
            >
              {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
            </button>
            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl py-2 z-50">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 mb-1">
                    <p className="text-sm font-bold dark:text-white truncate">{user.demat_id || 'Account'}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                  </div>
                  <Link to="/settings" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-gray-300" onClick={() => setIsUserMenuOpen(false)}>
                    <UserCircle size={16} /> Profile
                  </Link>
                  <Link to="/news" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-gray-300" onClick={() => setIsUserMenuOpen(false)}>
                    <Newspaper size={16} /> News
                  </Link>
                  <Link to="/community" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-gray-300" onClick={() => setIsUserMenuOpen(false)}>
                    <LayoutDashboard size={16} /> Community
                  </Link>
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600">
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link to="/login" className="text-xs font-bold text-tv-primary px-3 py-1.5 rounded-full bg-tv-primary/10">
            Log In
          </Link>
        )}
      </div>

      {/* Mobile Right Section - Profile/Auth (Simplified) */}
      <div className="flex lg:hidden items-center gap-2">
        {loading ? (
          <div className="w-8 h-8 rounded-full animate-pulse bg-slate-200 dark:bg-white/5" />
        ) : user ? (
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-8 h-8 rounded-full bg-tv-primary flex items-center justify-center text-white font-bold text-xs shadow-sm border border-white/10"
            >
              {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
            </button>
            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl py-2 z-50">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 mb-1">
                    <p className="text-sm font-bold dark:text-white truncate">{user.demat_id || 'Account'}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                  </div>
                  <Link to="/settings" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-gray-300" onClick={() => setIsUserMenuOpen(false)}>
                    <UserCircle size={16} /> Profile
                  </Link>
                  <Link to="/news" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-gray-300" onClick={() => setIsUserMenuOpen(false)}>
                    <Newspaper size={16} /> News
                  </Link>
                  <Link to="/community" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-gray-300" onClick={() => setIsUserMenuOpen(false)}>
                    <LayoutDashboard size={16} /> Community
                  </Link>
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600">
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link to="/login" className="text-xs font-bold text-tv-primary px-3 py-1.5 rounded-full bg-tv-primary/10">
            Log In
          </Link>
        )}
      </div>
    </header>
  );
};

export default Topbar;
