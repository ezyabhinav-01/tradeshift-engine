import { useState } from 'react';
import { 
    Bell, Rewind, Settings, Maximize, Camera, Newspaper, SearchCode,
    PlusCircle, BarChart2, LayoutTemplate, Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SymbolSearch } from '../features/SymbolSearch';
import { useGame } from '../../hooks/useGame';
import { useMultiChartStore } from '../../store/useMultiChartStore';
import { toast } from 'sonner';
import { IndicatorTemplateMenu } from '../ProChart/IndicatorTemplateMenu';
import { LayoutSwitcher } from '../ProChart/MultiChartGrid';
import type { IndicatorTemplate } from '../../store/useChartObjects';

interface TopToolbarProps {
    isNewsOpen?: boolean;
    onToggleNews?: () => void;
    isObjectTreeOpen?: boolean;
    onToggleObjectTree?: () => void;
    onToggleIndicators?: () => void;
    onOpenAlerts?: () => void;
    activeIndicatorIds: string[];
    onApplyIndicatorTemplate: (template: IndicatorTemplate) => void;
}

const TopToolbar = ({ 
    isNewsOpen, onToggleNews, isObjectTreeOpen, onToggleObjectTree, 
    onToggleIndicators, onOpenAlerts, activeIndicatorIds, onApplyIndicatorTemplate 
}: TopToolbarProps) => {
    const { selectedSymbol, isReplayActive, toggleReplay } = useGame();
    const { activeChartId, updateChart } = useMultiChartStore();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="h-12 bg-transparent flex items-center px-4 justify-between text-tv-text-secondary select-none">
            <SymbolSearch 
                open={isSearchOpen} 
                onOpenChange={setIsSearchOpen} 
                onSelect={(symbol) => updateChart(activeChartId, { symbol })}
                activeChartId={activeChartId}
            />

            {/* LEFT CONTROLS */}
            <div className="flex items-center space-x-2 h-full">
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
                <Button variant="ghost" className="h-8 gap-2 px-2 hover:bg-tv-bg-pane/50 hover:text-blue-500 text-tv-text-primary" onClick={onToggleIndicators}>
                    <LayoutTemplate size={18} />
                    <span className="text-sm font-medium">Indicators</span>
                </Button>

                {/* Templates Menu */}
                <IndicatorTemplateMenu 
                    activeIndicatorIds={activeIndicatorIds}
                    onApplyTemplate={onApplyIndicatorTemplate}
                />

                {/* Multi-Chart Layout Switcher */}
                <LayoutSwitcher />

                <Separator orientation="vertical" className="h-6 bg-tv-border" />

                {/* Object Tree */}
                <Button variant="ghost" size="icon" className={`h-8 w-8 hover:bg-tv-bg-pane/50 hover:text-blue-500 ${isObjectTreeOpen ? 'text-blue-500 bg-tv-bg-pane/50' : ''}`} onClick={onToggleObjectTree} title="Object Tree">
                    <Layers size={18} />
                </Button>

                {/* Alert */}
                <Button variant="ghost" className="h-8 gap-2 px-2 hover:bg-tv-bg-pane/50 hover:text-blue-500" onClick={onOpenAlerts}>
                    <Bell size={18} />
                    <span className="text-sm">Alert</span>
                </Button>

                {/* Replay & Status Indicator */}
                <div className="flex items-center gap-2 ml-2">
                    <Button
                        variant="ghost"
                        onClick={toggleReplay}
                        className={`h-8 gap-2 px-2 border border-tv-border text-tv-text-primary hover:opacity-90 ${isReplayActive ? 'bg-gradient-to-r from-blue-600/20 to-blue-700/20 text-blue-500 border-blue-500/50' : 'bg-tv-bg-pane'
                            }`}
                    >
                        <Rewind size={18} />
                        <span className="text-sm font-bold">Replay</span>
                    </Button>

                    <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                        isReplayActive 
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' 
                        : 'bg-green-500/10 border-green-500/30 text-green-500'
                    }`}>
                        {isReplayActive ? 'Simulation' : 'Live Mode'}
                    </div>

                </div>
            </div>

            {/* RIGHT CONTROLS */}
            <div className="flex items-center space-x-1 h-full">
                {/* News Panel Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 hover:bg-tv-bg-pane/50 hover:text-blue-500 ${isNewsOpen ? 'text-blue-500 bg-tv-bg-pane/50' : ''}`}
                    title="News AI Panel"
                    onClick={onToggleNews}
                >
                    <Newspaper size={18} />
                </Button>

                {/* Research Hub Link */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-tv-bg-pane/50 hover:text-primary"
                    title="Stock Research Hub (FinGPT)"
                    onClick={() => navigate(`/research/${selectedSymbol || 'RELIANCE'}`)}
                >
                    <SearchCode size={18} />
                </Button>

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
