import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import ChartArea from '../components/features/ChartArea';
import NewsPanel from '../components/features/NewsPanel';
import TopToolbar from '../components/layout/TopToolbar';
import LeftToolbar from '../components/layout/LeftToolbar';

const Home = () => {
  const [isNewsOpen, setIsNewsOpen] = useState(false);

  return (
    <div className="flex flex-col h-full w-full bg-tv-bg-base text-tv-text-primary overflow-hidden font-sans">
      {/* TOP TOOLBAR */}
      <TopToolbar isNewsOpen={isNewsOpen} onToggleNews={() => setIsNewsOpen(prev => !prev)} />

      <div className="flex flex-1 min-h-0 relative">
        {/* LEFT TOOLBAR */}
        <LeftToolbar />

        {/* CENTER CHART AREA */}
        <div className="flex-1 relative bg-tv-bg-base pb-7">
          <ChartArea />
        </div>

        {/* RIGHT NEWS PANEL (Toggleable) */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${isNewsOpen ? 'w-80 border-l border-tv-border' : 'w-0'}`}>
          {isNewsOpen && <div className="w-80 h-full"><NewsPanel /></div>}
        </div>
      </div>

      {/* BOTTOM FOOTER */}
      <div className="h-8 border-t border-tv-border bg-tv-bg-base flex items-center justify-between px-4 text-xs font-semibold text-tv-text-secondary select-none flex-shrink-0">
        {/* Bottom Left: Ranges */}
        <div className="flex items-center space-x-3">
          {['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'].map((range) => (
            <span key={range} className="hover:text-blue-500 cursor-pointer transition-colors px-1">
              {range}
            </span>
          ))}
          <CalendarRange size={14} className="cursor-pointer hover:text-tv-text-primary ml-2" />
        </div>

        {/* Bottom Right: Time Info */}
        <div className="flex items-center space-x-4 pr-1">
          <span className="hover:text-tv-text-primary cursor-pointer">Replay Trading</span>
          <span className="text-tv-text-primary border-b-2 border-blue-500 pb-[6px] cursor-pointer font-bold">Trade</span>
          <span className="ml-4 tabular-nums">{new Date().toLocaleTimeString()} UTC+5:30</span>
        </div>
      </div>
    </div>
  );
};

export default Home;