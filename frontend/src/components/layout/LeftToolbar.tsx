import {
  Crosshair, Minus, TrendingUp, MoveVertical,
  GitBranch,
  Hash, Triangle, Waves,
  Square, Circle, ArrowUpRight, Paintbrush, Type,
  Ruler, ZoomIn,
  Trash2, Library
} from 'lucide-react';
import type { DrawingToolId } from '../../hooks/useDrawingTools';
import { Button } from '../ui/button';
import React from 'react';

interface LeftToolbarProps {
  activeTool: DrawingToolId;
  onSelectTool: (tool: DrawingToolId) => void;
  onClearAll: () => void;
  onToggleLibrary: () => void;
}

interface ToolDef {
  id: DrawingToolId;
  icon: any;
  title: string;
}

const TOOL_SECTIONS: { tools: ToolDef[]; separator?: boolean }[] = [
  {
    tools: [
      { id: 'cursor', icon: Crosshair, title: 'Cursor' },
    ],
  },
  {
    separator: true,
    tools: [
      { id: 'hline',     icon: Minus,        title: 'Horizontal Line' },
      { id: 'vline',     icon: MoveVertical,  title: 'Vertical Line' },
      { id: 'trendline', icon: TrendingUp,    title: 'Trend Line' },
      { id: 'ray',       icon: GitBranch,     title: 'Ray' },
    ],
  },
  {
    separator: true,
    tools: [
      { id: 'fibonacci', icon: Hash,     title: 'Fibonacci Retracement' },
      { id: 'fib_fan',   icon: Triangle, title: 'Fibonacci Fan' },
      { id: 'fib_ext',   icon: Waves,    title: 'Fibonacci Extension' },
    ],
  },
  {
    separator: true,
    tools: [
      { id: 'rectangle', icon: Square,       title: 'Rectangle' },
      { id: 'circle',    icon: Circle,       title: 'Circle / Ellipse' },
      { id: 'arrow',     icon: ArrowUpRight,  title: 'Arrow' },
      { id: 'brush',     icon: Paintbrush,    title: 'Brush' },
      { id: 'text',      icon: Type,          title: 'Text Label' },
    ],
  },
  {
    separator: true,
    tools: [
      { id: 'ruler', icon: Ruler,  title: 'Measure / Ruler' },
      { id: null,    icon: ZoomIn, title: 'Zoom In' },
    ],
  },
];

const LeftToolbar: React.FC<LeftToolbarProps> = ({ activeTool, onSelectTool, onClearAll, onToggleLibrary }) => {

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
        <div className="w-[52px] bg-tv-bg-base flex flex-col items-center py-2 h-full select-none overflow-y-auto custom-scrollbar border-r border-tv-border">
            {TOOL_SECTIONS.map((section, i) => (
                <div key={i} className="flex flex-col w-full items-center">
                    {section.tools.map((tool, j) => (
                        <div key={tool.id || j} title={tool.title} onClick={() => tool.id && onSelectTool(tool.id)}>
                            <ToolButton 
                                icon={tool.icon} 
                                active={activeTool === tool.id} 
                            />
                        </div>
                    ))}
                    {i < TOOL_SECTIONS.length - 1 && <div className="h-[1px] w-6 bg-tv-border my-2" />}
                </div>
            ))}
            
            <div className="mt-auto flex flex-col items-center gap-2 mb-2">
                <div onClick={onToggleLibrary}>
                    <ToolButton icon={Library} />
                </div>
                <div onClick={onClearAll}>
                    <ToolButton icon={Trash2} />
                </div>
            </div>
        </div>
    );
};

export default LeftToolbar;
