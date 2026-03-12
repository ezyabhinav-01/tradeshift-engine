import { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface IndexData {
  name: string;
  price: number;
  change: number;
  change_percent: number;
  is_positive: boolean;
}

export const GlobalTicker = () => {
  const [indices, setIndices] = useState<IndexData[]>([]);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const url = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await axios.get(`${url}/api/market/indices`);
        
        // Filter just NIFTY and SENSEX for the global header
        const core = response.data.filter((idx: any) => 
          idx.name === 'NIFTY 50' || idx.name === 'SENSEX'
        );
        setIndices(core);
      } catch (err) {
        console.error('Failed to fetch ticker data', err);
      }
    };

    fetchIndices();
    const interval = setInterval(fetchIndices, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, []);

  if (indices.length === 0) return null;

  return (
    <div className="hidden lg:flex items-center gap-6 px-4 py-1.5 rounded-full bg-tv-bg-base/60 border border-tv-border/50 shadow-inner ml-4 backdrop-blur-sm">
      {indices.map(idx => (
        <div key={idx.name} className="flex items-center gap-2 text-sm font-mono tracking-tight">
          <span className="text-tv-text-secondary font-sans font-medium text-xs uppercase">{idx.name}</span>
          <span className="text-tv-text-primary font-semibold">{idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span className={`flex items-center text-xs font-medium ${idx.is_positive ? 'text-green-500' : 'text-red-500'}`}>
            {idx.is_positive ? <ArrowUpRight size={14} className="mr-0.5" /> : <ArrowDownRight size={14} className="mr-0.5" />}
            {Math.abs(idx.change_percent).toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
};
