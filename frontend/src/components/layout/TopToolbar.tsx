import { useState } from 'react';
import {
    PlusCircle, BarChart2, LayoutTemplate, LayoutGrid,
    Bell, Rewind, Settings, Maximize, Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SymbolSearchModal } from '../features/SymbolSearchModal';
import { useGame } from '../../hooks/useGame';
import { toast } from 'sonner';

const TopToolbar = () => {
    const { selectedSymbol, isReplayActive, toggleReplay } = useGame();
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    return (
        <div className="h-12 border-b border-tv-border bg-tv-bg-base flex items-center px-4 justify-between text-tv-text-secondary select-none">
            <SymbolSearchModal open={isSearchOpen} onOpenChange={setIsSearchOpen} />

            {/* LEFT CONTROLS */}
            <div className="flex items-center space-x-2 h-full">
                {/* Profile placeholder */}
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-tv-bg-pane/50 text-tv-primary">
                    <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        D
                    </div>
                </Button>

                <Separator orientation="vertical" className="h-6 bg-tv-border" />

                {/* Symbol */}
                <Button
                    variant="ghost"
                    className="h-8 gap-2 px-2 text-tv-text-primary hover:bg-tv-bg-pane/50 font-bold text-lg"
                    onClick={() => setIsSearchOpen(true)}
                >
                    {selectedSymbol || 'USDJPY'}
                </Button>

                <Separator orientation="vertical" className="h-6 bg-tv-border" />

                {/* Compare */}
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-tv-bg-pane/50 hover:text-blue-500" title="Compare" onClick={() => toast.info('Compare tool opening...')}>
                    <PlusCircle size={18} />
                </Button>

                <Separator orientation="vertical" className="h-6 bg-tv-border" />

                {/* Timeframe */}
                <Button variant="ghost" className="h-8 px-2 text-tv-text-primary hover:bg-tv-bg-pane/50 hover:text-blue-500 font-bold" onClick={() => toast.info('Timeframe selector opening...')}>
                    45m
                </Button>

                {/* Chart Type */}
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-tv-bg-pane/50 hover:text-blue-500" onClick={() => toast.info('Chart Type Options...')}>
                    <BarChart2 size={18} className="text-tv-text-primary" />
                </Button>

                <Separator orientation="vertical" className="h-6 bg-tv-border" />

                {/* Indicators */}
                <Button variant="ghost" className="h-8 gap-2 px-2 hover:bg-tv-bg-pane/50 hover:text-blue-500 text-tv-text-primary" onClick={() => toast.info('Indicators Library opening...')}>
                    <LayoutTemplate size={18} />
                    <span className="text-sm font-medium">Indicators</span>
                </Button>

                {/* Templates/Grid */}
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-tv-bg-pane/50 hover:text-blue-500" onClick={() => toast.info('Layout Options...')}>
                    <LayoutGrid size={18} />
                </Button>

                {/* Alert */}
                <Button variant="ghost" className="h-8 gap-2 px-2 hover:bg-tv-bg-pane/50 hover:text-blue-500" onClick={() => toast.success('Create Alert dialog opening...')}>
                    <Bell size={18} />
                    <span className="text-sm">Alert</span>
                </Button>

                {/* Replay */}
                <Button
                    variant="ghost"
                    onClick={toggleReplay}
                    className={`h-8 gap-2 px-2 ml-2 border border-tv-border text-tv-text-primary hover:opacity-90 ${isReplayActive ? 'bg-gradient-to-r from-blue-600/20 to-blue-700/20 text-blue-500 border-blue-500/50' : 'bg-tv-bg-pane'
                        }`}
                >
                    <Rewind size={18} />
                    <span className="text-sm font-bold">Replay</span>
                </Button>
            </div>

            {/* RIGHT CONTROLS */}
            <div className="flex items-center space-x-1 h-full">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-tv-bg-pane/50 hover:text-blue-500" title="Chart Settings" onClick={() => toast.info('Settings opening...')}>
                    <Settings size={18} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-tv-bg-pane/50 hover:text-blue-500" title="Fullscreen" onClick={() => {
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen();
                    } else if (document.exitFullscreen) {
                        document.exitFullscreen();
                    }
                }}>
                    <Maximize size={18} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-tv-bg-pane/50 hover:text-blue-500" title="Take a snapshot" onClick={() => toast.success('Snapshot captured!')}>
                    <Camera size={18} />
                </Button>

                <Button className="h-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-md text-white text-xs px-4 ml-2 rounded font-bold cursor-pointer" onClick={() => toast.success('Ideas Published!')}>
                    Publish
                </Button>
            </div>
        </div>
    );
};

export default TopToolbar;
