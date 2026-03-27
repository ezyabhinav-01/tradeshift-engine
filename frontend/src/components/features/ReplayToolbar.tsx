import { Play, Pause, SkipForward, Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGame } from '../../hooks/useGame';
import { marketDataService } from '../../services/MarketDataService';

const ReplayToolbar = () => {
    const { 
        isReplayActive, toggleReplay, isPlaying, togglePlay, 
        speed, setSpeed, selectedDate, setDate, availableDates 
    } = useGame();

    if (!isReplayActive) return null;

    return (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] flex items-center bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-2xl p-1.5 gap-2 select-none animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Playback Controls */}
            <div className="flex items-center gap-1 border-r border-[#2a2e39] pr-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-[#d1d4dc] hover:bg-white/5"
                    onClick={() => togglePlay()}
                >
                    {isPlaying ? <Pause size={16} className="text-blue-500 fill-blue-500" /> : <Play size={16} />}
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-[#d1d4dc] hover:bg-white/5"
                    onClick={() => {
                        marketDataService.sendMessage({ command: 'STEP' });
                    }}
                    title="Step Forward (1 Tick)"
                >
                    <SkipForward size={16} />
                </Button>
            </div>

            {/* Speed Control */}
            <div className="flex items-center gap-3 border-r border-[#2a2e39] pr-3 ml-1">
                <div className="flex flex-col">
                     <input 
                        type="range" min="1" max="20" step="1" 
                        value={speed} 
                        onChange={(e) => setSpeed(parseFloat(e.target.value))} 
                        className="w-24 h-1.5 bg-[#2a2e39] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                    />
                </div>
                <span className="text-[11px] font-mono text-[#d1d4dc]/60 w-8">{speed}x</span>
            </div>

            {/* Date Selector */}
            <div className="flex items-center gap-2 px-1">
                <Calendar size={14} className="text-[#d1d4dc]/40" />
                <select 
                    className="bg-transparent border-none text-xs font-bold text-[#d1d4dc] outline-none cursor-pointer hover:text-blue-500 transition-colors"
                    value={selectedDate}
                    onChange={(e) => setDate(e.target.value)}
                >
                    {availableDates.map(d => (
                        <option key={d} value={d} className="bg-[#1e222d] text-[#d1d4dc]">{d}</option>
                    ))}
                </select>
            </div>

            {/* Close Button */}
            <div className="w-[1px] h-5 bg-[#2a2e39] mx-1" />
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-[#f23645]/60 hover:text-[#f23645] hover:bg-red-500/10"
                onClick={toggleReplay}
            >
                <X size={16} />
            </Button>
        </div>
    );
};

export default ReplayToolbar;
