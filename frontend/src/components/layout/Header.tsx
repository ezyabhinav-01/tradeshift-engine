import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Sun, Moon, Search, Bell } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { NavItems } from './NavItems';
import { UserDropdown } from './UserDropdown';
import { SymbolSearch } from '../features/SymbolSearch';
import { useGame } from '../../hooks/useGame';
import { useMultiChartStore } from '../../store/useMultiChartStore';

const Topbar = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { setSymbol } = useGame();
  const { activeChartId } = useMultiChartStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // const location = useLocation(); // This was removed as it was unused.

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

        <UserDropdown />
      </div>
    </header>
  );
};

export default Topbar;