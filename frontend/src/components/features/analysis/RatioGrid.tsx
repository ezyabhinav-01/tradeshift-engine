import React from 'react';
import {
  TrendingUp,
  Wind,
  Percent,
  Coins,
  ArrowDownCircle,
  BarChart,
  Scale,
  ShieldCheck
} from 'lucide-react';

interface RatioGridProps {
  data: any;
  isLaymanMode: boolean;
}

const RatioCard: React.FC<{ label: string; value: string | number; icon: any; laymanLabel: string; laymanExplainer: string; isLaymanMode: boolean }> = React.memo(({
  label, value, icon: Icon, laymanLabel, laymanExplainer, isLaymanMode
}) => {
  return (
    <div className="bg-white dark:bg-[#0a0a0a] p-5 rounded-2xl border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-primary/20 transition-all group relative overflow-hidden shadow-sm hover:shadow-lg dark:shadow-none dark:hover:shadow-none">
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors"></div>

      <div className="flex justify-between items-start mb-3">
        <div className="p-2.5 bg-gray-100 dark:bg-white/5 rounded-xl text-gray-500 dark:text-gray-400 group-hover:text-primary dark:group-hover:text-primary transition-colors">
          <Icon className="w-5 h-5" />
        </div>
        {isLaymanMode && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-green-600 dark:text-green-500 bg-green-100 dark:bg-green-500/10 px-2 py-0.5 rounded-full">
            Simplified
          </span>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider">
          {isLaymanMode ? laymanLabel : label}
        </p>
        <p className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
          {typeof value === 'number' && label.includes('Ratio') ? value.toFixed(2) : value}
          {label.includes('RO') || label.includes('Growth') || label.includes('Yield') ? '%' : ''}
        </p>
      </div>

      {isLaymanMode && (
        <p className="mt-3 text-[11px] text-gray-600 dark:text-gray-500 leading-relaxed italic">
          "{laymanExplainer}"
        </p>
      )}
    </div>
  );
});

const RatioGrid: React.FC<RatioGridProps> = React.memo(({ data, isLaymanMode }) => {
  if (!data) return null;

  const ratios = [
    {
      label: "Stock P/E",
      value: data.pe_ratio,
      icon: TrendingUp,
      laymanLabel: "Popularity Meter",
      laymanExplainer: "How much extra people pay just to own this stock compared to its profit."
    },
    {
      label: "ROCE",
      value: data.roce,
      icon: Wind,
      laymanLabel: "Money Efficiency",
      laymanExplainer: "For every $100 the company spends, how many dollars it actually brings home."
    },
    {
      label: "Debt to Equity",
      value: data.debt_to_equity,
      icon: Scale,
      laymanLabel: "Loan Burden",
      laymanExplainer: "Does the company own more than it owes? Lower is safer."
    },
    {
      label: "Market Cap",
      value: `₹${(data.market_cap / 1000).toFixed(1)}T`,
      icon: Coins,
      laymanLabel: "Total Size",
      laymanExplainer: "The total price tag to buy the whole company today."
    },
    {
      label: "Div Yield",
      value: data.dividend_yield,
      icon: ArrowDownCircle,
      laymanLabel: "Yearly Pocket Money",
      laymanExplainer: "The cash rewards the company gives you just for holding the stock."
    },
    {
      label: "Prof Growth 5Y",
      value: data.profit_growth_5y,
      icon: ShieldCheck,
      laymanLabel: "Success Streak",
      laymanExplainer: "How much more money they kept in their pocket over the last 5 years."
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {ratios.map((ratio, idx) => (
        <RatioCard key={idx} {...ratio} isLaymanMode={isLaymanMode} />
      ))}
    </div>
  );
});

export default RatioGrid;
