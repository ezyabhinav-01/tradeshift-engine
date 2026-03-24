import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GripVertical, GripHorizontal, ChevronDown, ChevronRight, Rows2, Columns2 } from 'lucide-react';
import { useDrawingSettings } from '../../store/useDrawingSettings';
import { DRAWING_CATEGORIES } from '../../constants/drawingTools';

interface FavoritesToolbarProps {
  activeTool: string | null;
  onSelectTool: (tool: string | null) => void;
}

export const FavoritesToolbar: React.FC<FavoritesToolbarProps> = ({ activeTool, onSelectTool }) => {
  const { 
    favorites, 
    favoritesPosition, setFavoritesPosition,
    favoritesOrientation, setFavoritesOrientation,
    isFavoritesCollapsed, setIsFavoritesCollapsed
  } = useDrawingSettings();
  
  const [isDragging, setIsDragging] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastPosition = useRef<{ x: number; y: number } | null>(favoritesPosition);
  
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent dragging if clicking a button
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    // Get parent offset to calculate relative positioning correctly
    const parentElement = containerRef.current.offsetParent as HTMLElement;
    const parentRect = parentElement?.getBoundingClientRect() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate new position relative to parent
    const viewportX = e.clientX - dragOffset.current.x;
    const viewportY = e.clientY - dragOffset.current.y;
    
    let x = viewportX - parentRect.left;
    let y = viewportY - parentRect.top;
    
    // Boundary Constraints
    const padding = 8;
    const maxX = parentRect.width - rect.width - padding;
    const maxY = parentRect.height - rect.height - padding;
    
    x = Math.max(padding, Math.min(x, maxX));
    y = Math.max(padding, Math.min(y, maxY));
    
    // Disable all transition while dragging to ensure it's "live" and follows cursor perfectly
    containerRef.current.style.transition = 'none';
    containerRef.current.style.left = `${x}px`;
    containerRef.current.style.top = `${y}px`;
    containerRef.current.style.transform = 'none';
    containerRef.current.style.bottom = 'auto'; 
    
    lastPosition.current = { x, y };
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && lastPosition.current) {
      setFavoritesPosition(lastPosition.current);
    }
    // Restore transitions after drag
    if (containerRef.current) {
      containerRef.current.style.transition = '';
    }
    setIsDragging(false);
  }, [isDragging, setFavoritesPosition]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Ensure favorites stays in bounds on window resize
  useEffect(() => {
    if (!isHydrated || !favoritesPosition || !containerRef.current) return;

    const handleResize = () => {
      if (!containerRef.current) return;
      const parentElement = containerRef.current.offsetParent as HTMLElement;
      if (!parentElement) return;

      const parentRect = parentElement.getBoundingClientRect();
      const rect = containerRef.current.getBoundingClientRect();
      const padding = 8;

      const maxX = parentRect.width - rect.width - padding;
      const maxY = parentRect.height - rect.height - padding;

      const newX = Math.max(padding, Math.min(favoritesPosition.x, maxX));
      const newY = Math.max(padding, Math.min(favoritesPosition.y, maxY));

      if (newX !== favoritesPosition.x || newY !== favoritesPosition.y) {
        setFavoritesPosition({ x: newX, y: newY });
      }
    };

    window.addEventListener('resize', handleResize);
    // Initial check
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, [isHydrated, favoritesPosition, setFavoritesPosition]);

  // Extreme safety check to prevent crash during hydration or if state is corrupted
  if (!isHydrated || !favorites || !Array.isArray(favorites) || favorites.length === 0) {
    return null;
  }

  // Flatten all tools and filter for favorites with extra safety
  const favoriteTools = (DRAWING_CATEGORIES || []).flatMap(cat => cat?.tools || [])
    .filter(tool => 
      tool && 
      typeof tool === 'object' && 
      'id' in tool && 
      tool.id && 
      favorites.includes(tool.id)
    );

  const isVertical = favoritesOrientation === 'vertical';

  const containerStyle: React.CSSProperties = favoritesPosition 
    ? { left: favoritesPosition.x, top: favoritesPosition.y, transform: 'none' }
    : { bottom: '1rem', left: '50%', transform: 'translateX(-50%)' };

  return (
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      style={containerStyle}
      className={`absolute z-[60] flex ${isVertical ? 'flex-col' : 'flex-row'} items-center bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-2xl p-1 gap-1 select-none backdrop-blur-lg ${isDragging ? 'opacity-90 scale-[0.98] cursor-grabbing shadow-blue-500/20 ring-1 ring-blue-500/50' : 'opacity-100 transition-[transform,opacity,scale] duration-200'}`}
    >
      {/* Drag Handle */}
      <div className={`p-1 text-white/20 cursor-grab active:cursor-grabbing hover:text-white/40 transition-colors ${isVertical ? 'w-full flex justify-center border-b border-[#2a2e39] mb-1' : 'h-full flex items-center border-r border-[#2a2e39] mr-1'}`}>
        {isVertical ? <GripHorizontal size={14} /> : <GripVertical size={14} />}
      </div>

      {!isFavoritesCollapsed && (
        <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} gap-1`}>
          {favoriteTools.map((tool) => {
            if (!('id' in tool)) return null;

            const Icon = tool.icon;
            const isActive = activeTool === tool.id;

            return (
              <button
                key={tool.id}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onSelectTool(tool.id)}
                title={tool.name}
                className={`p-2 rounded-md transition-all group relative ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-[#d1d4dc] hover:bg-[#2a2e39] hover:text-white'
                }`}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>
      )}

      {/* Control Actions */}
      <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} gap-1 ${isVertical ? 'mt-1 pt-1 border-t' : 'ml-1 pl-1 border-l'} border-[#2a2e39]`}>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setFavoritesOrientation(isVertical ? 'horizontal' : 'vertical')}
          title={isVertical ? "Switch to Horizontal" : "Switch to Vertical"}
          className="p-1.5 rounded-md text-[#5d606b] hover:text-white hover:bg-[#2a2e39] transition-all"
        >
          {isVertical ? <Rows2 size={14} /> : <Columns2 size={14} />}
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setIsFavoritesCollapsed(!isFavoritesCollapsed)}
          title={isFavoritesCollapsed ? "Expand Tools" : "Collapse Tools"}
          className="p-1.5 rounded-md text-[#5d606b] hover:text-white hover:bg-[#2a2e39] transition-all"
        >
          {isFavoritesCollapsed ? (isVertical ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : (isVertical ? <ChevronDown size={14} className="rotate-180" /> : <ChevronRight size={14} className="rotate-180" />)}
        </button>
      </div>
    </div>
  );
};
