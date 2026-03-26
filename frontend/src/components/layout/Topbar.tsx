import { useState } from 'react';
import { Wallet, Sun, Moon } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import SimpleSearchModal from '../ui/SimpleSearchModal';

const Topbar = () => {
  const { balance, isPlaying, theme, toggleTheme, setSymbol, selectedSymbol } = useGame();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className={`h-14 border-b flex items-center justify-between px-4 transition-colors duration-300
      ${theme === 'dark'
        ? 'bg-transparent border-gray-800 backdrop-blur-sm'
        : 'bg-transparent border-gray-200 backdrop-blur-sm'
      }`}>

      <div className="flex items-center gap-4">
        {/* SYMBOL TRIGGER (Replaces Logo) */}
        <button
          onClick={() => {
            console.log('🔍 Symbol button clicked, opening search');
            setSearchOpen(true);
          }}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors
           ${theme === 'dark' ? 'hover:bg-gray-800 text-gray-100' : 'hover:bg-gray-100 text-gray-900'}
           `}
        >
          <span className="font-bold text-lg tracking-tight">
            {selectedSymbol || "Select Symbol"}
          </span>
          <span className={`text-[10px] font-bold px-1 py-0.5 rounded border ml-1 ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-gray-100 border-gray-200 text-gray-500'
            }`}>
            ▼
          </span>
        </button>

        <div className="h-6 w-[1px] bg-gray-500/20 mx-2"></div>

        <span className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors duration-300
          ${isPlaying
            ? 'bg-green-500/10 text-green-500 border-green-500/20'
            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
          }`}>
          {isPlaying ? 'LIVE' : 'PAUSED'}
        </span>
      </div>

      {/* SEARCH MODAL */}
      <SimpleSearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={setSymbol}
      />

      <div className="flex items-center gap-4">
        {/* THEME TOGGLE BUTTON */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-full transition-all duration-300 hover:scale-110 active:rotate-180
            ${theme === 'dark'
              ? 'hover:bg-gray-800 text-yellow-400'
              : 'hover:bg-blue-100 text-slate-700'
            }`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="h-6 w-[1px] bg-gray-500/20"></div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Equity</span>
            <span className="font-mono text-sm font-bold">₹{balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-500 text-white shadow-lg shadow-blue-500/30">
            <Wallet size={16} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;