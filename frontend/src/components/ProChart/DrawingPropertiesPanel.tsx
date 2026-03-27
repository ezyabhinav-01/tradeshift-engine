import React, { useState, useEffect, useRef } from 'react';
import { Settings, Lock, Unlock, Trash2, MoreHorizontal, GripVertical, AlarmClock, EyeOff, Copy, Layers, Type, Bold, Italic } from 'lucide-react';
import type { DrawingToolsManager } from '@pipsend/charts';
import { DrawingAlertModal } from './DrawingAlertModal';
import { DrawingSettingsModal } from './DrawingSettingsModal';

const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div 
      className="relative flex items-center justify-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute bottom-full mb-2 px-2 py-1 bg-gray-900 border border-gray-700 text-white text-[10px] rounded shadow-lg whitespace-nowrap z-[100] font-medium leading-tight pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-solid border-t-gray-900 border-t-4 border-x-transparent border-x-4 border-b-0"></div>
        </div>
      )}
    </div>
  );
};

interface DrawingPropertiesPanelProps {
  selectedToolId: string | null;
  managerRef: React.MutableRefObject<DrawingToolsManager | null>;
  onDeleteSelected: () => void;
  onClone?: (id: string) => void;
  onHide?: (id: string) => void;
}

const LINE_WIDTHS = [1, 2, 3, 4] as const;
const LINE_STYLES = [
  { id: 'solid', label: 'Line' },
  { id: 'dashed', label: 'Dashed line' },
  { id: 'dotted', label: 'Dotted line' }
] as const;

export const DrawingPropertiesPanel: React.FC<DrawingPropertiesPanelProps> = ({
  selectedToolId,
  managerRef,
  onDeleteSelected,
  onClone,
  onHide,
}) => {
  const [color, setColor] = useState('#2962FF');
  const [lineWidth, setLineWidth] = useState<number>(2);
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  // Text states
  const [text, setText] = useState('');
  const [textColor, setTextColor] = useState('#2962FF');
  const [fontSize, setFontSize] = useState(14);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [textOrientation, setTextOrientation] = useState('parallel');
  const [textPosition, setTextPosition] = useState('top');

  const [activeMenu, setActiveMenu] = useState<'color' | 'width' | 'style' | 'more' | 'text' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (dragStartRef.current) {
        setPosition({
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y
        });
      }
    };
    const handleDragEnd = () => {
      dragStartRef.current = null;
    };
    
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, []);

  useEffect(() => {
    setIsOpen(!!selectedToolId);
    if (!selectedToolId) {
      setActiveMenu(null);
    }
  }, [selectedToolId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync tool properties when selection changes
  useEffect(() => {
    if (selectedToolId && managerRef.current) {
      try {
        const tools = managerRef.current.getAllTools() as any;
        const tool = tools instanceof Map ? tools.get(selectedToolId) : tools.find?.((t: any) => t.id === selectedToolId);
        
        if (tool) {
          let options: any = null;
          if (tool.options) options = typeof tool.options === 'function' ? tool.options() : tool.options;
          if (!options && (tool as any)._options) options = (tool as any)._options;

          if (options) {
            if (options.lineColor || options.color) setColor(options.lineColor || options.color);
            if (options.lineWidth) setLineWidth(options.lineWidth);
            if (options.lineStyle) setLineStyle(options.lineStyle as any);
            if (options.text !== undefined) setText(options.text || '');
            if (options.textColor) setTextColor(options.textColor);
            if (options.fontSize) setFontSize(Number(options.fontSize));
            if (options.bold !== undefined) setIsBold(!!options.bold);
            if (options.italic !== undefined) setIsItalic(!!options.italic);
            if (options.textOrientation) setTextOrientation(options.textOrientation);
            if (options.textPosition) setTextPosition(options.textPosition);
          }
        }
      } catch (e) {
        console.warn('Sync tool props failed', e);
      }
      if (managerRef.current && selectedToolId) {
        const tools = managerRef.current.getAllTools();
        const tool = (tools as any).get ? (tools as any).get(selectedToolId) : (tools as any)[selectedToolId];
        
        if (tool) {
          const options = tool.getOptions ? tool.getOptions() : tool.options;
          if (options) {
            setColor(options.lineColor || options.color || '#2962FF');
            setLineWidth(options.lineWidth || 2);
            setLineStyle(options.lineStyle || 'solid');
            setIsLocked(options.locked || false);
            
            if (options.text !== undefined) setText(options.text);
            if (options.textColor) setTextColor(options.textColor);
            if (options.fontSize) setFontSize(options.fontSize);
            if (options.bold !== undefined) setIsBold(options.bold);
            if (options.italic !== undefined) setIsItalic(options.italic);
          }
        }
      }
    }
  }, [selectedToolId, managerRef]);



  if (!isOpen || !selectedToolId) return null;

  const applyOption = (key: string, value: any) => {
    try {
      if (!managerRef.current) return;
      const tools = managerRef.current.getAllTools() as any;
      const tool = tools instanceof Map ? tools.get(selectedToolId) : tools.find?.((t: any) => t.id === selectedToolId);
      
      if (tool) {
        // 1. Manually update all objects on the tool that look like options (robust for mangled code)
        Object.keys(tool).forEach(k => {
          const obj = (tool as any)[k];
          if (typeof obj === 'object' && obj !== null) {
            // Heuristic: If the inner object contains drawing properties, it is the options object
            if ('lineColor' in obj || 'lineWidth' in obj || 'color' in obj || 'price' in obj || 'time' in obj) {
              obj[key] = value;
            }
          }
        });
        
        // 2. Also try the official way (wrapped in try-catch because it crashes in @pipsend/charts)
        try {
          if (typeof (tool as any).applyOptions === 'function') {
            (tool as any).applyOptions({ [key]: value });
          }
        } catch (_) {}

        // 3. Force a redraw using the safest method found in @pipsend/charts
        if (typeof (tool as any)._private__requestUpdate === 'function') {
          (tool as any)._private__requestUpdate();
        } else if (typeof (tool as any)._requestUpdate === 'function') {
          (tool as any)._requestUpdate();
        } else if (typeof (tool as any)._update === 'function') {
          try { (tool as any)._update(); } catch (_) {}
        }
      }
    } catch (e) {
      console.error('Failed to apply drawing option:', e);
    }
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    applyOption('color', newColor);
    applyOption('lineColor', newColor);
    setActiveMenu(null);
  };

  const handleWidthChange = (w: number) => {
    setLineWidth(w);
    applyOption('lineWidth', w);
    setActiveMenu(null);
  };

  const handleStyleChange = (s: 'solid' | 'dashed' | 'dotted') => {
    setLineStyle(s);
    applyOption('lineStyle', s);
    setActiveMenu(null);
  };

  const handleTextChange = (val: string) => {
    setText(val);
    applyOption('text', val);
  };

  const handleTextColorChange = (c: string) => {
    setTextColor(c);
    applyOption('textColor', c);
  };

  const handleFontSizeChange = (fs: number) => {
    setFontSize(fs);
    applyOption('fontSize', fs);
  };

  const toggleBold = () => {
    const newVal = !isBold;
    setIsBold(newVal);
    applyOption('bold', newVal);
  };

  const toggleItalic = () => {
    const newVal = !isItalic;
    setIsItalic(newVal);
    applyOption('italic', newVal);
  };

  const handleOrientationChange = (val: string) => {
    setTextOrientation(val);
    applyOption('textOrientation', val);
  };

  const handlePositionChange = (val: string) => {
    setTextPosition(val);
    applyOption('textPosition', val);
  };

  const PRESET_COLORS = [
    '#ffffff', '#e0e3eb', '#b2b5be', '#787b86', '#434651', '#131722', '#000000',
    '#f23645', '#ff9800', '#ffeb3b', '#4caf50', '#089981', '#00bcd4', '#2962ff', '#673ab7', '#e91e63',
    '#ffcdd2', '#ffe0b2', '#fff9c4', '#c8e6c9', '#b2dfdb', '#b2ebf2', '#bbdefb', '#d1c4e9', '#f8bbd0'
  ];

  return (
    <>
      <div 
        className="absolute top-20 left-1/2 z-50 flex items-center bg-white dark:bg-[#1e222d] rounded shadow-xl border border-gray-200 dark:border-[#2a2e39] select-none h-[38px] px-1 text-gray-800 dark:text-[#d1d4dc] transition-opacity duration-200" 
        ref={menuRef}
        style={{ transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)` }}
      >
        
        {/* Drag Grip */}
        <div 
          className="flex items-center justify-center w-6 h-full cursor-grab active:cursor-grabbing opacity-30 hover:opacity-100 transition-opacity"
          onMouseDown={handleDragStart}
        >
          <GripVertical size={16} />
        </div>


        <div className="w-[1px] h-5 bg-gray-200 dark:bg-[#2a2e39] mx-1"></div>

      {/* Color Picker Button */}
      <div className="relative flex items-center h-full px-1">
        <Tooltip text="Color">
          <button 
            className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2a2e39] transition-colors"
            onClick={() => setActiveMenu(activeMenu === 'color' ? null : 'color')}
          >
            <div className="w-[18px] h-[18px] rounded-sm border border-black/10 dark:border-white/10" style={{ backgroundColor: color }} />
          </button>
        </Tooltip>
        
        {activeMenu === 'color' && (
          <div className="absolute top-full left-0 mt-2 p-2 bg-white dark:bg-[#1e222d] border border-gray-200 dark:border-[#2a2e39] rounded-lg shadow-xl grid grid-cols-7 gap-1 w-[164px] z-50">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                className="w-5 h-5 rounded-sm border border-black/10 dark:border-white/10 hover:scale-110 transition-transform flex items-center justify-center"
                style={{ backgroundColor: c }}
                onClick={() => handleColorChange(c)}
              >
                {color === c && <div className="w-1.5 h-1.5 rounded-full bg-black/30 mix-blend-difference" />}
              </button>
            ))}
            <div className="col-span-7 flex items-center justify-end mt-2 pt-2 border-t border-gray-200 dark:border-[#2a2e39]">
              <input type="color" value={color} onChange={(e) => handleColorChange(e.target.value)} className="w-full h-6 cursor-pointer rounded overflow-hidden" />
            </div>
          </div>
        )}
      </div>

      {/* Thickness / Width */}
      <div className="relative flex items-center h-full px-1">
        <Tooltip text="Line thickness">
          <button 
            className="h-8 px-2 rounded flex items-center justify-center gap-1.5 hover:bg-gray-100 dark:hover:bg-[#2a2e39] transition-colors text-xs font-semibold"
            onClick={() => setActiveMenu(activeMenu === 'width' ? null : 'width')}
          >
            <div className="w-4 h-[2px] bg-current rounded-full" style={{ height: `${Math.min(lineWidth, 4)}px` }}></div>
            <span>{lineWidth}px</span>
          </button>
        </Tooltip>
        
        {activeMenu === 'width' && (
          <div className="absolute top-full left-0 mt-2 py-1 bg-white dark:bg-[#1e222d] border border-gray-200 dark:border-[#2a2e39] rounded-lg shadow-xl min-w-[120px] z-50 flex flex-col">
            {LINE_WIDTHS.map(w => (
              <button
                key={w}
                className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#2a2e39] text-sm ${lineWidth === w ? 'bg-gray-50 dark:bg-[#2a2e39]/50' : ''}`}
                onClick={() => handleWidthChange(w)}
              >
                <div className="w-6 flex justify-center"><div className="w-full bg-current rounded-full" style={{ height: `${w}px` }}></div></div>
                <span>{w}px</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Style */}
      <div className="relative flex items-center h-full px-1">
        <Tooltip text="Line style">
          <button 
            className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2a2e39] transition-colors"
            onClick={() => setActiveMenu(activeMenu === 'style' ? null : 'style')}
          >
            {lineStyle === 'solid' && <div className="w-4 h-[2px] bg-current rounded-full"></div>}
            {lineStyle === 'dashed' && <div className="w-4 h-[2px] border-t-2 border-dashed border-current"></div>}
            {lineStyle === 'dotted' && <div className="w-4 h-[2px] border-t-2 border-dotted border-current"></div>}
          </button>
        </Tooltip>

        {activeMenu === 'style' && (
          <div className="absolute top-full left-0 mt-2 py-1 bg-white dark:bg-[#1e222d] border border-gray-200 dark:border-[#2a2e39] rounded-lg shadow-xl min-w-[160px] z-50 flex flex-col">
            {LINE_STYLES.map(s => (
              <button
                key={s.id}
                className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#2a2e39] text-sm ${lineStyle === s.id ? 'bg-gray-50 dark:bg-[#2a2e39]/50 text-blue-600 dark:text-blue-500' : ''}`}
                onClick={() => handleStyleChange(s.id)}
              >
                <div className="w-6 flex justify-center">
                  {s.id === 'solid' && <div className="w-full h-[2px] bg-current rounded-full"></div>}
                  {s.id === 'dashed' && <div className="w-full h-[2px] border-t-2 border-dashed border-current"></div>}
                  {s.id === 'dotted' && <div className="w-full h-[2px] border-t-2 border-dotted border-current"></div>}
                </div>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text Button */}
      <div className="relative flex items-center h-full px-1">
        <Tooltip text="Settings text">
          <button 
            className={`w-8 h-8 rounded flex flex-col items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2a2e39] transition-colors ${activeMenu === 'text' ? 'bg-gray-100 dark:bg-[#2a2e39]' : ''}`}
            onClick={() => setActiveMenu(activeMenu === 'text' ? null : 'text')}
          >
            <Type size={18} className={text ? 'text-[#2962ff]' : ''} />
            <div className="w-4 h-[2px] mt-[1px] rounded-full" style={{ backgroundColor: textColor }}></div>
          </button>
        </Tooltip>
        
        {activeMenu === 'text' && (
          <div className="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-[#1e222d] border border-gray-200 dark:border-[#2a2e39] rounded-lg shadow-xl w-[200px] z-50 flex flex-col gap-3">
            <textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Add text"
              className="w-full h-20 bg-gray-50 dark:bg-[#2a2e39] border border-gray-200 dark:border-[#363a45] rounded p-2 text-xs outline-none resize-none focus:border-blue-500 transition-colors dark:text-white"
            />
            <div className="flex items-center gap-2">
              <div className="relative group">
                <div className="w-6 h-6 rounded border border-gray-300 dark:border-[#363a45] overflow-hidden">
                  <input 
                    type="color" 
                    value={textColor} 
                    onChange={(e) => handleTextColorChange(e.target.value)} 
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0" 
                  />
                  <div className="w-full h-full" style={{ backgroundColor: textColor }}></div>
                </div>
              </div>
              <select 
                value={fontSize} 
                onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                className="h-6 bg-gray-100 dark:bg-[#2a2e39] border border-gray-300 dark:border-[#363a45] rounded px-1 text-[10px] outline-none dark:text-white"
              >
                {[10, 12, 14, 16, 20, 24, 32].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button 
                onClick={toggleBold}
                className={`w-6 h-6 rounded flex items-center justify-center border ${isBold ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-[#363a45] text-gray-600 dark:text-gray-400'}`}
              >
                <Bold size={12} />
              </button>
              <button 
                onClick={toggleItalic}
                className={`w-6 h-6 rounded flex items-center justify-center border ${isItalic ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-[#363a45] text-gray-600 dark:text-gray-400'}`}
              >
                <Italic size={12} />
              </button>
            </div>
            
            <div className="flex border-t border-gray-100 dark:border-[#2a2e39] pt-2 gap-2">
              <select 
                value={textOrientation} 
                onChange={(e) => handleOrientationChange(e.target.value)}
                className="w-1/2 h-6 bg-gray-100 dark:bg-[#2a2e39] border border-gray-300 dark:border-[#363a45] rounded px-1 text-[10px] outline-none dark:text-white"
              >
                <option value="horizontal">Horizontal</option>
                <option value="parallel">Parallel</option>
              </select>
              <select 
                value={textPosition} 
                onChange={(e) => handlePositionChange(e.target.value)}
                className="w-1/2 h-6 bg-gray-100 dark:bg-[#2a2e39] border border-gray-300 dark:border-[#363a45] rounded px-1 text-[10px] outline-none dark:text-white"
              >
                <option value="top">Top</option>
                <option value="middle">Middle</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="w-[1px] h-5 bg-gray-200 dark:bg-[#2a2e39] mx-1"></div>

      {/* Settings */}
      <Tooltip text="Settings">
        <button 
          className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2a2e39] transition-colors mx-0.5"
          onClick={() => setIsSettingsModalOpen(true)}
        >
          <Settings size={16} />
        </button>
      </Tooltip>

      {/* Alert */}
      <Tooltip text="Alert">
        <button 
          className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2a2e39] transition-colors mx-0.5"
          onClick={() => setIsAlertOpen(true)}
        >
          <div className="relative">
            <AlarmClock size={16} />
            <span className="absolute -bottom-1 -right-1 text-[10px] font-bold leading-none">+</span>
          </div>
        </button>
      </Tooltip>

      {/* Lock */}
      <Tooltip text={isLocked ? "Unlock" : "Lock"}>
        <button 
          className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2a2e39] transition-colors mx-0.5"
          onClick={() => setIsLocked(!isLocked)}
        >
          {isLocked ? <Lock size={16} className="text-blue-600 dark:text-blue-500" /> : <Unlock size={16} />}
        </button>
      </Tooltip>

      {/* Delete */}
      <Tooltip text="Remove">
        <button 
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDeleteSelected();
          }} 
          className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2a2e39] hover:text-red-500 transition-colors mx-0.5"
        >
          <Trash2 size={16} />
        </button>
      </Tooltip>

        {/* More */}
        <div className="relative flex items-center h-full px-1">
          <Tooltip text="More">
            <button 
              onClick={() => setActiveMenu(activeMenu === 'more' ? null : 'more')}
              className={`w-8 h-8 rounded flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2a2e39] transition-colors mx-0.5 ${activeMenu === 'more' ? 'bg-gray-200 dark:bg-[#363c4e] text-blue-500' : ''}`}
            >
              <MoreHorizontal size={16} />
            </button>
          </Tooltip>

          {activeMenu === 'more' && (
            <div className="absolute top-full right-0 mt-2 bg-white dark:bg-[#1e222d] border border-gray-200 dark:border-[#2a2e39] rounded shadow-xl flex flex-col min-w-[220px] text-[13px] py-1 z-50">
              <div className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2a2e39] cursor-pointer group">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                  <span>Visual order</span>
                </div>
                <span className="opacity-50">›</span>
              </div>
              <div className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2a2e39] cursor-pointer group">
                <div className="flex items-center gap-2">
                  <span className="w-4"></span>
                  <span>Visibility on intervals</span>
                </div>
                <span className="opacity-50">›</span>
              </div>
              
              <div className="w-full h-px bg-gray-200 dark:bg-[#2a2e39] my-1"></div>
              
              <div 
                className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2a2e39] cursor-pointer group"
                onClick={() => {
                  if (selectedToolId && onClone) onClone(selectedToolId);
                  setActiveMenu(null);
                }}
              >
                <div className="flex items-center gap-2">
                  <Copy size={16} className="text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                  <span>Clone</span>
                </div>
                <span className="opacity-50 text-xs">⌘ + Drag</span>
              </div>
              <div 
                className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2a2e39] cursor-pointer group"
                onClick={() => {
                   // Copy to clipboard or internal state
                   setActiveMenu(null);
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-4"></span>
                  <span>Copy</span>
                </div>
                <span className="opacity-50 text-xs">⌘ + C</span>
              </div>

              <div className="w-full h-px bg-gray-200 dark:bg-[#2a2e39] my-1"></div>

              <div 
                className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2a2e39] cursor-pointer group"
                onClick={() => {
                   if (selectedToolId && onHide) onHide(selectedToolId);
                   setActiveMenu(null);
                }}
              >
                <div className="flex items-center gap-2">
                  <EyeOff size={16} className="text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                  <span>Hide</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
      <DrawingAlertModal 
        isOpen={isAlertOpen} 
        onClose={() => setIsAlertOpen(false)} 
        toolDetails="horizontal line"
      />
      
      {/* Settings Modal */}
      <DrawingSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        toolId={selectedToolId}
        managerRef={managerRef}
        toolName="Trendline"
      />
    </>
  );
};

export default DrawingPropertiesPanel;
