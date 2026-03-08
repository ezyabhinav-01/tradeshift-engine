// @refresh reset
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { CandleData, Trade } from '../types';
import { marketDataService, fetchHistoricalCandles, fetchAvailableDates } from '../services/MarketDataService';
import { toast } from 'sonner';

interface GameState {
  isPlaying: boolean;
  speed: number;
  balance: number;
  currentPrice: number;
  currentCandle: CandleData | null;
  currentTime: Date | null;
  historicalCandles: CandleData[];
  trades: Trade[];
  theme: 'dark' | 'light';
  selectedSymbol: string;
  selectedDate: string;
  availableDates: string[];
  isLoadingHistory: boolean;
  isReplayActive: boolean;
  togglePlay: () => void;
  toggleReplay: () => void;
  toggleTheme: () => void;
  setSpeed: (s: number) => void;
  setSymbol: (symbol: string, token: string) => void;
  setDate: (dateStr: string) => void;
  placeOrder: (type: 'BUY' | 'SELL', qty: number) => void;
  closePosition: (tradeId: string) => void;
  resetSimulation: () => void;
  clearHistoryForReplay: () => void;
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
  const [trades, setTrades] = useState<Trade[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isReplayActive, setIsReplayActive] = useState(false);

  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);

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
  }, []);

  // ── Load Historical Candles ──────────────────────
  const loadHistory = useCallback(async (symbol: string, date: string) => {
    setIsLoadingHistory(true);
    setHistoricalCandles([]);
    try {
      const candles = await fetchHistoricalCandles(symbol, 500, date);
      setHistoricalCandles(candles);
      if (candles.length > 0) {
        setCurrentPrice(candles[candles.length - 1].close);
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

  // Load on mount
  useEffect(() => {
    loadAvailableDatesAndHistory(DEFAULT_SYMBOL);
  }, []);

  // ── WebSocket streaming ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) {
      marketDataService.disconnect();
      return;
    }

    // Clear existing chart data — replay starts from 9:15
    setHistoricalCandles([]);
    setCurrentCandle(null);

    marketDataService.connect(speed, selectedSymbol, selectedDate);

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

      // CANDLE event: backend sends the full OHLCV for each completed minute
      if (payload.type === 'CANDLE') {
        const d = payload.data;
        // Append 'Z' to treat naive ISO as UTC (matching Python .timestamp() on Windows)
        const isoStr = d.timestamp.endsWith('Z') ? d.timestamp : d.timestamp + 'Z';
        const timestamp = new Date(isoStr).getTime() / 1000;

        const newCandle: CandleData = {
          time: timestamp,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume || 0,
        };
        setCurrentCandle(newCandle);
        setCandles(prev => [...prev, newCandle]); // Add to history
        setCurrentPrice(d.close);
        setCurrentTime(new Date(isoStr));
      }

      // TICK event: sub-minute price updates within a candle
      if (payload.type === 'TICK') {
        const tick = payload.data;
        setCurrentPrice(tick.price);
        const isoStr = tick.timestamp.endsWith('Z') ? tick.timestamp : tick.timestamp + 'Z';
        setCurrentTime(new Date(isoStr));

        setCurrentCandle(prevCandle => {
          const rawTime = new Date(isoStr).getTime() / 1000;
          const candleTime = Math.floor(rawTime / 60) * 60;

          if (!prevCandle || candleTime !== prevCandle.time) {
            return {
              time: candleTime,
              open: tick.price,
              high: tick.price,
              low: tick.price,
              close: tick.price,
              volume: tick.volume || 0,
            };
          }

          return {
            ...prevCandle,
            high: Math.max(prevCandle.high, tick.price),
            low: Math.min(prevCandle.low, tick.price),
            close: tick.price,
            volume: tick.volume || prevCandle.volume,
          };
        });
      }
    });

    return () => {
      marketDataService.disconnect();
    };
  }, [isPlaying, selectedSymbol, selectedDate]);

  // Dynamic speed changes
  useEffect(() => {
    if (isPlaying) {
      marketDataService.setSpeed(speed);
    }
  }, [speed, isPlaying]);

  const togglePlay = () => setIsPlaying(prev => !prev);
  const toggleReplay = () => setIsReplayActive(prev => !prev);
  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

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

  const placeOrder = (type: 'BUY' | 'SELL', quantity: number) => {
    const newTrade: Trade = {
      id: Math.random().toString(36).substr(2, 9),
      symbol: selectedSymbol,
      type,
      entryPrice: currentPrice,
      quantity,
      timestamp: new Date(currentCandle ? currentCandle.time * 1000 : Date.now()),
      status: 'OPEN',
    };
    setTrades(prev => [newTrade, ...prev]);
  };

  const closePosition = (tradeId: string) => {
    setTrades(prevTrades =>
      prevTrades.map(trade => {
        if (trade.id === tradeId && trade.status === 'OPEN') {
          const exitPrice = currentPrice;
          const multiplier = trade.type === 'BUY' ? 1 : -1;
          const pnl = (exitPrice - trade.entryPrice) * trade.quantity * multiplier;
          setBalance(prev => prev + pnl);
          return { ...trade, status: 'CLOSED', exitPrice, pnl };
        }
        return trade;
      }),
    );
  };

  const resetSimulation = () => {
    setIsPlaying(false);
    setBalance(100000);
    setTrades([]);
    setCurrentCandle(null);
  };

  return (
    <GameContext.Provider
      value={{
        isPlaying, speed, balance, currentPrice, currentCandle, currentTime,
        historicalCandles, trades, theme, selectedSymbol, selectedDate, availableDates, isLoadingHistory, isReplayActive,
        togglePlay, toggleTheme, setSpeed, setSymbol, setDate,
        placeOrder, closePosition, resetSimulation, toggleReplay, clearHistoryForReplay
      }}
    >
      {children}
    </GameContext.Provider>
  );
};