import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { CalendarRange, X } from 'lucide-react';
import TopToolbar from '../components/layout/TopToolbar';
import ProChart from '../components/ProChart/ProChart';
import { MultiChartGrid } from '../components/ProChart/MultiChartGrid';
import type { GameData } from '../components/ProChart/ProChart';
import { useMultiChartStore } from '../store/useMultiChartStore';
import { fetchHistoricalCandles } from '../services/MarketDataService';
import TradePanel from '../components/TradePanel/TradePanel';
import NewsPanel from '../components/features/NewsPanel';
import ObjectTreePanel from '../components/ProChart/ObjectTreePanel';
import ReplayToolbar from '../components/features/ReplayToolbar';
import { useGame } from '../hooks/useGame';
import type { DrawingToolId } from '../hooks/useDrawingTools';
import { toast } from 'sonner';

import type { IndicatorTemplate } from '../store/useChartObjects';

const Home = () => {
  const [isNewsOpen, setIsNewsOpen] = useState(false);
  const [isObjectTreeOpen, setIsObjectTreeOpen] = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);

  // Indicator state for TopToolbar
  const [activeIndicatorIds, setActiveIndicatorIds] = useState<string[]>([]);
  const [onApplyIndicatorTemplate, setOnApplyIndicatorTemplate] = useState<(t: IndicatorTemplate) => void>(() => (t: IndicatorTemplate) => console.log('Apply template', t));

  const handleIndicatorStateChange = useCallback((ids: string[], applyFn: (t: IndicatorTemplate) => void) => {
    setActiveIndicatorIds(ids);
    setOnApplyIndicatorTemplate(() => applyFn);
  }, []);

  // Keyboard Shortcuts
  const { addChart } = useMultiChartStore();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 't') {
        setIsObjectTreeOpen(prev => !prev);
      }
      if (e.altKey && e.key === 'n') {
        setIsNewsOpen(prev => !prev);
      }
      // Ctrl+N / Cmd+N: Add new chart
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        addChart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addChart]);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [tradeToExit, setTradeToExit] = useState<any | null>(null);
  const [exitLimitPrice, setExitLimitPrice] = useState<string>('');

  const {
    placeOrder, closePosition, closeAllPositions, trades,
    userSettings, updateUserSettings, historicalCandles, currentCandle,
    currentPrice, selectedSymbol, isPlaying, togglePlay,
    isReplayActive, toggleReplay,
    selectedDate, availableDates, setDate,
    speed, setSpeed, modifyOrder, setSymbol,
    currentTime, simulatedIndices, replayTicks
  } = useGame();
  const [showExitAllConfirm, setShowExitAllConfirm] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<any | null>(null);

  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolId>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const { charts, activeChartId, setChartData } = useMultiChartStore();

  // 1. Sync useGame's selectedSymbol with the active chart
  const prevActiveChartIdRef = useRef(activeChartId);
  useEffect(() => {
    const activeChart = charts.find(c => c.id === activeChartId);
    if (activeChart && activeChart.symbol !== selectedSymbol) {
      if (isPlaying && prevActiveChartIdRef.current !== activeChartId) {
        toast.info(`Replay switching to ${activeChart.symbol}`, {
          description: 'Replay will restart for the new symbol.',
          duration: 3000,
        });
      }
      setSymbol(activeChart.symbol, '');
    }
    prevActiveChartIdRef.current = activeChartId;
  }, [activeChartId, charts, selectedSymbol, setSymbol, isPlaying]);

  // 2. Multi-Chart Data Fetcher: Fetch data for each chart slot independently
  const lastFetchedRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const fetchVisibleCharts = async () => {
      // Only fetch for visible charts (up to layout limit)
      const layoutType = useMultiChartStore.getState().layoutType;
      const visibleCharts = charts.slice(0, layoutType);

      for (const chart of visibleCharts) {
        const fetchKey = `${chart.id}-${chart.symbol}-${selectedDate}`;
        
        // Fetch if symbol/date changed and it's not currently being fetched
        if (chart.symbol && lastFetchedRef.current[chart.id] !== fetchKey) {
          lastFetchedRef.current[chart.id] = fetchKey;
          try {
            console.log(`🌐 Fetching independent data for Slot ${chart.id}: ${chart.symbol}`);
            const candles = await fetchHistoricalCandles(chart.symbol, 500, selectedDate || '');
            setChartData(chart.id, candles);
          } catch (err) {
            console.error(`❌ Failed to fetch data for ${chart.symbol} in slot ${chart.id}:`, err);
            // Optionally set empty data so we don't retry forever
            setChartData(chart.id, []);
          }
        }
      }
    };

    fetchVisibleCharts();
  }, [charts, selectedDate, setChartData]);

  // 3. Force refresh data for all charts when symbol changes in store
  // (Handled by the effect above since candleData is cleared when symbol changes in store)
  // Wait, I should ensure updateChart clears old data!


  const mappedCandles = useMemo(() => {
    return historicalCandles.filter(c => c && typeof c === 'object' && 'open' in c && c.open !== undefined).map(c => ({
      time: (c.time as number) || 0,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }));
  }, [historicalCandles]);

  // Memoized callbacks for chart props
  const onToggleLibraryCb = useCallback(() => setIsLibraryOpen(false), []);
  const onPriceClickCb = useCallback((price: number) => setSelectedPrice(price), []);
  const onToggleIndicatorsCb = useCallback(() => setIsIndicatorsOpen(false), []);
  const onToggleAlertsCb = useCallback(() => setIsAlertsOpen(false), []);

  const handleEntryLineClick = useCallback((tradeId: string | number) => {
    const trade = trades.find(t => t.id === tradeId);
    if (trade) {
      setTradeToExit(trade);
      setExitLimitPrice(trade.entryPrice.toString());
    }
  }, [trades]);

  // Memoized gameData to prevent new object refs each render
  const gameData = useMemo(() => ({
    currentPrice, currentCandle, isPlaying, selectedSymbol,
    togglePlay, isReplayActive, toggleReplay,
    selectedDate, availableDates, setDate,
    speed, setSpeed, trades, modifyOrder,
    currentTime, simulatedIndices, replayTicks
  } as GameData), [
    currentPrice, currentCandle, isPlaying, selectedSymbol,
    togglePlay, isReplayActive, toggleReplay,
    selectedDate, availableDates, setDate,
    speed, setSpeed, trades, modifyOrder,
    currentTime, simulatedIndices, replayTicks
  ]);

  // Memoized chartProps for MultiChartGrid
  const chartProps = useMemo(() => ({
    data: mappedCandles,
    gameData,
    activeDrawingTool,
    onDrawingToolChange: setActiveDrawingTool,
    isLibraryOpen,
    onToggleLibrary: onToggleLibraryCb,
    onPriceClick: onPriceClickCb,
    onEntryLineClick: handleEntryLineClick,
    previewPrice: selectedPrice,
    isIndicatorsOpen,
    onToggleIndicators: onToggleIndicatorsCb,
    isAlertsOpen,
    onToggleAlerts: onToggleAlertsCb,
    onIndicatorStateChange: handleIndicatorStateChange,
  }), [
    mappedCandles, gameData, activeDrawingTool, isLibraryOpen,
    selectedPrice, isIndicatorsOpen, isAlertsOpen,
    onToggleLibraryCb, onPriceClickCb, handleEntryLineClick,
    onToggleIndicatorsCb, onToggleAlertsCb, handleIndicatorStateChange,
  ]);

  const handleExecuteOrder = (orderData: any) => {
    if (userSettings?.one_click_trading_enabled) {
      executeOrder(orderData);
    } else {
      setPendingOrder(orderData);
    }
  };

  const executeOrder = (orderData: any) => {
    placeOrder(
      orderData.direction,
      orderData.quantity,
      orderData.order_type,
      orderData.price,
      orderData.stop_loss,
      orderData.take_profit,
      orderData.alert,
      undefined, // simulatedTime
      orderData.symbol
    );
    setPendingOrder(null);
  };

  const handleConfirmExit = async (type: 'MARKET' | 'LIMIT') => {
    if (!tradeToExit) return;

    await closePosition(
      tradeToExit.id,
      type,
      type === 'LIMIT' ? parseFloat(exitLimitPrice) : undefined
    );
    setTradeToExit(null);
  };

  const handleExitAll = async () => {
    await closeAllPositions();
    setShowExitAllConfirm(false);
  };

  const openTradesCount = trades.filter(t => t.status === 'OPEN' || t.status === 'TRIGGERED').length;

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-transparent text-tv-text-primary overflow-hidden font-sans border-t-3 border-tv-border">
      {/* TOP TOOLBAR */}
      <TopToolbar
        isNewsOpen={isNewsOpen}
        onToggleNews={() => setIsNewsOpen(prev => !prev)}
        isObjectTreeOpen={isObjectTreeOpen}
        onToggleObjectTree={() => setIsObjectTreeOpen(prev => !prev)}
        onToggleIndicators={() => setIsIndicatorsOpen(prev => !prev)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        activeIndicatorIds={activeIndicatorIds}
        onApplyIndicatorTemplate={onApplyIndicatorTemplate}
      />

      <div className="flex flex-1 min-h-0 relative">
        {/* CENTER CHART AREA */}
        <div className="flex-1 relative bg-transparent">
          <MultiChartGrid
            ProChartComponent={ProChart}
            chartProps={chartProps}
          />

          {/* EMERGENCY EXIT ALL BUTTON */}
          {openTradesCount > 0 && (
            <div className="absolute top-4 right-4 z-50">
              <button
                onClick={() => setShowExitAllConfirm(true)}
                className="px-4 py-2 bg-[#f23645] hover:bg-[#d8303d] text-white text-[10px] font-black uppercase tracking-widest rounded-md shadow-lg transition-all active:scale-95 flex items-center gap-2 border border-white/10"
              >
                <X className="w-3 h-3" />
                Exit All ({openTradesCount})
              </button>
            </div>
          )}
        </div>

        {/* OBJECT TREE PANEL (Toggleable) */}
        <div className={`fixed inset-y-0 right-0 z-[100] md:relative md:inset-auto md:z-auto transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${isObjectTreeOpen ? 'w-full md:w-72 border-l border-tv-border shadow-2xl' : 'w-0'}`}>
          {isObjectTreeOpen && (
            <ObjectTreePanel
              isOpen={isObjectTreeOpen}
              onClose={() => setIsObjectTreeOpen(false)}
            />
          )}
        </div>

        {/* RIGHT NEWS PANEL (Toggleable) */}
        <div className={`fixed inset-y-0 right-0 z-[100] md:relative md:inset-auto md:z-auto transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${isNewsOpen ? 'w-full md:w-80 border-l border-tv-border shadow-2xl' : 'w-0'}`}>
          {isNewsOpen && (
            <div className="w-full md:w-80 h-full flex flex-col bg-[#050505]">
              <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5">
                <h3 className="text-xs font-black uppercase">Market News</h3>
                <button onClick={() => setIsNewsOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-hidden">
                <NewsPanel />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TRADE PANEL */}
      {selectedPrice !== null && (
        <TradePanel
          price={selectedPrice}
          onExecute={handleExecuteOrder}
          onClose={() => setSelectedPrice(null)}
        />
      )}

      {/* EXIT TRADE DIALOG */}
      {tradeToExit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-[#121212] border border-white/10 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <h3 className="font-black text-sm uppercase tracking-widest text-primary">Exit Position</h3>
              <button
                onClick={() => setTradeToExit(null)}
                className="p-1 hover:bg-white/5 rounded-md transition-colors"
              >
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tighter opacity-40">
                  <span>Symbol</span>
                  <span>Position</span>
                </div>
                <div className="flex items-center justify-between font-black text-lg italic">
                  <span>{tradeToExit.symbol}</span>
                  <span className={tradeToExit.direction === 'BUY' ? 'text-[#089981]' : 'text-[#f23645]'}>
                    {tradeToExit.direction} {tradeToExit.quantity}x
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="text-[10px] font-black uppercase tracking-widest opacity-30">Select Exit Strategy</div>

                <button
                  onClick={() => handleConfirmExit('MARKET')}
                  className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest text-xs rounded-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Exit Market
                </button>

                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      step="0.05"
                      value={exitLimitPrice}
                      onChange={(e) => setExitLimitPrice(e.target.value)}
                      placeholder="Limit Price"
                      className="w-full h-12 bg-white/5 border border-white/10 rounded-lg px-4 text-sm font-black focus:outline-none focus:border-primary/50"
                    />
                    <button
                      onClick={() => handleConfirmExit('LIMIT')}
                      className="h-12 px-6 border border-primary/40 text-primary font-black uppercase tracking-widest text-xs rounded-lg hover:bg-primary/10 active:scale-[0.98] transition-all shrink-0"
                    >
                      Limit
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 text-[10px] text-white/30 font-bold uppercase tracking-tighter text-center">
              Current Entry: ₹{tradeToExit.entryPrice.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* EXIT ALL CONFIRMATION DIALOG */}
      {showExitAllConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300 p-4">
          <div className="bg-[#121212] border border-[#f23645]/30 rounded-2xl w-full max-w-sm overflow-hidden shadow-[0_0_50px_rgba(242,54,69,0.2)] animate-in zoom-in-95 duration-200">
            <div className="p-8 flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 bg-[#f23645]/10 rounded-full flex items-center justify-center">
                <X className="w-8 h-8 text-[#f23645] animate-pulse" />
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-black text-xl uppercase tracking-widest text-white">Emergency Exit</h3>
                <p className="text-sm text-white/40 font-medium leading-relaxed px-4">
                  Are you sure you want to close <span className="text-white font-bold">{openTradesCount}</span> open positions immediately at market price?
                </p>
              </div>

              <div className="flex flex-col w-full gap-3 mt-4">
                <button
                  onClick={handleExitAll}
                  className="w-full py-4 bg-[#f23645] hover:bg-[#d8303d] text-white font-black uppercase tracking-widest text-sm rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-[#f23645]/20"
                >
                  Yes, Close Everything
                </button>
                <button
                  onClick={() => setShowExitAllConfirm(false)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/60 font-black uppercase tracking-widest text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDER CONFIRMATION DIALOG */}
      {pendingOrder && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300 p-4">
          <div className="bg-[#121212] border border-tv-primary/30 rounded-2xl w-full max-w-sm overflow-hidden shadow-[0_0_50px_rgba(43,209,255,0.1)] animate-in zoom-in-95 duration-200">
            <div className="p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center">
                <h3 className="font-black text-xl uppercase tracking-widest text-white">Confirm Order</h3>
                <p className="text-sm text-white/40 font-medium">Please review your trade details</p>
              </div>

              <div className="bg-white/5 rounded-xl p-5 flex flex-col gap-4 border border-white/5">
                <div className="flex justify-between items-center" >
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Symbol</span>
                  <span className="font-black text-sm italic">{pendingOrder.symbol}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Operation</span>
                  <span className={`font-black text-sm uppercase tracking-widest ${pendingOrder.direction === 'BUY' ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                    {pendingOrder.direction}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Quantity</span>
                  <span className="font-black text-sm">{pendingOrder.quantity} Lots</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Type</span>
                  <span className="font-black text-sm">{pendingOrder.order_type}</span>
                </div>
                <div className="flex justify-between items-center border-t border-white/5 pt-4 mt-2">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Estimated Price</span>
                  <span className="font-black text-base text-tv-primary">₹{pendingOrder.price.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => executeOrder(pendingOrder)}
                  className={`w-full py-4 font-black uppercase tracking-widest text-sm rounded-xl transition-all active:scale-[0.98] shadow-lg ${pendingOrder.direction === 'BUY'
                      ? 'bg-[#089981] hover:bg-[#07856f] text-white shadow-[#089981]/20'
                      : 'bg-[#f23645] hover:bg-[#d8303d] text-white shadow-[#f23645]/20'
                    }`}
                >
                  Confirm {pendingOrder.direction}
                </button>
                <button
                  onClick={() => setPendingOrder(null)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/60 font-black uppercase tracking-widest text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
              </div>

              <div className="flex items-center gap-2 justify-center mt-2">
                <input
                  type="checkbox"
                  id="dont-show-again"
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-tv-primary focus:ring-0 focus:ring-offset-0"
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateUserSettings({ one_click_trading_enabled: true });
                    }
                  }}
                />
                <label htmlFor="dont-show-again" className="text-[10px] font-bold uppercase tracking-widest text-white/30 cursor-pointer hover:text-white/50 transition-colors">
                  Enable One-Click Trading
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReplayToolbar />

      {/* BOTTOM FOOTER */}
      <div className="h-8 border-t-4 border-tv-border bg-tv-bg-base flex items-center justify-between px-4 text-xs font-semibold text-tv-text-secondary select-none flex-shrink-0">
        {/* Bottom Left: Ranges */}
        <div className="flex items-center space-x-3">
          {['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'].map((range) => (
            <span key={range} className="hover:text-blue-500 cursor-pointer transition-colors px-1">
              {range}
            </span>
          ))}
          <CalendarRange size={14} className="cursor-pointer hover:text-tv-text-primary ml-2" />
        </div>

        {/* Bottom Right: Time Info */}
        <div className="flex items-center space-x-4 pr-1">
          <span className="hover:text-tv-text-primary cursor-pointer">Replay Trading</span>
          <span className="text-tv-text-primary border-b-2 border-blue-500 pb-[6px] cursor-pointer font-bold">Trade</span>
          <span className="ml-4 tabular-nums">{new Date().toLocaleTimeString()} UTC+5:30</span>
        </div>
      </div>
    </div>
  );
};

export default Home;