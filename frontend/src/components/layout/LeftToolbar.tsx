import {
  Crosshair, Minus, TrendingUp, MoveVertical,
  GitBranch,
  Hash, Triangle, Waves,
  Square, Circle, ArrowUpRight, Paintbrush, Type,
  Ruler, ZoomIn,
  Magnet, Lock, Eye, Trash2, Library
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DrawingToolId } from '../../hooks/useDrawingTools';

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

const UTILITY_TOOLS = [
  { icon: Magnet, title: 'Magnet Mode', action: 'magnet' },
  { icon: Lock,   title: 'Lock Drawings', action: 'lock' },
  { icon: Eye,    title: 'Show/Hide Drawings', action: 'visibility' },
  { icon: Library, title: 'Template Library', action: 'library' },
  { icon: Trash2, title: 'Clear All Drawings', action: 'clear' },
];

const LeftToolbar = ({ activeTool, onSelectTool, onClearAll, onToggleLibrary }: LeftToolbarProps) => {
  const isActive = (id: DrawingToolId) => {
    if (id === 'cursor') return activeTool === null || activeTool === 'cursor';
    return activeTool === id;
  };

  return (
    <div className="w-[52px] border-r border-tv-border bg-tv-bg-base flex flex-col items-center py-2 h-full select-none overflow-y-auto custom-scrollbar justify-between">
      {/* Main tools */}
      <div className="flex flex-col w-full items-center">
        {TOOL_SECTIONS.map((section, si) => (
          <div key={si} className="flex flex-col w-full items-center">
            {section.separator && <div className="h-[1px] w-6 bg-tv-border my-1.5" />}
            {section.tools.map((tool) => (
              <Button
                key={tool.id ?? tool.title}
                variant="ghost"
                title={tool.title}
                onClick={() => onSelectTool(tool.id)}
                className={`w-10 h-10 p-0 rounded-none hover:bg-tv-bg-pane ${
                  isActive(tool.id)
                    ? 'text-blue-500 bg-tv-bg-pane border-l-2 border-blue-500'
                    : 'text-tv-text-secondary'
                }`}
              >
                <tool.icon size={20} strokeWidth={1.5} />
              </Button>
      ))}
    </div>
  ))
}
      </div >

  {/* Utilities — bottom */ }
  < div className = "flex flex-col w-full items-center" >
    <div className="h-[1px] w-6 bg-tv-border my-1.5" />
{
  UTILITY_TOOLS.map((util) => (
    <Button
      key={util.action}
      variant="ghost"
      title={util.title}
      onClick={() => {
        if (util.action === 'clear') onClearAll();
        if (util.action === 'library') onToggleLibrary();
      }}
      className="w-10 h-10 p-0 rounded-none hover:bg-tv-bg-pane text-tv-text-secondary"
    >
      <util.icon size={20} strokeWidth={1.5} />
    </Button>
  ))
}
      </div >
    </div >
  );
};

export default LeftToolbar;
