import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '../../components/ui/button';
import LiveValue from '../../components/ui/LiveValue';

interface MoverData {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  is_positive: boolean;
}

interface MoversTableProps {
  title: string;
  data: MoverData[];
  type: 'gainers' | 'losers';
  isLoading: boolean;
  onNavigate: (symbol: string) => void;
}

const MoversTable: React.FC<MoversTableProps> = ({ title, data, type, isLoading, onNavigate }) => {
  const Icon = type === 'gainers' ? TrendingUp : TrendingDown;
  const colorClass = type === 'gainers' ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
  const bgClass = type === 'gainers' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-500' : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500';
  const borderClass = type === 'gainers' ? 'border-green-200 dark:border-green-500/20' : 'border-red-200 dark:border-red-500/20';

  return (
    <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.03)]">
      <div className="p-5 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/[0.02]">
        <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
          <Icon className={`w-4 h-4 ${colorClass}`} />
          {title}
        </h3>
        <Button variant="ghost" size="sm" className="text-[10px] text-slate-500 hover:text-slate-800 dark:text-gray-500 dark:hover:text-white border-0">View All</Button>
      </div>
      <div className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] uppercase font-semibold text-slate-500 dark:text-gray-600 bg-slate-100/50 dark:bg-white/[0.01]">
            <tr>
              <th className="py-3 px-5 font-medium tracking-wider">Company</th>
              <th className="py-3 px-5 font-medium tracking-wider text-right">Price</th>
              <th className="py-3 px-5 font-medium tracking-wider text-right">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {data?.slice(0, 5).map((stock) => (
              <tr
                key={stock.symbol}
                onClick={() => onNavigate(stock.symbol)}
                className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <td className="py-4 px-5">
                  <div className={`font-semibold text-slate-800 dark:text-gray-300 group-hover:${colorClass} transition-colors`}>{stock.symbol}</div>
                  <div className={`text-[10px] text-slate-500 dark:text-gray-600 truncate max-w-[120px] group-hover:${type === 'gainers' ? 'text-green-600/70 dark:text-green-500/70' : 'text-red-600/70 dark:text-red-500/70'} transition-colors`}>
                    Vol: {new Intl.NumberFormat('en-IN').format(stock.volume)}
                  </div>
                </td>
                <td className={`py-4 px-5 text-right font-medium text-slate-900 dark:text-white group-hover:${colorClass} transition-colors`}>
                  ₹<LiveValue value={stock.price} />
                </td>
                <td className="py-4 px-5 text-right">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${bgClass} text-xs font-semibold border ${borderClass}`}>
                    {type === 'gainers' ? '+' : ''}{stock.change_percent}%
                  </span>
                </td>
              </tr>
            ))}
            {(data?.length ?? 0) === 0 && !isLoading && (
              <tr><td colSpan={3} className="py-8 text-center text-slate-500 dark:text-gray-500 text-xs">No data available. Market might be closed.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default React.memo(MoversTable);
