import { useEffect, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useGameActions, useGameMarket, useGamePlayback } from '../../hooks/useGame';
import { useMultiChartStore } from '../../store/useMultiChartStore';
import { Separator } from '@/components/ui/separator';

export interface IndexData {
  name: string;
  price: number;
  change: number;
  change_percent: number;
  is_positive: boolean;
}

export const GlobalTicker = () => {
  const navigate = useNavigate();
  const [liveIndices, setLiveIndices] = useState<IndexData[]>([]);
  const { isPlaying, isReplayActive } = useGamePlayback();
  const { simulatedIndices } = useGameMarket();
  const { setSymbol } = useGameActions();
  const { activeChartId, updateChart } = useMultiChartStore();

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const response = await axios.get(`/api/market/indices`);

        // Fetch all indices and store them (we map them manually during render)
        setLiveIndices(response.data);
      } catch (err) {
        console.error('Failed to fetch ticker data', err);
      }
    };

    fetchIndices();
    const interval = setInterval(fetchIndices, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const normalizeTickerName = (value?: string) =>
    (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Merge live + replay tickers so replay values override when available, but
  // we never drop to all-zero placeholders due partial replay payloads.
  const mergedByName = new Map<string, IndexData>();
  liveIndices.forEach(item => {
    mergedByName.set(normalizeTickerName(item.name), item);
  });
  simulatedIndices.forEach(item => {
    const key = normalizeTickerName(item.name);
    const existing = mergedByName.get(key);
    const hasValidReplayPrice = Number.isFinite(item.price) && item.price > 0;
    // Do not let placeholder replay zeros overwrite valid live values.
    if (!existing || hasValidReplayPrice) {
      mergedByName.set(key, item);
    }
  });

  const targetSymbols = [
    { searchName: 'NIFTY', displayName: 'NIFTY', exactMatches: ['NIFTY', 'NIFTY 50'] },
    { searchName: 'BANKNIFTY', displayName: 'BANKNIFTY', exactMatches: ['BANKNIFTY', 'BANK NIFTY'] },
    { searchName: 'SENSEX', displayName: 'SENSEX', exactMatches: ['SENSEX', 'BSE SENSEX'] },
    { searchName: 'HDFCBANK', displayName: 'HDFCBANK', exactMatches: ['HDFCBANK', 'HDFC BANK'] },
    { searchName: 'RELIANCE', displayName: 'RELIANCE', exactMatches: ['RELIANCE'] }
  ];

  const displayIndices: IndexData[] = targetSymbols.map(target => {
    let found: IndexData | undefined;
    for (const alias of target.exactMatches) {
      const byName = mergedByName.get(normalizeTickerName(alias));
      if (byName) {
        found = byName;
        break;
      }
    }

    if (found) return found;

    // Fallback if not loaded/found from API
    return {
      name: target.displayName,
      price: 0,
      change: 0,
      change_percent: 0,
      is_positive: true
    };
  });

  return (
    <div data-tutorial="global-ticker" className="flex items-center gap-4 px-4 overflow-x-auto whitespace-nowrap hide-scrollbar text-[13px] font-sans">

      {isReplayActive && (
        <>
          <div className={`flex items-center text-xs font-bold text-indigo-400 gap-1.5 shrink-0 ${isPlaying ? 'animate-pulse' : ''}`}>
            <span>{isPlaying ? 'SIM SYNC' : 'REPLAY HOLD'}</span>
          </div>
          <Separator orientation="vertical" className="h-4 w-[3px] bg-tv-border/40 mx-2" />
        </>
      )}

      {displayIndices.map((idx, i) => {
        const isPos = idx.is_positive ?? idx.change >= 0;
        const colorClass = isPos ? 'text-[#089981]' : 'text-[#f23645]';
        const sign = isPos ? '+' : '';
        return (
          <Fragment key={idx.name + i}>
            <div
              className="flex items-center gap-2 shrink-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 px-2 py-1 rounded transition-colors"
              onClick={() => {
                updateChart(activeChartId, { symbol: idx.name });
                setSymbol(idx.name, '');
                navigate('/trade');
              }}
            >
              <span className="text-tv-text-primary font-bold uppercase tracking-wide">{idx.name}</span>
              <span className="text-tv-text-primary font-medium">{idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span className={colorClass}>
                {idx.change.toFixed(2)} ({sign}{idx.change_percent.toFixed(2)}%)
              </span>
            </div>
            {i < displayIndices.length - 1 && (
              <Separator orientation="vertical" className="h-4 w-[3px] bg-tv-border/40 mx-2" />
            )}
          </Fragment>
        );
      })}
    </div>
  );
};
