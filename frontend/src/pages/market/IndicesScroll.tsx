import React, { useRef, useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';
import LiveValue from '../../components/ui/LiveValue';

interface IndexData {
  name: string;
  symbol?: string;
  price: number;
  change: number;
  change_percent: number;
  is_positive: boolean;
}

interface IndexCardProps {
  idx: IndexData;
}

const IndexCard: React.FC<IndexCardProps> = React.memo(({ idx }) => {
  return (
    <div className="min-w-[260px] md:min-w-[280px] flex-1 flex-shrink-0 snap-start bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 p-5 rounded-lg hover:border-slate-300 dark:hover:border-white/30 transition-all cursor-pointer group shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.03)]">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{idx.name}</h3>
        {idx.is_positive ? (
          <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-500" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-500" />
        )}
      </div>
      <div className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1 tracking-tight font-['Montserrat']">
        <LiveValue value={idx.price} />
      </div>
      <div className={`text-xs font-semibold flex items-center gap-1.5 ${idx.is_positive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
        <span>{idx.is_positive ? '+' : ''}{idx.change}</span>
        <span>({idx.is_positive ? '+' : ''}{idx.change_percent}%)</span>
      </div>
    </div>
  );
});

interface IndicesScrollProps {
  indices: IndexData[];
  isLoading: boolean;
}

const IndicesScroll: React.FC<IndicesScrollProps> = ({ indices, isLoading }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [indices]);

  const scrollByAmount = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group/scroll">
      {canScrollLeft && (
        <button
          onClick={() => scrollByAmount(-300)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -ml-3 lg:-ml-4 z-10 w-10 h-10 flex items-center justify-center bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_rgba(255,255,255,0.05)] text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition-all opacity-0 group-hover/scroll:opacity-100 focus:outline-none"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex overflow-x-auto gap-4 pb-4 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {isLoading && (indices?.length ?? 0) === 0 ? (
          [1, 2, 3, 4].map(i => <div key={i} className="min-w-[260px] md:min-w-[280px] flex-1 flex-shrink-0 snap-start h-28 bg-slate-200 dark:bg-white/5 animate-pulse rounded-lg"></div>)
        ) : (
          indices?.map((idx) => (
            <IndexCard key={idx.symbol || idx.name} idx={idx} />
          ))
        )}
      </div>

      {canScrollRight && (
        <button
          onClick={() => scrollByAmount(300)}
          className="absolute right-0 top-1/2 -translate-y-1/2 -mr-3 lg:-mr-4 z-10 w-10 h-10 flex items-center justify-center bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_rgba(255,255,255,0.05)] text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition-all opacity-0 group-hover/scroll:opacity-100 focus:outline-none"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default React.memo(IndicesScroll);
