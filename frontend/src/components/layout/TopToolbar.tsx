import { useState, useRef, useEffect } from 'react';
import { 
    Bell, Rewind, Newspaper, SearchCode,
    PlusCircle, LayoutTemplate, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SymbolSearch } from '../features/SymbolSearch';
import { useGame } from '../../hooks/useGame';
import { useMultiChartStore } from '../../store/useMultiChartStore';
import type { TimeframeId } from '../../store/useMultiChartStore';
import { toast } from 'sonner';
import { IndicatorTemplateMenu } from '../ProChart/IndicatorTemplateMenu';
import { LayoutSwitcher } from '../ProChart/MultiChartGrid';
import type { IndicatorTemplate } from '../../store/useChartObjects';
import { useAccessControl } from '../../hooks/useAccessControl';

const TIMEFRAMES: { id: TimeframeId; label: string; shortLabel: string }[] = [
    { id: '1min',  label: '1 Minute',   shortLabel: '1m' },
    { id: '3min',  label: '3 Minutes',  shortLabel: '3m' },
    { id: '5min',  label: '5 Minutes',  shortLabel: '5m' },
    { id: '15min', label: '15 Minutes', shortLabel: '15m' },
    { id: '30min', label: '30 Minutes', shortLabel: '30m' },
    { id: '1hr',   label: '1 Hour',     shortLabel: '1H' },
];

interface TopToolbarProps {
    isNewsOpen?: boolean;
    onToggleNews?: () => void;
    isObjectTreeOpen?: boolean;
    onToggleObjectTree?: () => void;
    onToggleIndicators?: () => void;
    onOpenAlerts?: () => void;
    activeIndicatorIds: string[];
    onApplyIndicatorTemplate: (template: IndicatorTemplate) => void;
    isGuest?: boolean;
}

const TopToolbar = ({ 
    isNewsOpen, onToggleNews, 
    onToggleIndicators, onOpenAlerts, activeIndicatorIds, onApplyIndicatorTemplate,
    isGuest
}: TopToolbarProps) => {
    const { selectedSymbol, isReplayActive, toggleReplay } = useGame();
    const { activeChartId, updateChart, activeTimeframe, setActiveTimeframe } = useMultiChartStore();
    const { checkAccess } = useAccessControl();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isTimeframeOpen, setIsTimeframeOpen] = useState(false);
    const timeframeRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Close timeframe dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (timeframeRef.current && !timeframeRef.current.contains(e.target as Node)) {
                setIsTimeframeOpen(false);
            }
        };
        if (isTimeframeOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isTimeframeOpen]);

    const currentTf = TIMEFRAMES.find(t => t.id === activeTimeframe);

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

                <Separator orientation="vertical" className="h-6 bg-tv-border dark:bg-white/10" />

                {/* Compare */}
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-tv-bg-pane/50 hover:text-blue-500" title="Compare" onClick={() => toast.info('Compare tool opening...')}>
                    <PlusCircle size={18} />
                </Button>

                <Separator orientation="vertical" className="h-6 bg-tv-border" />

                {/* Timeframe Dropdown */}
                <div className="relative" ref={timeframeRef}>
                    <Button
                        variant="ghost"
                        className={`h-8 px-2 gap-1 font-bold transition-all duration-150 ${
                            isTimeframeOpen
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : 'text-tv-text-primary hover:bg-tv-bg-pane/50 hover:text-blue-500'
                        }`}
                        onClick={() => setIsTimeframeOpen(!isTimeframeOpen)}
                    >
                        {currentTf?.shortLabel || activeTimeframe}
                        <ChevronDown size={12} className={`transition-transform duration-200 ${isTimeframeOpen ? 'rotate-180' : ''}`} />
                    </Button>

                    {isTimeframeOpen && (
                        <div className="absolute top-full left-0 mt-1 z-[200] bg-[#1a1a2e] border border-white/10 rounded-lg shadow-2xl shadow-black/60 overflow-hidden min-w-[160px] animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="py-1">
                                {TIMEFRAMES.map((tf) => (
                                    <button
                                        key={tf.id}
                                        onClick={() => {
                                            setActiveTimeframe(tf.id);
                                            setIsTimeframeOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-all duration-100 ${
                                            activeTimeframe === tf.id
                                                ? 'bg-blue-500/15 text-blue-400'
                                                : 'text-white/70 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        <span className="font-bold tracking-wide">{tf.shortLabel}</span>
                                        <span className="text-[10px] opacity-50 font-medium">{tf.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

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
                <div className={isGuest ? "opacity-30 pointer-events-none filter grayscale" : ""}>
                    <LayoutSwitcher />
                </div>

                <Separator orientation="vertical" className="h-6 bg-tv-border" />

                {/* Alert */}
                <Button variant="ghost" className="h-8 gap-2 px-2 hover:bg-tv-bg-pane/50 hover:text-blue-500" onClick={onOpenAlerts}>
                    <Bell size={18} />
                    <span className="text-sm">Alert</span>
                </Button>

                {/* Replay & Status Indicator */}
                <div className="flex items-center gap-2 ml-2">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            if (checkAccess()) toggleReplay();
                        }}
                        className={`h-8 gap-2 px-2 border border-tv-border text-tv-text-primary hover:opacity-90 ${isReplayActive ? 'bg-gradient-to-r from-blue-600/20 to-blue-700/20 text-blue-500 border-blue-500/50' : 'bg-tv-bg-pane'
                            } ${isGuest ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                        <Rewind size={18} />
                        <span className="text-sm font-bold">Replay</span>
                    </Button>
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
                    onClick={() => {
                        if (checkAccess()) navigate(`/research/${selectedSymbol || 'RELIANCE'}`);
                    }}
                >
                    <SearchCode size={18} />
                </Button>

                <Button className="h-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-md text-white text-xs px-4 ml-2 rounded font-bold cursor-pointer" onClick={() => toast.success('Ideas Published!')}>
                    Publish
                </Button>
            </div>
        </div>
    );
};

export default TopToolbar;
