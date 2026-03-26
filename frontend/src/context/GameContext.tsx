// @refresh reset
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { CandleData, Trade } from '../types';
import { marketDataService, fetchHistoricalCandles, fetchAvailableDates } from '../services/MarketDataService';
import { toast } from 'sonner';
import { useMultiChartStore } from '../store/useMultiChartStore';
import { useTheme } from './ThemeContext';

export interface NewsItem {
  id: number;
  symbol: string;
  title: string;
  description: string;
  time_str: string;
  source: string;
  url: string;
  analysis?: string;
  sentiment?: string;
  predicted_impact?: string;
  actual_impact?: string;
  qa_history?: {question: string, answer: string}[];
  explainer?: {
    essence: string;
    analogy: string;
    golden_rule: string;
  };
}

export interface IndexData {
  name: string;
  price: number;
  change: number;
  change_percent: number;
  is_positive: boolean;
}

interface GameState {
  isPlaying: boolean;
  speed: number;
  balance: number;
  currentPrice: number;
  currentCandle: CandleData | null;
  currentTime: Date | null;
  historicalCandles: CandleData[];
  /** Per-symbol latest candle during replay — used by non-primary charts for independent tick-by-tick updates */
  replayTicks: Record<string, CandleData>;
  trades: Trade[];
  newsItems: NewsItem[];
  simulatedIndices: IndexData[];
  theme: 'dark' | 'light' | 'system';
  selectedSymbol: string;
  selectedDate: string;
  availableDates: string[];
  isLoadingHistory: boolean;
  isReplayActive: boolean;
  sessionType: 'LIVE' | 'REPLAY';
  userSettings: {
    max_daily_loss: number;
    max_order_quantity: number;
    one_click_trading_enabled: boolean;
    require_session_confirmation: boolean;
  } | null;
  togglePlay: () => void;
  toggleReplay: () => void;
  toggleTheme: () => void;
  setSpeed: (s: number) => void;
  setSymbol: (symbol: string, token: string) => void;
  setDate: (dateStr: string) => void;
  updateUserSettings: (updates: any) => Promise<void>;
  placeOrder: (
    type: 'BUY' | 'SELL', 
    quantity: number,
    orderType?: string,
    price?: number,
    stopLoss?: number,
    takeProfit?: number,
    alert?: boolean,
    simulatedTime?: string | Date,
    symbol?: string
  ) => void;
  closePosition: (
    tradeId: string | number, 
    exitType?: 'MARKET' | 'LIMIT', 
    limitPrice?: number,
    simulatedTime?: string | Date
  ) => void;
  closeAllPositions: () => Promise<void>;
  modifyOrder: (orderId: number | string, updates: any) => Promise<void>;
  resetSimulation: () => void;
  clearHistoryForReplay: () => void;
  askNewsQuestion: (newsId: number, question: string) => void;
}

export const GameContext = createContext<GameState | null>(null);

export const useGame = (): GameState => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
};

const DEFAULT_SYMBOL = 'RELIANCE';

export const GameProvider: React.FC<{ children: React.ReactNode; }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [balance, setBalance] = useState(100000);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentCandle, setCurrentCandle] = useState<CandleData | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [historicalCandles, setHistoricalCandles] = useState<CandleData[]>([]);
  const [replayTicks, setReplayTicks] = useState<Record<string, CandleData>>({});
  const [trades, setTrades] = useState<Trade[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [simulatedIndices, setSimulatedIndices] = useState<IndexData[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isReplayActive, setIsReplayActive] = useState(false);
  const [sessionType, setSessionType] = useState<'LIVE' | 'REPLAY'>('LIVE');
  const [userSettings, setUserSettings] = useState<any>(null);

  // NEW: Track all active symbols from the multi-chart store (joined as string for stable dependency)
  const allChartSymbolsStr = useMultiChartStore(state => state.charts.map(c => c.symbol).join(','));
  // Wire to the real ThemeContext so DOM .dark class is applied
  const { theme, setTheme } = useTheme();

  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // ── Load Available Dates & History ──────────────────────
  // ── Load Historical Candles ──────────────────────
  const loadHistory = useCallback(async (symbol: string, date: string) => {
    setIsLoadingHistory(true);
    setHistoricalCandles([]);
    try {
      const candles = await fetchHistoricalCandles(symbol, 500, date);
      setHistoricalCandles(candles);
      if (candles.length > 0) {
        setCurrentPrice(candles[candles.length - 1].close);
        // Default: set currentTime to the last candle (end of day) if NOT in replay active mode
        // If we are about to start a replay, we'll start at the beginning of the day (9:15 AM)
        if (isReplayActive) {
          setCurrentTime(new Date(candles[0].time * 1000));
        } else {
          setCurrentTime(new Date(candles[candles.length - 1].time * 1000));
        }
        console.log(`📊 Loaded ${candles.length} historical candles for ${symbol} on ${date}`);
      } else {
        toast.error(`No data available for ${symbol} on ${date}`);
      }
    } catch (err) {
      console.error('Failed to load historical candles:', err);
      toast.error(`Data is not available for ${symbol} on ${date}`);
      setHistoricalCandles([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // ── Load Available Dates & History ──────────────────────
  const loadAvailableDatesAndHistory = useCallback(async (symbol: string, presetDate?: string) => {
    try {
      const dates = await fetchAvailableDates(symbol);
      setAvailableDates(dates);

      let nextDate = '';
      if (presetDate && dates.includes(presetDate)) {
        nextDate = presetDate;
      } else if (dates.length > 0) {
        nextDate = dates[0];
      }

      setSelectedDate(nextDate);

      if (nextDate) {
        loadHistory(symbol, nextDate);
      } else {
        toast.error(`No trading data found for ${symbol}`);
        setHistoricalCandles([]);
      }
    } catch (err) {
      console.error('Failed to fetch available dates:', err);
      toast.error(`Error loading trading dates for ${symbol}`);
    }
  }, [loadHistory]);

  // Load on mount
  useEffect(() => {
    loadAvailableDatesAndHistory(DEFAULT_SYMBOL);
    fetchUserSettings();
  }, [loadAvailableDatesAndHistory]); // Dependency on loadAvailableDatesAndHistory

  const fetchUserSettings = async () => {
    try {
      const response = await fetch(`/api/user/settings`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setUserSettings(data);
      } else {
        throw new Error(`Failed to fetch user settings: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Failed to fetch user settings:', err);
    }
  };

  const updateUserSettings = async (updates: any) => {
    try {
      const response = await fetch(`/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      
      const data = await response.json();
      setUserSettings(data);
      toast.success('Settings updated successfully');
    } catch (err: any) {
      console.error('Update User Settings Error:', err);
      toast.error(err.message);
    }
  };

  // ── WebSocket streaming ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) {
      marketDataService.disconnect();
      setSessionType('LIVE');
      return;
    }

    setSessionType('REPLAY');
    // Clear ALL stale data so chart starts fresh from WebSocket CANDLE/TICK events.
    // Without this, historicalCandles contains 376 end-of-day candles (up to 15:29),
    // which causes ProChart's cutoff logic to break when ticks arrive at 09:15.
    setHistoricalCandles([]);
    setCurrentCandle(null);
    setCurrentTime(null);
    setReplayTicks({});
    setSimulatedIndices([]);
    setNewsItems([]);

    // Multi-symbol subscription: Send ALL symbols currently in layout
    const uniqueSymbols = Array.from(new Set([selectedSymbol, ...allChartSymbolsStr.split(',').filter(Boolean)]));
    marketDataService.connect(speed, uniqueSymbols, selectedSymbol, selectedDate);

    marketDataService.onMessage((payload: any) => {
      if (payload.type === 'ERROR') {
        toast.error(`Simulation Error: ${payload.message}`);
        setIsPlaying(false);
        return;
      }

      if (payload.type === 'END') {
        toast.success('Replay complete — end of trading day');
        setIsPlaying(false);
        return;
      }

      // --- BACKFILL (History) ---
      if (payload.type === 'BACKFILL') {
        const { candles } = payload.data;
        if (Array.isArray(candles)) {
          setHistoricalCandles(candles);
          if (candles.length > 0) {
            const lastCandle = candles[candles.length - 1];
            setCurrentPrice(lastCandle.close);
            setCurrentTime(new Date(lastCandle.time * 1000));
          }
          console.log(`📚 Received ${candles.length} backfill candles`);
        }
        return;
      }

      // --- NEWS EVENTS ---
      if (payload.type === 'NEWS_FLASH') {
        toast.info(payload.data.title, {
          description: payload.data.description,
          duration: 10000,
          position: 'top-right',
          action: {
            label: 'Explain ✨',
            onClick: () => {
              const aiTab = document.querySelector('[data-tab="analysis"]') as HTMLElement;
              if (aiTab) aiTab.click();
            }
          }
        });
        const newsEvent: NewsItem = { ...payload.data, analysis: "Analyzing impact...", sentiment: "NEUTRAL" };
        setNewsItems(prev => [newsEvent, ...prev]);
      }
      
      if (payload.type === 'NEWS_ANALYSIS') {
        const { id, analysis, sentiment, predicted_impact } = payload.data;
        setNewsItems(prev => prev.map(item => 
          item.id === id ? { ...item, analysis, sentiment, predicted_impact, qa_history: [] } : item
        ));
        toast.success(`FinGPT Analysis: ${sentiment}`, { description: "News context updated." });
      }

      if (payload.type === 'NEWS_IMPACT_RESULT') {
        const { id, actual_impact } = payload.data;
        setNewsItems(prev => prev.map(item =>
          item.id === id ? { ...item, actual_impact } : item
        ));
        toast.info(`News Impact Recorded: ${actual_impact}`);
      }

      if (payload.type === 'NEWS_ANSWER') {
        const { id, question, answer } = payload.data;
        setNewsItems(prev => prev.map(item => {
          if (item.id === id) {
            return {
              ...item,
              qa_history: [...(item.qa_history || []), { question, answer }]
            };
          }
          return item;
        }));
      }

      if (payload.type === 'NEWS_EXPLAINER') {
        const { id, explainer } = payload.data;
        setNewsItems(prev => prev.map(item => 
          item.id === id ? { ...item, explainer } : item
        ));
      }

      // --- MARKET DATA ---
      if (payload.type === 'CANDLE') {
        const d = payload.data;
        const isoStr = d.timestamp.endsWith('Z') ? d.timestamp : d.timestamp + 'Z';
        const timestamp = new Date(isoStr).getTime() / 1000;
        const candleSymbol = d.symbol || selectedSymbol;

        const newCandle: CandleData = {
          time: timestamp,
          open: d.open, high: d.high, low: d.low, close: d.close,
          volume: d.volume || 0,
          symbol: candleSymbol
        };
        setCurrentCandle(newCandle);
        setReplayTicks(prev => ({ ...prev, [candleSymbol]: newCandle }));
        
        // Only append to historicalCandles if it's the primary symbol
        if (candleSymbol === selectedSymbol) {
          setHistoricalCandles(prev => {
            const next = [...prev, newCandle];
            return next.length > 500 ? next.slice(next.length - 500) : next;
          });
          setCurrentPrice(d.close);
          setCurrentTime(new Date(isoStr));
        }
      }

      if (payload.type === 'INDICES_TICK') {
        const indexUpdates = payload.data;
        if (!indexUpdates || typeof indexUpdates !== 'object') return;
        setSimulatedIndices(prev => {
          const updated = [...prev];
          let changed = false;
          Object.values(indexUpdates).forEach((update: any) => {
            const idx = updated.findIndex(i => i.name === update.name);
            if (idx !== -1) { updated[idx] = update; changed = true; }
            else { updated.push(update); changed = true; }
          });
          return changed ? updated : prev;
        });
      }

      if (payload.type === 'order_update') {
        const order = payload.data;
        setTrades(prev => {
          const index = prev.findIndex(t => t.id === order.trade_id);
          const updatedTrade: Trade = {
            id: order.trade_id,
            symbol: order.symbol,
            direction: order.direction,
            type: order.direction,
            entryPrice: order.entry_price,
            quantity: order.quantity,
            pnl: order.pnl,
            status: order.status,
            stopLoss: order.stop_loss,
            takeProfit: order.take_profit,
            sessionType: order.session_type,
            timestamp: new Date(),
          };
          if (index !== -1) {
            const next = [...prev];
            next[index] = updatedTrade;
            return next;
          } else {
            return [updatedTrade, ...prev];
          }
        });
      }

      if (payload.type === 'TICK') {
        const tick = payload.data;
        const tickSymbol = tick.symbol || selectedSymbol;
        const isoStr = tick.timestamp.endsWith('Z') ? tick.timestamp : tick.timestamp + 'Z';
        const rawTime = new Date(isoStr).getTime() / 1000;
        const candleTime = Math.floor(rawTime / 60) * 60;

        if (tickSymbol === selectedSymbol) {
          setCurrentPrice(tick.price);
          setCurrentTime(new Date(isoStr));
        }

        const buildUpdatedCandle = (prevCandle: CandleData | null): CandleData => {
          if (!prevCandle || candleTime !== prevCandle.time) {
            return {
              time: candleTime,
              open: tick.price, high: tick.price, low: tick.price, close: tick.price,
              volume: tick.volume || 0,
              symbol: tickSymbol
            };
          }
          return {
            ...prevCandle,
            high: Math.max(prevCandle.high, tick.price),
            low: Math.min(prevCandle.low, tick.price),
            close: tick.price,
            volume: tick.volume || prevCandle.volume,
          };
        };

        if (tickSymbol === selectedSymbol) {
          setCurrentCandle(prevCandle => buildUpdatedCandle(prevCandle));
        }
        // Always update per-symbol replayTicks for independent multi-chart updates
        setReplayTicks(prev => ({ ...prev, [tickSymbol]: buildUpdatedCandle(prev[tickSymbol] || null) }));
      }
    });

    return () => {
      marketDataService.disconnect();
    };
  // Note: `speed` is intentionally excluded from deps.
  // Speed changes are handled by the dedicated effect below via marketDataService.setSpeed()
  // to avoid full WebSocket reconnection (which destroys replay state, indicators, and drawings).
  }, [isPlaying, selectedSymbol, selectedDate]);

  // Dynamic speed changes
  useEffect(() => {
    if (isPlaying) {
      marketDataService.setSpeed(speed);
    }
  }, [speed, isPlaying]);

  const togglePlay = () => setIsPlaying(prev => !prev);
  const toggleReplay = () => {
    setIsReplayActive(prev => {
      if (prev) {
        // Turning off replay: stop playback and reload static history
        setIsPlaying(false);
        setSessionType('LIVE');
        setNewsItems([]);
        setSimulatedIndices([]);
        // Reload the historical candles for the current symbol/date
        loadHistory(selectedSymbol, selectedDate);
      }
      return !prev;
    });
  };
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const setSymbol = (symbol: string, _token: string) => {
    setSelectedSymbol(symbol);
    loadAvailableDatesAndHistory(symbol, selectedDate);
  };

  const setDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    loadHistory(selectedSymbol, dateStr);
  };

  const clearHistoryForReplay = () => {
    setHistoricalCandles([]);
    setCurrentCandle(null);
  };

  const askNewsQuestion = (newsId: number, question: string) => {
    marketDataService.sendMessage({
      command: 'NEWS_QUESTION',
      news_id: newsId,
      question
    });
  };

  const placeOrder = async (
    type: 'BUY' | 'SELL', 
    quantity: number,
    orderType: string = 'MARKET',
    price?: number,
    stopLoss?: number,
    takeProfit?: number,
    alert: boolean = false,
    simulatedTime?: string | Date,
    symbol?: string
  ) => {
    try {
      const response = await fetch(`/api/trade/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol || selectedSymbol,
          direction: type,
          quantity,
          price: price || currentPrice,
          order_type: orderType,
          stop_loss: stopLoss,
          take_profit: takeProfit,
          alert,
          session_type: sessionType,
          simulated_time: simulatedTime || (sessionType === 'REPLAY' ? currentTime : undefined)
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Trade failed');
      }
      
      const result = await response.json();
      toast.success(result.message);
    } catch (err: any) {
      console.error('Trading Error:', err);
      toast.error(err.message);
    }
  };

  const modifyOrder = async (orderId: number | string, updates: any) => {
    try {
      const response = await fetch(`/api/trade/order/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          session_type: sessionType,
          simulated_time: sessionType === 'REPLAY' ? currentTime : undefined
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to modify order');
      }
      
      const result = await response.json();
      toast.success(result.message || 'Order modified');
    } catch (err: any) {
      console.error('Modify Order Error:', err);
      toast.error(err.message);
    }
  };

  const closePosition = async (tradeId: string | number, exitType: 'MARKET' | 'LIMIT' = 'MARKET', limitPrice?: number, simulatedTime?: string | Date) => {
    try {
      const response = await fetch(`/api/trade/close/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exit_type: exitType,
          limit_price: limitPrice,
          simulated_time: simulatedTime || (sessionType === 'REPLAY' ? currentTime : undefined)
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to close position');
      }

      const result = await response.json();
      toast.success(result.message || 'Position closing initiated');
    } catch (err: any) {
      console.error('Close Position Error:', err);
      toast.error(err.message);
    }
  };

  const closeAllPositions = async () => {
    try {
      const response = await fetch(`/api/trade/close-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_type: sessionType,
          simulated_time: sessionType === 'REPLAY' ? currentTime : undefined
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to close all positions');
      }

      const result = await response.json();
      toast.success(result.message || 'All positions closed successfully');
    } catch (err: any) {
      console.error('Close All Positions Error:', err);
      toast.error(err.message);
    }
  };

  const resetSimulation = () => {
    setIsPlaying(false);
    setBalance(100000);
    setTrades([]);
    setHistoricalCandles([]);
    setNewsItems([]);
    setSimulatedIndices([]);
    setCurrentCandle(null);
    setReplayTicks({});
  };

  const contextValue = React.useMemo(() => ({
    isPlaying, speed, balance, currentPrice, currentCandle, currentTime,
    historicalCandles, replayTicks, trades, newsItems, simulatedIndices, theme, selectedSymbol, selectedDate, availableDates, isLoadingHistory, isReplayActive,
    sessionType,
    userSettings,
    togglePlay, toggleTheme, setSpeed, setSymbol, setDate,
    placeOrder, modifyOrder, closePosition, closeAllPositions, resetSimulation, toggleReplay, clearHistoryForReplay, askNewsQuestion, updateUserSettings
  }), [
    isPlaying, speed, balance, currentPrice, currentCandle, currentTime,
    historicalCandles, replayTicks, trades, newsItems, simulatedIndices, theme, selectedSymbol, selectedDate, availableDates, isLoadingHistory, isReplayActive,
    sessionType,
    userSettings,
    togglePlay, toggleTheme, setSpeed, setSymbol, setDate,
    placeOrder, modifyOrder, closePosition, closeAllPositions, resetSimulation, toggleReplay, clearHistoryForReplay, askNewsQuestion, updateUserSettings
  ]);

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};