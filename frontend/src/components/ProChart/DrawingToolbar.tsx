import React, { useState, useRef } from 'react';
import { 
  Magnet, Lock, EyeOff, Trash2, 
  Ruler, ZoomIn, ZoomOut, ChevronRight, Library, Bell
} from 'lucide-react';
import { useDrawingSettings } from '../../store/useDrawingSettings';
import { DRAWING_CATEGORIES } from '../../constants/drawingTools';
import { DrawingCategoryMenu } from './DrawingCategoryMenu';
import { MagnetMenu } from './MagnetMenu';
import { VisibilityMenu } from './VisibilityMenu';

interface DrawingToolbarProps {
  activeTool: string | null;
  onSelectTool: (tool: string | null) => void;
  onClearAll: () => void;
  onToggleLibrary?: () => void;
  onOpenAlerts: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = (props) => {
  const { 
    activeTool, onSelectTool, onClearAll, onToggleLibrary,
    onOpenAlerts, onZoomIn, onZoomOut
  } = props;

  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [menuTop, setMenuTop] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    magnetMode, setMagnetMode, magnetStrength,
    lockMode, setLockMode, 
    hiddenLayers, setHiddenLayer, hideAll
  } = useDrawingSettings();
  
  const timeoutRef = useRef<any>(null);

  const handleMouseEnter = (catId: string, e: React.MouseEvent) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Calculate top position relative to sidebar container
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const parentRect = containerRef.current?.getBoundingClientRect() || { top: 0 };
    
    setMenuTop(rect.top - parentRect.top);
    setOpenCategory(catId);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpenCategory(null);
    }, 100);
  };

  return (
    <div ref={containerRef} className="absolute top-0 bottom-0 left-0 z-50 flex flex-col items-center bg-[#121212]/90 backdrop-blur-md border-r border-[#2a2e39] w-12 py-1 select-none overflow-visible">
      {/* Scrollable Tool List */}
      <div className="flex-1 w-full flex flex-col items-center overflow-y-auto [&::-webkit-scrollbar]:hidden scroll-smooth py-1">
        <div className="flex flex-col gap-1 w-full items-center">
          {DRAWING_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = cat.tools.some(t => 'id' in t && t.id === activeTool);
            
            return (
              <div 
                key={cat.id} 
                className="relative w-full flex justify-center"
                onMouseEnter={(e) => handleMouseEnter(cat.id, e)}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  className={`p-1.5 rounded-md transition-all group/item flex items-center justify-center w-8 h-8 relative ${
                    isActive
                      ? 'bg-[#2a2e39] text-[#2962FF]'
                      : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  <div className="absolute bottom-1 right-0.5">
                    <ChevronRight size={5} className="text-[#5d606b] group-hover/item:text-white rotate-45" />
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        <div className="w-8 h-px bg-[#2a2e39] my-2" />

        <div className="flex flex-col gap-1 w-full items-center">
          <button 
            onClick={onOpenAlerts}
            className="p-1.5 w-8 h-8 rounded-md transition-all text-[#d1d4dc] hover:bg-blue-600/10 hover:text-blue-500 flex items-center justify-center"
            title="Create Alert"
          >
            <Bell size={18} />
          </button>

          <div className="w-8 h-px bg-[#2a2e39] my-2" />

          <button 
            onClick={() => onSelectTool(activeTool === 'ruler' ? null : 'ruler')}
            className={`p-1.5 w-8 h-8 rounded-md transition-all flex items-center justify-center ${
              activeTool === 'ruler' ? 'text-[#2962FF] bg-[#2a2e39]' : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
            }`}
            title="Measure"
          >
            <Ruler size={18} />
          </button>

          <button 
            onClick={() => onZoomIn?.()}
            className="p-1.5 w-8 h-8 rounded-md transition-all text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white active:scale-95 active:bg-[#2962FF]/20 flex items-center justify-center"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>

          <button 
            onClick={() => onZoomOut?.()}
            className="p-1.5 w-8 h-8 rounded-md transition-all text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white active:scale-95 active:bg-[#2962FF]/20 flex items-center justify-center"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>

          <div className="w-8 h-px bg-[#2a2e39] my-2" />

          <div 
            className="relative w-full flex justify-center"
            onMouseEnter={(e) => handleMouseEnter('magnet', e)}
            onMouseLeave={handleMouseLeave}
          >
            <button 
              onClick={() => setMagnetMode(!magnetMode)}
              className={`p-1.5 w-8 h-8 rounded-md transition-all group/item flex items-center justify-center relative ${
                magnetMode ? 'text-[#2962FF] bg-[#2a2e39]' : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
              }`}
              title="Magnet Mode"
            >
              <Magnet size={18} className={magnetStrength === 'weak' ? 'opacity-70' : ''} />
              <div className="absolute bottom-1 right-0.5">
                <ChevronRight size={5} className="text-[#5d606b] group-hover/item:text-white rotate-45" />
              </div>
            </button>
          </div>

          <button 
            onClick={() => setLockMode(!lockMode)}
            className={`p-1.5 w-8 h-8 rounded-md transition-all flex items-center justify-center ${
              lockMode ? 'text-[#2962FF] bg-[#2a2e39]' : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
            }`}
            title="Lock All Drawing Tools"
          >
            <Lock size={18} />
          </button>

          <div 
            className="relative w-full flex justify-center"
            onMouseEnter={(e) => handleMouseEnter('visibility', e)}
            onMouseLeave={handleMouseLeave}
          >
            <button 
              onClick={() => {
                const anyHidden = hiddenLayers.drawings || hiddenLayers.indicators || hiddenLayers.positions;
                if (anyHidden) {
                  setHiddenLayer('drawings', false);
                  setHiddenLayer('indicators', false);
                  setHiddenLayer('positions', false);
                } else {
                  hideAll();
                }
              }}
              className={`p-1.5 w-8 h-8 rounded-md transition-all group/item flex items-center justify-center relative ${
                (hiddenLayers.drawings || hiddenLayers.indicators || hiddenLayers.positions) ? 'text-[#2962FF] bg-[#2a2e39]' : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
              }`}
              title="Hide all"
            >
              <EyeOff size={18} />
              <div className="absolute bottom-1 right-0.5">
                <ChevronRight size={5} className="text-[#5d606b] group-hover/item:text-white rotate-45" />
              </div>
            </button>
          </div>

          <div className="w-8 h-px bg-[#2a2e39] my-2" />

          <button 
            onClick={onToggleLibrary}
            className="p-1.5 w-8 h-8 rounded-md text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white relative flex items-center justify-center"
            title="Template Library"
          >
            <Library size={18} />
          </button>

          <div className="mt-auto pb-1">
            <button 
              onClick={onClearAll}
              className="p-1.5 w-8 h-8 rounded-md text-[#f23645] hover:bg-[#f23645]/10 transition-colors flex items-center justify-center"
              title="Remove Drawings"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Sub-menus (Outside scroll container to prevent clipping) */}
      {openCategory && (
        <div 
          onMouseEnter={() => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }}
          onMouseLeave={handleMouseLeave}
        >
          {DRAWING_CATEGORIES.find(c => c.id === openCategory) && (
            <DrawingCategoryMenu 
              category={DRAWING_CATEGORIES.find(c => c.id === openCategory)!}
              activeTool={activeTool}
              onSelect={(toolId) => {
                onSelectTool(toolId);
                setOpenCategory(null);
              }}
              onClose={() => setOpenCategory(null)}
              style={{ left: '48px', top: menuTop }}
            />
          )}

          {openCategory === 'magnet' && (
            <MagnetMenu 
              onClose={() => setOpenCategory(null)}
              style={{ left: '48px', top: menuTop }}
            />
          )}

          {openCategory === 'visibility' && (
            <VisibilityMenu 
              onClose={() => setOpenCategory(null)}
              style={{ left: '48px', top: menuTop }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DrawingToolbar;
