import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Sun, Moon, Search, Bell, User as UserIcon, LogOut, ChevronDown, UserCircle, Menu, X } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { NavItems } from './NavItems';
import { SymbolSearch } from '../features/SymbolSearch';
import { useGame } from '../../context/GameContext';
import { useMultiChartStore } from '../../store/useMultiChartStore';
import { useAuth } from '../../context/AuthContext';

const Topbar = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { setSymbol } = useGame();
  const { activeChartId } = useMultiChartStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
          <h1 className="text-xl font-bold tracking-wide text-tv-text-primary">
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

        {/* Mobile Search Icon */}
        <button 
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
      <div className="hidden lg:flex items-center justify-end gap-5 w-auto shrink-0">
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
              className="text-sm font-medium whitespace-nowrap text-slate-600 dark:text-gray-300 hover:text-tv-primary dark:hover:text-tv-primary transition-colors"
            >
              Log In
            </Link>
            <Link 
              to="/signup" 
              className="bg-tv-primary hover:bg-tv-primary-hover whitespace-nowrap text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-md transition-all active:scale-[0.98]"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>

      {/* Hamburger icon for mobile/tablet */}
      <button 
        className="lg:hidden p-2 rounded-md text-tv-text-secondary hover:text-tv-text-primary transition-colors ml-2"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="absolute top-14 left-0 w-full bg-white dark:bg-[#121212] border-b border-slate-200 dark:border-white/10 p-4 flex flex-col gap-4 shadow-xl z-50 lg:hidden block animate-in slide-in-from-top-4 duration-200">
          <NavItems />
          <div className="h-px bg-slate-200 dark:bg-white/10 my-2" />
          <div className="flex justify-between items-center px-2">
            <span className="text-sm font-medium text-slate-600 dark:text-gray-300">Theme</span>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-tv-text-secondary hover:text-tv-text-primary bg-slate-100 dark:bg-white/5 transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          
          <div className="flex justify-between items-center px-2 mb-2">
            <span className="text-sm font-medium text-slate-600 dark:text-gray-300">Notifications</span>
            <button className="p-2 rounded-full text-tv-text-secondary hover:text-tv-text-primary bg-slate-100 dark:bg-white/5 transition-colors">
              <Bell size={20} />
            </button>
          </div>

          {user ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 px-2 py-2 bg-slate-50 dark:bg-white/5 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-tv-primary flex items-center justify-center text-white font-bold text-sm">
                  {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col overflow-hidden">
                   <p className="text-xs text-slate-400 font-medium">Signed in</p>
                   <p className="text-sm font-semibold truncate dark:text-white text-slate-900">{user.email}</p>
                </div>
              </div>
              <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className="px-2 py-2 text-sm flex items-center gap-2 text-slate-700 dark:text-gray-300">
                <UserCircle size={18} /> Profile Settings
              </Link>
              <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="px-2 py-2 text-sm flex items-center gap-2 text-red-600 text-left">
                <LogOut size={18} /> Sign Out
              </button>
            </div>
          ) : (
            <div className="flex gap-3 justify-center mt-2 pb-2">
              <Link 
                to="/login" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 py-2 text-center rounded-lg border border-slate-300 dark:border-[#2a2e39] text-sm font-medium text-slate-700 dark:text-gray-300"
              >
                Log In
              </Link>
              <Link 
                to="/signup" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 py-2 text-center rounded-lg bg-tv-primary text-white text-sm font-semibold"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Topbar;