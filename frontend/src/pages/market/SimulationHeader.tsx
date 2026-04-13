import React from 'react';
import { Clock, RefreshCw, Search } from 'lucide-react';
import { useGamePlayback } from '../../hooks/useGame';

interface SimulationHeaderProps {
  isLoading: boolean;
  isRefreshing: boolean;
  isLiveWsConnected: boolean;
  lastRefreshed: Date;
  onRefresh: () => void;
}

const SimulationHeader: React.FC<SimulationHeaderProps> = ({ 
  isLoading, 
  isRefreshing, 
  isLiveWsConnected, 
  lastRefreshed, 
  onRefresh 
}) => {
  const { isPlaying, currentTime } = useGamePlayback();

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-xl backdrop-blur-md">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1 font-['Montserrat']">Markets Overview</h1>
        <div className="flex items-center gap-2 text-xs font-medium mt-2">
          {isPlaying ? (
            <>
              <span className="flex items-center gap-1.5 px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-md border border-indigo-200 dark:border-indigo-500/20">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                SIMULATION SYNC: {currentTime?.toLocaleTimeString() ?? 'Loading...'}
              </span>
              <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-500/20">
                Simulated Indices Active
              </span>
            </>
          ) : (
            <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${isLiveWsConnected ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-500 dark:border-green-500/20' : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-500 dark:border-yellow-500/20'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveWsConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
              {isLiveWsConnected ? 'Live Data Connected' : 'Connecting Live...'}
            </span>
          )}

          <span className="text-slate-400 dark:text-gray-600">•</span>
          <span className="text-slate-500 dark:text-gray-500">Last REST sync: {lastRefreshed.toLocaleTimeString()}</span>
          <button onClick={onRefresh} className="ml-2 text-slate-500 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white transition-colors" title="Sync REST Data">
            <RefreshCw className={`w-3.5 h-3.5 ${(isLoading || isRefreshing) ? 'animate-spin text-blue-600 dark:text-primary' : ''}`} />
          </button>
        </div>
      </div>

      <div className="relative w-full md:w-72">
        <input
          type="text"
          placeholder="Search stocks, indices, mutual funds..."
          className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-primary/50 transition-all placeholder:text-slate-500 dark:placeholder:text-gray-600"
        />
        <Search className="w-4 h-4 text-slate-400 dark:text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
};

export default React.memo(SimulationHeader);
