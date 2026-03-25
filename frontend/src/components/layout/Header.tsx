import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Sun, Moon, Search, Bell, User as UserIcon, LogOut, ChevronDown, UserCircle } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { NavItems } from './NavItems';
import { SymbolSearch } from '../features/SymbolSearch';
import { useGame } from '../../hooks/useGame';
import { useMultiChartStore } from '../../store/useMultiChartStore';
import { useAuth } from '../../context/AuthContext';

const Topbar = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { setSymbol } = useGame();
  const { activeChartId } = useMultiChartStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
        <Link to="/home1" className="flex items-center gap-3">
          <h1 className="hidden sm:block text-xl font-bold tracking-wide text-tv-text-primary">
            TRADE<span className="text-tv-primary">SHIFT</span>
          </h1>
        </Link>
      </div>

      {/* Center Section - Search & Nav */}
      <div className="flex-1 flex items-center justify-center gap-8">
        {/* Search Bar - Modal Trigger */}
        <div 
          onClick={() => setIsSearchOpen(true)}
          className="hidden md:flex items-center bg-slate-100 dark:bg-[#2a2e39] hover:bg-slate-200 dark:hover:bg-[#2a2e39]/80 border border-slate-200 dark:border-[#2a2e39] hover:border-tv-primary/40 dark:hover:border-tv-primary/40 rounded-full px-4 py-1.5 transition-all cursor-pointer group shrink-0"
        >
          <Search size={18} className="text-slate-500 dark:text-[#a3a6af] mr-2 group-hover:text-tv-text-primary transition-colors" />
          <span className="text-[15px] text-slate-600 dark:text-[#a3a6af] group-hover:text-tv-text-primary transition-colors select-none whitespace-nowrap overflow-hidden">
            Search symbol...
          </span>
        </div>

        <div className="shrink-0 flex items-center">
          <NavItems />
        </div>
      </div>

      {/* Right Section - Settings & Profile */}
      <div className="flex items-center justify-end gap-5 w-[250px] shrink-0">
        {/* THEME TOGGLE BUTTON */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full text-tv-text-secondary hover:text-tv-text-primary hover:bg-tv-text-primary/10 transition-colors duration-300"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="h-6 w-[1px] bg-tv-border"></div>

        <button className="text-tv-text-secondary hover:text-tv-text-primary transition-colors duration-300" title="Notifications">
          <Bell size={20} />
        </button>

        <div className="h-6 w-[1px] bg-tv-border"></div>

        {/* AUTH SECTION */}
        {user ? (
          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1 pl-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/10"
            >
              <div className="w-8 h-8 rounded-full bg-tv-primary flex items-center justify-center text-white font-bold text-sm shadow-md">
                {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
              </div>
              <ChevronDown size={14} className={`text-slate-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isUserMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsUserMenuOpen(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 mb-1">
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Signed in as</p>
                    <p className="text-sm font-semibold truncate dark:text-white">{user.email}</p>
                  </div>
                  
                  <Link 
                    to="/settings" 
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <UserCircle size={18} />
                    Profile Settings
                  </Link>
                  
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link 
              to="/login" 
              className="text-sm font-medium text-slate-600 dark:text-gray-300 hover:text-tv-primary dark:hover:text-tv-primary transition-colors"
            >
              Log In
            </Link>
            <Link 
              to="/signup" 
              className="bg-tv-primary hover:bg-tv-primary-hover text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-md transition-all active:scale-[0.98]"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;