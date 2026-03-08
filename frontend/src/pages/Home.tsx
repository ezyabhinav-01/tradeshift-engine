import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import type { Page } from '../components/layout/Sidebar';
import ChartArea from '../components/features/ChartArea';
import HistoryPage from './HistoryPage';
import SettingsPage from './SettingsPage';
import TopToolbar from '../components/layout/TopToolbar';
import LeftToolbar from '../components/layout/LeftToolbar';
import { Button } from '@/components/ui/button';

const Home = () => {
  const [page, setPage] = useState<Page>('terminal');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-tv-bg-base text-tv-text-primary overflow-hidden font-sans">
      {/* Sidebar Toggle Button (Visible when sidebar is closed) */}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 z-50 transition-all duration-300 ${isSidebarOpen ? 'translate-x-20' : 'translate-x-0'}`}>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-4 rounded-r-md rounded-l-none bg-tv-bg-pane border-y border-r border-tv-border shadow-md hover:bg-tv-bg-pane/80 text-tv-text-secondary"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </Button>
      </div>

      {/* Main Sidebar (Collapsible) */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden border-r border-tv-border bg-tv-bg-pane
          ${isSidebarOpen ? 'w-20 opacity-100' : 'w-0 opacity-0 border-none'}
       `}>
        <Sidebar page={page} setPage={setPage} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <main className="flex-1 relative flex flex-col overflow-hidden">
          {page === 'terminal' && (
            <div className="flex flex-col h-full w-full">
              {/* TOP TOOLBAR */}
              <TopToolbar />

              <div className="flex flex-1 min-h-0 relative">
                {/* LEFT TOOLBAR */}
                <LeftToolbar />

                {/* CENTER CHART AREA */}
                <div className="flex-1 relative bg-tv-bg-base pb-7">
                  <ChartArea />
                </div>
              </div>

              {/* BOTTOM FOOTER */}
              <div className="h-8 border-t border-tv-border bg-tv-bg-base flex items-center justify-between px-4 text-xs font-semibold text-tv-text-secondary select-none">
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
                  <span className="ml-4 tabular-nums">20:48:32 UTC+5:30</span>
                </div>
              </div>
            </div>
          )}

          {page === 'history' && (
            <div className="flex-1 overflow-auto bg-tv-bg-base p-6">
              <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-6 text-tv-text-primary">Trade History</h1>
                <div className="rounded-xl border border-tv-border bg-tv-bg-pane shadow-sm overflow-hidden">
                  <HistoryPage />
                </div>
              </div>
            </div>
          )}

          {page === 'settings' && (
            <div className="flex-1 overflow-auto bg-tv-bg-base p-6">
              <div className="max-w-4xl mx-auto">
                <SettingsPage />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Home;