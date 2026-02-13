import React, { useState, useEffect, createContext, useContext, useRef } from 'react';

// New Interface for full Candle Data
export interface CandleData {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  quantity: number;
  pnl?: number;
  timestamp: Date;
  status: 'OPEN' | 'CLOSED';
}

interface GameState {
  isPlaying: boolean;
  speed: number;
  balance: number;
  currentPrice: number;
  currentCandle: CandleData | null; // <--- NEW: Expose full candle
  trades: Trade[];
  theme: 'light' | 'dark';
  selectedSymbol: string;
  selectedToken: string;
  toggleTheme: () => void;
  togglePlay: () => void;
  setSpeed: (s: number) => void;
  setSymbol: (symbol: string, token: string) => void;
  placeOrder: (type: 'BUY' | 'SELL', qty: number) => void;
  closePosition: (tradeId: string) => void;
  resetSimulation: () => void;
}

const WEBSOCKET_URL = "ws://localhost:8000/ws/ticker";
const GameContext = createContext<GameState | null>(null);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [balance, setBalance] = useState(100000);
  const [currentPrice, setCurrentPrice] = useState(21500);
  const [currentCandle, setCurrentCandle] = useState<CandleData | null>(null); // <--- NEW STATE
  const [trades, setTrades] = useState<Trade[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [selectedSymbol, setSelectedSymbol] = useState('NIFTY');
  const [selectedToken, setSelectedToken] = useState('26000');

  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    if (!isPlaying) {
      if (ws.current) ws.current.close();
      return;
    }

    const socket = new WebSocket(WEBSOCKET_URL);

    socket.onopen = () => {
      console.log("🟢 Connected");
      // Send START command with selected symbol
      socket.send(JSON.stringify({
        command: "START",
        symbol: selectedSymbol, // Use symbol as-is (e.g., "NIFTY", "BANKNIFTY")
        speed: speed
      }));
    };

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      // HANDLE FULL CANDLE (From Parquet)
      if (payload.type === 'CANDLE') {
        const d = payload.data;

        // 1. Parse the timestamp
        // If d.timestamp is "2024-01-01 09:15:00", new Date() might treat it as local or UTC depending on browser.
        // The issue is that Lightweight Charts displays time in UTC by default.
        // You are seeing 3:45 (UTC) for 9:15 (IST). This means the timestamp value corresponds to 3:45 UTC.
        // To display 9:15 on the chart, we need to shift the timestamp to be 9:15 UTC.
        // Difference: 5 hours 30 minutes = 19800 seconds.

        const rawTime = new Date(d.timestamp).getTime() / 1000;
        const timestamp = rawTime + 19800; // Add 5.5 hours to shift display from 3:45 to 9:15

        console.log('🕯️ New Candle:', {
          ts_str: d.timestamp,
          raw: rawTime,
          final_ts: timestamp,
          close: d.close
        });

        const newCandle = {
          time: timestamp,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close
        };

        setCurrentCandle(newCandle);
        setCurrentPrice(d.close); // Live price is the Close of the candle
      }

      // Fallback for Random Simulation
      if (payload.type === 'TICK') {
        const price = payload.data.price;
        setCurrentPrice(price);

        // Update Current Candle Live
        setCurrentCandle(prev => {
          if (!prev) {
            // Initialize first candle from tick
            const rawTime = new Date(payload.data.timestamp).getTime() / 1000;
            const timestamp = rawTime + 19800;
            return {
              time: timestamp,
              open: price,
              high: price,
              low: price,
              close: price
            };
          }

          // Check if tick belongs to new minute?
          // Backend sends CANDLE at end of minute, causing a "jump" or finalization.
          // For now, we update the developing candle.
          return {
            ...prev,
            high: Math.max(prev.high, price),
            low: Math.min(prev.low, price),
            close: price
          };
        });
      }
    };

    ws.current = socket;
    return () => { if (ws.current) ws.current.close(); };
  }, [isPlaying, speed, selectedSymbol]); // Added selectedSymbol dependency

  const togglePlay = () => setIsPlaying(!isPlaying);
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const setSymbol = (symbol: string, token: string) => {
    setSelectedSymbol(symbol);
    setSelectedToken(token);
    console.log(`Selected symbol: ${symbol}, token: ${token}`);
  };

  const placeOrder = (type: 'BUY' | 'SELL', quantity: number) => {
    const newTrade: Trade = {
      id: Math.random().toString(36).substr(2, 9),
      symbol: selectedSymbol,
      type,
      entryPrice: currentPrice,
      quantity,
      timestamp: new Date(currentCandle ? currentCandle.time * 1000 : Date.now()),
      status: 'OPEN'
    };
    setTrades([newTrade, ...trades]);
  };

  const closePosition = (tradeId: string) => {
    setTrades(prevTrades => prevTrades.map(trade => {
      if (trade.id === tradeId && trade.status === 'OPEN') {
        const exitPrice = currentPrice;
        const multiplier = trade.type === 'BUY' ? 1 : -1;
        const pnl = (exitPrice - trade.entryPrice) * trade.quantity * multiplier;
        setBalance(prev => prev + pnl);
        return { ...trade, status: 'CLOSED', exitPrice, pnl };
      }
      return trade;
    }));
  };

  const resetSimulation = () => {
    setIsPlaying(false);
    setBalance(100000);
    setTrades([]);
    setCurrentCandle(null);
  };

  return (
    <GameContext.Provider value={{
      isPlaying, speed, balance, currentPrice, currentCandle, trades, theme, selectedSymbol, selectedToken,
      togglePlay, setSpeed, setSymbol, placeOrder, closePosition, resetSimulation, toggleTheme
    }}>
      {children}
    </GameContext.Provider>
  );
};