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
  const { 
    magnetMode, setMagnetMode, magnetStrength,
    lockMode, setLockMode, 
    hiddenLayers, setHiddenLayer, hideAll
  } = useDrawingSettings();
  
  const timeoutRef = useRef<any>(null);

  const handleMouseEnter = (catId: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpenCategory(catId);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpenCategory(null);
    }, 100);
  };

  return (
    <div className="absolute top-0 bottom-0 left-0 z-50 flex flex-col items-center bg-transparent border-r border-[#2a2e39] w-12 py-2 select-none group/sidebar">
      <div className="flex flex-col gap-1 w-full items-center">
        {DRAWING_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = cat.tools.some(t => 'id' in t && t.id === activeTool);
          
          return (
            <div 
              key={cat.id} 
              className="relative w-full flex justify-center"
              onMouseEnter={() => handleMouseEnter(cat.id)}
              onMouseLeave={handleMouseLeave}
            >
              <button
                className={`p-2 rounded-md transition-all group/item flex items-center justify-center w-9 h-9 relative ${
                  isActive
                    ? 'bg-[#2a2e39] text-[#2962FF]'
                    : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
                }`}
              >
                <Icon size={20} />
                <div className="absolute bottom-1 right-1">
                  <ChevronRight size={6} className="text-[#5d606b] group-hover/item:text-white rotate-45" />
                </div>
              </button>

              {openCategory === cat.id && (
                <DrawingCategoryMenu 
                  category={cat}
                  activeTool={activeTool}
                  onSelect={(toolId) => {
                    onSelectTool(toolId);
                    setOpenCategory(null);
                  }}
                  onClose={() => setOpenCategory(null)}
                  style={{ left: '48px', top: '0' }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="w-8 h-px bg-[#2a2e39] my-2" />

      <div className="flex flex-col gap-1 w-full items-center">
        {/* Alerts Button */}
        <button 
          onClick={onOpenAlerts}
          className="p-2 w-9 h-9 rounded-md transition-all text-[#d1d4dc] hover:bg-blue-600/10 hover:text-blue-500"
          title="Create Alert"
        >
          <Bell size={20} />
        </button>

        <div className="w-8 h-px bg-[#2a2e39] my-2" />

        {/* Bottom Tools */}
        <button 
          onClick={() => onSelectTool(activeTool === 'ruler' ? null : 'ruler')}
          className={`p-2 w-9 h-9 rounded-md transition-all ${
            activeTool === 'ruler' ? 'text-[#2962FF] bg-[#2a2e39]' : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
          }`}
          title="Measure"
        >
          <Ruler size={20} />
        </button>

        <button 
          onClick={() => onZoomIn?.()}
          className="p-2 w-9 h-9 rounded-md transition-all text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white active:scale-95 active:bg-[#2962FF]/20"
          title="Zoom In"
        >
          <ZoomIn size={20} />
        </button>

        <button 
          onClick={() => onZoomOut?.()}
          className="p-2 w-9 h-9 rounded-md transition-all text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white active:scale-95 active:bg-[#2962FF]/20"
          title="Zoom Out"
        >
          <ZoomOut size={20} />
        </button>

        <div className="w-8 h-px bg-[#2a2e39] my-2" />

        {/* Magnet Tool with menu */}
        <div 
          className="relative w-full flex justify-center"
          onMouseEnter={() => handleMouseEnter('magnet')}
          onMouseLeave={handleMouseLeave}
        >
          <button 
            onClick={() => setMagnetMode(!magnetMode)}
            className={`p-2 w-9 h-9 rounded-md transition-all group/item flex items-center justify-center relative ${
              magnetMode ? 'text-[#2962FF] bg-[#2a2e39]' : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
            }`}
            title="Magnet Mode"
          >
            <Magnet size={20} className={magnetStrength === 'weak' ? 'opacity-70' : ''} />
            <div className="absolute bottom-1 right-1">
              <ChevronRight size={6} className="text-[#5d606b] group-hover/item:text-white rotate-45" />
            </div>
          </button>
          
          {openCategory === 'magnet' && (
            <MagnetMenu 
              onClose={() => setOpenCategory(null)}
              style={{ left: '48px', top: '0' }}
            />
          )}
        </div>

        <button 
          onClick={() => setLockMode(!lockMode)}
          className={`p-2 w-9 h-9 rounded-md transition-all ${
            lockMode ? 'text-[#2962FF] bg-[#2a2e39]' : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
          }`}
          title="Lock All Drawing Tools"
        >
          <Lock size={20} />
        </button>

        {/* Hide All Drawings with menu */}
        <div 
          className="relative w-full flex justify-center"
          onMouseEnter={() => handleMouseEnter('visibility')}
          onMouseLeave={handleMouseLeave}
        >
          <button 
            onClick={() => {
              const anyHidden = hiddenLayers.drawings || hiddenLayers.indicators || hiddenLayers.positions;
              if (anyHidden) {
                // Show all
                setHiddenLayer('drawings', false);
                setHiddenLayer('indicators', false);
                setHiddenLayer('positions', false);
              } else {
                hideAll();
              }
            }}
            className={`p-2 w-9 h-9 rounded-md transition-all group/item flex items-center justify-center relative ${
              (hiddenLayers.drawings || hiddenLayers.indicators || hiddenLayers.positions) ? 'text-[#2962FF] bg-[#2a2e39]' : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
            }`}
            title="Hide all"
          >
            <EyeOff size={20} />
            <div className="absolute bottom-1 right-1">
              <ChevronRight size={6} className="text-[#5d606b] group-hover/item:text-white rotate-45" />
            </div>
          </button>

          {openCategory === 'visibility' && (
            <VisibilityMenu 
              onClose={() => setOpenCategory(null)}
              style={{ left: '48px', top: '0' }}
            />
          )}
        </div>

        <div className="w-8 h-px bg-[#2a2e39] my-2" />


        <button 
          onClick={onToggleLibrary}
          className="p-2 w-9 h-9 rounded-md text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white relative"
          title="Template Library"
        >
          <Library size={20} />
        </button>

        <div className="mt-auto">
          <button 
            onClick={onClearAll}
            className="p-2 w-9 h-9 rounded-md text-[#f23645] hover:bg-[#f23645]/10 transition-colors"
            title="Remove Drawings"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrawingToolbar;
