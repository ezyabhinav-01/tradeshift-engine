import { useState } from 'react';
import { Activity } from 'lucide-react';
type Page = 'terminal' | 'history' | 'settings';
import Topbar from './Topbar';
import { GlobalTicker } from '../market/GlobalTicker';
import ChartArea from '../features/ChartArea';
import OrderPanel from '../features/OrderPanel';
import TradePanel from '../TradePanel/TradePanel';
import PlaybackControls from '../features/PlaybackControls';
import HistoryPage from '../../pages/HistoryPage';
import SettingsPage from '../../pages/SettingsPage';
import { useGame } from '../../context/GameContext';

const MainLayout = () => {
  const [page] = useState<Page>('terminal');
  const { speed, setSpeed, theme, placeOrder } = useGame();
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  const handleExecuteOrder = (orderData: any) => {
    console.log('🚀 Executing Order (Terminal):', orderData);
    placeOrder(orderData.direction, orderData.quantity);
  };

  return (
    <div className={`flex h-screen w-screen font-sans overflow-hidden transition-colors duration-500
      ${theme === 'dark'
        // Dark Mode: Deep Blue -> Slate -> Dark Teal (Professional Trading Look)
        ? 'bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f2c29] text-gray-100'
        // Light Mode: White -> Subtle Blue -> Subtle Emerald
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 text-gray-900'
      }`}>

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <div className="w-full bg-transparent border-b border-tv-border py-1">
          <GlobalTicker />
        </div>

        <main className="flex-1 relative flex overflow-hidden">
          {page === 'terminal' && (
            <>
              {/* Chart Area */}
              <ChartArea
                onPriceClick={(price) => setSelectedPrice(price)}
                previewPrice={selectedPrice}
              />
              <OrderPanel />
              <PlaybackControls />

              {/* Trade Panel */}
              {selectedPrice !== null && (
                <TradePanel
                  price={selectedPrice}
                  onExecute={handleExecuteOrder}
                  onClose={() => setSelectedPrice(null)}
                />
              )}

              {/* Floating Speed Control Widget */}
              <div className={`absolute bottom-6 left-6 p-3 rounded-lg flex items-center gap-3 shadow-xl z-40 backdrop-blur-md border transition-all duration-300 hover:scale-105
                ${theme === 'dark'
                  ? 'bg-gray-900/80 border-gray-700'
                  : 'bg-white/80 border-gray-200 shadow-blue-200/50'
                }`}>
                <div className={`p-1.5 rounded-md ${theme === 'dark' ? 'bg-gray-800' : 'bg-blue-100'}`}>
                  <Activity size={16} className="text-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider leading-none ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Sim Speed</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="1"
                      id="sim-speed-input"
                      aria-label="Simulation Speed"
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                      className="w-24 h-1.5 bg-gray-400/30 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-xs font-mono min-w-[24px] text-right font-bold">{speed}x</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {page === 'history' && (
            <div className="flex-1 overflow-auto">
              <HistoryPage />
            </div>
          )}

          {page === 'settings' && (
            <div className="flex-1 overflow-auto">
              <SettingsPage />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;