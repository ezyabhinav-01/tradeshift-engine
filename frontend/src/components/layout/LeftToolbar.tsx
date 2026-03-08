
import {
    Crosshair, Minus, GitBranch, Brush, Type,
    Ruler, ZoomIn,
    Magnet, PenTool, Lock, Eye, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const TOOL_GROUPS = [
    [Crosshair, Minus, GitBranch, Brush, Type], // Drawing & Text tools
    [Ruler, ZoomIn],                          // Measurement & Zoom
    [Magnet, PenTool, Lock, Eye, Trash2]      // Utilities
];

const LeftToolbar = () => {

    const ToolButton = ({ icon: Icon, active = false }: { icon: any, active?: boolean; }) => (
        <Button
            variant="ghost"
            className={`w-10 h-10 p-0 rounded-none hover:bg-tv-bg-pane 
        ${active ? 'text-blue-500 bg-tv-bg-pane border-l-2 border-blue-500' : 'text-tv-text-secondary'}
      `}
        >
            <Icon size={20} strokeWidth={1.5} />
        </Button>
    );

    return (
        <div className="w-[52px] border-r border-tv-border bg-tv-bg-base flex flex-col items-center py-2 h-full select-none overflow-y-auto custom-scrollbar">
            {TOOL_GROUPS.map((group, i) => (
                <div key={i} className="flex flex-col w-full items-center mb-2">
                    {group.map((Icon, j) => (
                        <ToolButton key={j} icon={Icon} active={i === 0 && j === 0} />
                    ))}
                    {i < TOOL_GROUPS.length - 1 && <div className="h-[1px] w-6 bg-tv-border my-2" />}
                </div>
            ))}
        </div>
    );
};

export default LeftToolbar;
