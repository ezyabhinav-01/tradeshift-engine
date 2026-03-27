import { useEffect, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useGame } from '../../hooks/useGame';
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
  const { isPlaying, simulatedIndices, setSymbol } = useGame();
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

  // Decide which data source to render and map exactly to the 5 requested symbols
  const sourceData = isPlaying ? simulatedIndices : liveIndices;
  const targetSymbols = [
    { searchName: 'NIFTY', displayName: 'NIFTY', exactMatches: ['NIFTY', 'NIFTY 50'] },
    { searchName: 'BANKNIFTY', displayName: 'BANKNIFTY', exactMatches: ['BANKNIFTY'] },
    { searchName: 'SENSEX', displayName: 'SENSEX', exactMatches: ['SENSEX', 'BSE SENSEX'] },
    { searchName: 'HDFCBANK', displayName: 'HDFCBANK', exactMatches: ['HDFCBANK'] },
    { searchName: 'RELIANCE', displayName: 'RELIANCE', exactMatches: ['RELIANCE'] }
  ];

  const displayIndices: IndexData[] = targetSymbols.map(target => {
    const found = sourceData.find(idx => 
      target.exactMatches.includes(idx.name?.toUpperCase()) ||
      target.exactMatches.includes((idx as any).symbol?.toUpperCase())
    );

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
    <div className="flex items-center gap-4 px-4 overflow-x-auto whitespace-nowrap hide-scrollbar text-[13px] font-sans">
      
      {isPlaying && (
        <>
          <div className="flex items-center text-xs font-bold text-indigo-400 gap-1.5 animate-pulse shrink-0">
              <span>SIM SYNC</span>
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
