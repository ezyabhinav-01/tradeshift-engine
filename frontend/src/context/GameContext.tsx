// @refresh reset
import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import axios from 'axios';
import type { CandleData, Trade } from '../types';
import { marketDataService, fetchHistoricalCandles, fetchAvailableDates } from '../services/MarketDataService';
import { toast } from 'sonner';
import { useMultiChartStore } from '../store/useMultiChartStore';
import { usePortfolioStore } from '../store/usePortfolioStore';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';

export interface NewsItem {
  id: string | number;
  symbol: string;
  title: string;
  description: string;
  time_str: string;
  source: string;
  url: string;
  imageUrl?: string;
  analysis?: string;
  sentiment?: string;
  predicted_impact?: string;
  actual_impact?: string;
  qa_history?: { question: string, answer: string; }[];
  explainer?: {
    essence: string;
    analogy: string;
    golden_rule: string;
  };
  is_simulated?: boolean;
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
  sessionType: 'REPLAY';
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
    symbol?: string,
    limitPrice?: number,
    stopPrice?: number
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
  askNewsQuestion: (newsId: string | number, question: string) => void;
}

export const GameContext = createContext<GameState | null>(null);

export const useGame = (): GameState => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
};

const DEFAULT_SYMBOL = 'RELIANCE';

export const GameProvider: React.FC<{ children: React.ReactNode; }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(() => sessionStorage.getItem('isPlaying') === 'true');
  const [speed, setSpeed] = useState(1);
  const [balance, setBalance] = useState(100000);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentCandle, setCurrentCandle] = useState<CandleData | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(() => {
    const savedTime = sessionStorage.getItem('currentTime');
    return savedTime ? new Date(savedTime) : null;
  });
  const { user, checkAuth } = useAuth();
  const [historicalCandles, setHistoricalCandles] = useState<CandleData[]>([]);
  const [replayTicks, setReplayTicks] = useState<Record<string, CandleData>>({});
  const [trades, setTrades] = useState<Trade[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [simulatedIndices, setSimulatedIndices] = useState<IndexData[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isReplayActive, setIsReplayActive] = useState(() => sessionStorage.getItem('isReplayActive') === 'true');
  const [sessionType, setSessionType] = useState<'REPLAY'>(() => 'REPLAY');
  const [userSettings, setUserSettings] = useState<any>(null);
  const isSameNewsId = (a: string | number, b: string | number) => String(a) === String(b);

  // NEW: Track all active symbols from the multi-chart store (joined as string for stable dependency)
  const allChartSymbolsStr = useMultiChartStore(state => state.charts.map(c => c.symbol).join(','));
  // Wire to the real ThemeContext so DOM .dark class is applied
  const { theme, setTheme } = useTheme();

  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [sessionLockedDate, setSessionLockedDate] = useState(() => sessionStorage.getItem('replaySessionLockedDate') || '');
  const lastPortfolioSyncAtRef = useRef(0);

  const syncPortfolioNow = useCallback(async (force: boolean = false) => {
    const now = Date.now();
    if (!force && now - lastPortfolioSyncAtRef.current < 800) return;
    lastPortfolioSyncAtRef.current = now;
    try {
      await usePortfolioStore.getState().refreshPortfolio({ sessionType: 'REPLAY', force: true });
    } catch (err) {
      console.warn('Portfolio sync skipped:', err);
    }
  }, []);
  
  // Persist session type and replay status
  useEffect(() => {
    sessionStorage.setItem('sessionType', sessionType);
    sessionStorage.setItem('isReplayActive', isReplayActive.toString());
    sessionStorage.setItem('isPlaying', isPlaying.toString());
  }, [sessionType, isReplayActive, isPlaying]);

  useEffect(() => {
    if (sessionLockedDate) {
      sessionStorage.setItem('replaySessionLockedDate', sessionLockedDate);
    } else {
      sessionStorage.removeItem('replaySessionLockedDate');
    }
  }, [sessionLockedDate]);

  useEffect(() => {
    if (currentTime) {
      sessionStorage.setItem('currentTime', currentTime.toISOString());
    } else {
      sessionStorage.removeItem('currentTime');
    }
  }, [currentTime]);

  // ── Load Available Dates & History ──────────────────────
  // ── Load Historical Candles ──────────────────────
  const loadHistory = useCallback(async (symbol: string, date: string, lookbackDays: number = 2): Promise<number> => {
    setIsLoadingHistory(true);
    // Don't clear immediately to avoid "1-second vanish" flicker. 
    // The previous historicalCandles will stay on chart until replaced.
    try {
      const candles = await fetchHistoricalCandles(symbol, 5000, date, '1min', lookbackDays);
      setHistoricalCandles(candles);
      if (candles.length > 0) {
        setCurrentPrice(candles[candles.length - 1].close);
        if (!isReplayActive) {
          // Initial load: show most recent replay datapoint
          setCurrentTime(new Date(candles[candles.length - 1].time * 1000));
        } else if (!currentTime && date) {
          // In replay, anchor only if clock not initialized yet.
          const firstCandleOfSelectedDay = candles.find(c => {
            const cDate = new Date(c.time * 1000).toISOString().split('T')[0];
            return cDate === date;
          });
          if (firstCandleOfSelectedDay) {
            setCurrentTime(new Date(firstCandleOfSelectedDay.time * 1000));
          } else {
            setCurrentTime(new Date(candles[0].time * 1000));
          }
        }

        console.log(`📊 Loaded ${candles.length} historical candles for ${symbol} on ${date}`);
        return candles.length;
      } else {
        toast.error(`No data available for ${symbol} on ${date}`);
        return 0;
      }
    } catch (err) {
      console.error('Failed to load historical candles:', err);
      toast.error(`Data is not available for ${symbol} on ${date}`);
      setHistoricalCandles([]);
      return 0;
    } finally {
      setIsLoadingHistory(false);
    }
  }, [isReplayActive, currentTime]);

  // ── Load Available Dates & History ──────────────────────
  const loadAvailableDatesAndHistory = useCallback(async (symbol: string, presetDate?: string, strictPreset: boolean = false) => {
    try {
      const dates = await fetchAvailableDates(symbol);
      // Limit to only 5 latest available dates as per requirement
      const latest5Dates = dates.slice(0, 5);

      let nextDate = '';
      if (presetDate && latest5Dates.includes(presetDate)) {
        nextDate = presetDate;
      } else if (presetDate && strictPreset) {
        setAvailableDates([presetDate]);
        setSelectedDate(presetDate);
        setHistoricalCandles([]);
        toast.error(`${symbol} has no data on locked session date ${presetDate}. Choose another symbol from that session date.`);
        return;
      } else if (latest5Dates.length > 0) {
        nextDate = latest5Dates[0];
      }

      if (strictPreset && nextDate) {
        setAvailableDates([nextDate]);
      } else {
        setAvailableDates(latest5Dates);
      }

      setSelectedDate(nextDate);

      if (nextDate) {
        // Initial load (First Search) -> Load with 2-day historical lookback
        loadHistory(symbol, nextDate, 2);
      } else {
        toast.error(`No trading data found for ${symbol}`);
        setHistoricalCandles([]);
      }
    } catch (err) {
      console.error('Failed to fetch available dates:', err);
      toast.error(`Error loading trading dates for ${symbol}`);
    }
  }, [loadHistory]);

  const fetchUserSettings = useCallback(async () => {
    try {
      const response = await axios.get('/api/user/settings');
      setUserSettings(response.data);
    } catch (err) {
      console.error('Failed to fetch user settings:', err);
    }
  }, []);

  const fetchActiveTrades = useCallback(async () => {
    try {
      const response = await fetch('/api/trade/orders', { credentials: 'include' });
      if (response.ok) {
        const orders = await response.json();
        const formattedTrades: Trade[] = orders.map((o: any) => ({
          id: o.trade_id,
          symbol: o.symbol,
          direction: o.direction,
          type: o.direction,
          parentTradeId: o.parent_trade_id,
          entryPrice: o.entry_price,
          exitPrice: o.exit_price,
          quantity: o.quantity,
          pnl: o.pnl,
          exitReason: o.exit_reason,
          entryTime: o.entry_time,
          exitTime: o.exit_time,
          holdingTimeSeconds: o.holding_time_seconds,
          holdingTimeMins: o.holding_time_mins,
          status: o.status,
          stopLoss: o.stop_loss,
          takeProfit: o.take_profit,
          limitPrice: o.limit_price,
          stopPrice: o.stop_price,
          sessionType: o.session_type,
          timestamp: new Date(),
        }));
        setTrades(formattedTrades);
        const replayAnchorOrder = orders.find((o: any) =>
          (o.session_type || '').toUpperCase() === 'REPLAY' &&
          o.entry_time &&
          o.parent_trade_id == null &&
          ['OPEN', 'TRIGGERED'].includes((o.status || '').toUpperCase())
        );
        if (replayAnchorOrder?.entry_time) {
          const tradeDay = String(replayAnchorOrder.entry_time).split('T')[0];
          if (tradeDay) {
            setSessionLockedDate(tradeDay);
          }
        } else {
          // No active replay parent positions => unlock date automatically.
          setSessionLockedDate('');
        }
        void syncPortfolioNow();
      }
    } catch (err) {
      console.error('Failed to fetch active trades:', err);
    }
  }, [syncPortfolioNow]);

  // Load on mount
  useEffect(() => {
    loadAvailableDatesAndHistory(DEFAULT_SYMBOL);
    fetchUserSettings();
    fetchActiveTrades();
  }, [loadAvailableDatesAndHistory, fetchUserSettings, fetchActiveTrades]);

  // ── Heartbeat tracking for Admin Dashboard ────────────────
  useEffect(() => {
    // Ping heartbeat every 30 seconds to keep last_active_at fresh
    const heartbeatInterval = setInterval(async () => {
      try {
        await fetch('/api/user/heartbeat', { credentials: 'include' });
      } catch (err) {
        // Silent fail for heartbeat
      }
    }, 30000);

    return () => clearInterval(heartbeatInterval);
  }, []);

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
      return;
    }

    if (isReplayActive) {
      setSessionType('REPLAY');
    }
    // NOTE: We no longer clear currentTime or currentCandle here if they were 
    // already set by toggleReplay or setDate. This prevents the "blank flash" 
    // and ensures the chart starts precisely at 09:15.
    if (!currentTime) {
      setCurrentPrice(historicalCandles.length > 0 ? historicalCandles[historicalCandles.length - 1].close : 0);
      setCurrentTime(historicalCandles.length > 0 ? new Date(historicalCandles[historicalCandles.length - 1].time * 1000) : null);
    }

    setReplayTicks({});
    setSimulatedIndices([]);
    setNewsItems([]);

    // Multi-symbol subscription: Send ALL symbols currently in layout
    const uniqueSymbols = Array.from(new Set([selectedSymbol, ...allChartSymbolsStr.split(',').filter(Boolean)]));

    // Resume from current time if we have it pinned
    const startTimeStr = (isReplayActive && currentTime) ? currentTime.toISOString() : undefined;
    
    // Pass user ID (or fallback to 1 for Guest) to ensure correct event room registration
    const userId = user?.id || 1;
    marketDataService.connect(speed, userId, uniqueSymbols, selectedSymbol, selectedDate, startTimeStr);



    marketDataService.onMessage((payload: any) => {
      if (payload.type === 'ERROR') {
        toast.error(`Simulation Error: ${payload.message}`);
        setIsPlaying(false);
        return;
      }

      if (payload.type === 'SPEED_ACK') {
        const ackSpeed = Number(payload?.data?.speed || 1);
        if (Number.isFinite(ackSpeed)) {
          console.log(`⏩ Server replay speed acknowledged: ${ackSpeed}x`);
        }
      }

      if (payload.type === 'END') {
        toast.success('Replay complete — end of trading day');
        setIsPlaying(false);
        return;
      }

      // --- BACKFILL (History) ---
      if (payload.type === 'BACKFILL') {
        const { candles } = payload.data;
        if (Array.isArray(candles) && candles.length > 0) {
          // Merge logic: If we are resuming, we may already have part of this history.
          // We use a Map to ensure unique timestamps.
          setHistoricalCandles(prev => {
            const combined = [...prev, ...candles];
            const uniqueMap = new Map();
            combined.forEach(c => uniqueMap.set(c.time, c));
            return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
          });

          const lastCandle = candles[candles.length - 1];
          const backfillTime = new Date(lastCandle.time * 1000);

          // Only move clock forward if this backfill is ahead
          if (!currentTime || currentTime < backfillTime) {
            setCurrentPrice(lastCandle.close);
            setCurrentTime(backfillTime);
          }
          console.log(`📚 Received and merged ${candles.length} backfill candles`);
        }
        return;
      }



      // --- NEWS EVENTS ---
      if (payload.type === 'NEWS_FLASH') {
        const titlePrefix = payload.data.is_simulated ? "⚡ Simulation Sync: " : "📰 News Flash: ";
        toast.info(titlePrefix + payload.data.title, {
          description: payload.data.description,
          duration: 12000,
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
          isSameNewsId(item.id, id) ? { ...item, analysis, sentiment, predicted_impact, qa_history: [] } : item
        ));
        toast.success(`FinGPT Analysis: ${sentiment}`, { description: "News context updated." });
      }

      if (payload.type === 'NEWS_IMPACT_RESULT') {
        const { id, actual_impact } = payload.data;
        setNewsItems(prev => prev.map(item =>
          isSameNewsId(item.id, id) ? { ...item, actual_impact } : item
        ));
        toast.info(`News Impact Recorded: ${actual_impact}`);
      }

      if (payload.type === 'NEWS_ANSWER') {
        const { id, question, answer } = payload.data;
        setNewsItems(prev => prev.map(item => {
          if (isSameNewsId(item.id, id)) {
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
          isSameNewsId(item.id, id) ? { ...item, explainer } : item
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
        
        // 🔥 Refresh user balance if trade was filled or closed
        if (order.status === 'FILLED' || order.status === 'CLOSED' || order.status === 'OPEN') {
           checkAuth();
        }
        setTrades(prev => {
          const index = prev.findIndex(t => t.id === order.trade_id);
          const updatedTrade: Trade = {
            id: order.trade_id,
            symbol: order.symbol,
            direction: order.direction,
            type: order.direction,
            parentTradeId: order.parent_trade_id,
            entryPrice: order.entry_price,
            exitPrice: order.exit_price,
            quantity: order.quantity,
            pnl: order.pnl,
            exitReason: order.exit_reason,
            entryTime: order.entry_time,
            exitTime: order.exit_time,
            holdingTimeSeconds: order.holding_time_seconds,
            holdingTimeMins: order.holding_time_mins,
            status: order.status,
            stopLoss: order.stop_loss,
            takeProfit: order.take_profit,
            limitPrice: order.limit_price,
            stopPrice: order.stop_price,
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
        if (['OPEN', 'FILLED', 'CLOSED', 'PENDING', 'TRIGGERED', 'CANCELLED'].includes(order.status)) {
          void syncPortfolioNow();
        }
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
  }, [isPlaying, selectedSymbol, selectedDate, allChartSymbolsStr]);

  // Dynamic speed changes
  useEffect(() => {
    if (isPlaying) {
      marketDataService.setSpeed(speed);
    }
  }, [speed, isPlaying]);

  const togglePlay = () => setIsPlaying(prev => !prev);
  const toggleReplay = () => {
    setIsReplayActive(prev => {
      const nextReplayState = !prev;
      if (nextReplayState) {
        // Turning ON replay: jump back to start of day
        const firstCandle = historicalCandles.find(c => {
          const cDate = new Date(c.time * 1000).toISOString().split('T')[0];
          return cDate === (selectedDate || "");
        });
        if (firstCandle) {
          setCurrentTime(new Date(firstCandle.time * 1000));
          setCurrentPrice(firstCandle.open); // Initialize to open price of day
          // Create a "pending" candle for 09:15
          setCurrentCandle({
            time: firstCandle.time,
            open: firstCandle.open,
            high: firstCandle.open,
            low: firstCandle.open,
            close: firstCandle.open,
            volume: 0
          });
          console.log("⏱️ Replay initialized at start of day");
        }
      } else {

        // Turning OFF replay: stop playback and reset session
        setIsPlaying(false);
        setSessionType('REPLAY');
        setNewsItems([]);
        setSimulatedIndices([]);
        setSessionLockedDate('');
        // Sync time to the end of history when turning off replay
        if (historicalCandles.length > 0) {
          setCurrentTime(new Date(historicalCandles[historicalCandles.length - 1].time * 1000));
        }
      }
      return nextReplayState;
    });
  };
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const setSymbol = (symbol: string, _token: string) => {
    setSelectedSymbol(symbol);
    const enforcedDate = sessionLockedDate || selectedDate;
    loadAvailableDatesAndHistory(symbol, enforcedDate, Boolean(sessionLockedDate));
  };

  const setDate = (dateStr: string) => {
    if (sessionLockedDate && dateStr !== sessionLockedDate) {
      toast.error(`Session locked to ${sessionLockedDate}. Exit replay to choose a different date.`);
      return;
    }
    setSelectedDate(dateStr);
    // Load exactly 2 days prior to the selected date (context for replay)
    loadHistory(selectedSymbol, dateStr, 2);
  };

  const clearHistoryForReplay = () => {
    setHistoricalCandles([]);
    setCurrentCandle(null);
  };

  const askNewsQuestion = (newsId: string | number, question: string) => {
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
    symbol?: string,
    limitPrice?: number,
    stopPrice?: number
  ) => {
    try {
      const effectiveSelectedDate = selectedDate || sessionLockedDate || '';

      if (sessionLockedDate && effectiveSelectedDate !== sessionLockedDate) {
        toast.error(`Trading session is locked to ${sessionLockedDate}.`);
        return;
      }

      if (sessionLockedDate && !selectedDate) {
        // Auto-heal transient date mismatch states before placing order.
        setSelectedDate(sessionLockedDate);
      }

      if (isReplayActive && historicalCandles.length === 0) {
        const dateToLoad = sessionLockedDate || selectedDate;
        let loadedCount = historicalCandles.length;
        if (dateToLoad) {
          loadedCount = await loadHistory(symbol || selectedSymbol, dateToLoad, 2);
        }
        if (loadedCount === 0) {
          toast.error(`No replay candles loaded for ${selectedSymbol} on ${effectiveSelectedDate || 'selected date'}.`);
          return;
        }
      }

      const response = await fetch(`/api/trade/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol || selectedSymbol,
          direction: type,
          quantity,
          price: price || currentPrice || (historicalCandles.length > 0 ? historicalCandles[historicalCandles.length - 1].close : 0),
          order_type: orderType,
          limit_price: limitPrice,
          stop_price: stopPrice,
          stop_loss: stopLoss,
          take_profit: takeProfit,
          alert,
          session_type: 'REPLAY',
          simulated_time: simulatedTime || currentTime
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Trade failed');
      }

      const result = await response.json();
      const lockDate = sessionLockedDate || effectiveSelectedDate;
      if (!sessionLockedDate && lockDate) {
        setSessionLockedDate(lockDate);
        setAvailableDates([lockDate]);
      }
      await fetchActiveTrades();
      await syncPortfolioNow(true);
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
          session_type: 'REPLAY',
          simulated_time: currentTime
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to modify order');
      }

      const result = await response.json();
      toast.success(result.message || 'Order modified');
      await syncPortfolioNow(true);
    } catch (err: any) {
      console.error('Modify Order Error:', err);
      toast.error(err.message);
    }
  };

  const closePosition = async (tradeId: string | number, exitType: 'MARKET' | 'LIMIT' = 'MARKET', limitPrice?: number, simulatedTime?: string | Date) => {
    try {
      const activeTrade = trades.find(t => String(t.id) === String(tradeId));
      const tradeSymbol = activeTrade?.symbol;
      const symbolTickPrice = tradeSymbol ? replayTicks[tradeSymbol]?.close : undefined;
      const safeExitPrice = exitType === 'LIMIT'
        ? limitPrice
        : (symbolTickPrice ?? (tradeSymbol === selectedSymbol ? currentPrice : undefined));

      const response = await fetch(`/api/trade/close/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exit_type: exitType,
          limit_price: limitPrice,
          exit_price: safeExitPrice, // Prefer symbol-matched replay price
          session_type: 'REPLAY',
          simulated_time: simulatedTime || currentTime
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to close position');
      }

      const result = await response.json();
      await fetchActiveTrades();
      await syncPortfolioNow(true);
      toast.success(result.message || 'Position closing initiated');
    } catch (err: any) {
      console.error('Close Position Error:', err);
      toast.error(err.message);
    }
  };

  const closeAllPositions = async () => {
    try {
      const openTrades = trades.filter(t => t.status === 'OPEN' || t.status === 'TRIGGERED');
      const exitPriceMapping: Record<string, number> = {};
      openTrades.forEach(t => {
        const p = replayTicks[t.symbol]?.close;
        if (typeof p === 'number' && Number.isFinite(p) && p > 0) {
          exitPriceMapping[t.symbol] = p;
        }
      });

      const response = await fetch(`/api/trade/close-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_type: 'REPLAY',
          // Per-symbol replay prices keep PnL accurate across multi-symbol closes.
          exit_price_mapping: exitPriceMapping,
          simulated_time: currentTime
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to close all positions');
      }

      const result = await response.json();
      await fetchActiveTrades();
      await syncPortfolioNow(true);
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
    setSessionLockedDate('');
    setHistoricalCandles([]);
    setNewsItems([]);
    setSimulatedIndices([]);
    setCurrentCandle(null);
    setReplayTicks({});
  };

  const contextValue = React.useMemo(() => ({
    isPlaying, speed, balance, currentPrice, currentCandle, currentTime,
    historicalCandles, replayTicks, trades, newsItems, simulatedIndices, theme, selectedSymbol, selectedDate, availableDates: sessionLockedDate ? [sessionLockedDate] : availableDates, isLoadingHistory, isReplayActive,
    sessionType,
    userSettings,
    togglePlay, toggleTheme, setSpeed, setSymbol, setDate,
    placeOrder, modifyOrder, closePosition, closeAllPositions, resetSimulation, toggleReplay, clearHistoryForReplay, askNewsQuestion, updateUserSettings
  }), [
    isPlaying, speed, balance, currentPrice, currentCandle, currentTime,
    historicalCandles, replayTicks, trades, newsItems, simulatedIndices, theme, selectedSymbol, selectedDate, availableDates, sessionLockedDate, isLoadingHistory, isReplayActive,
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
