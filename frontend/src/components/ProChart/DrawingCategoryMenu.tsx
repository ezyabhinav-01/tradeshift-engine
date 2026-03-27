import React from 'react';
import { Star } from 'lucide-react';
import { useDrawingSettings } from '../../store/useDrawingSettings';
import type { DrawingCategory } from '../../constants/drawingTools';

interface DrawingCategoryMenuProps {
  category: DrawingCategory;
  activeTool: string | null;
  onSelect: (toolId: string) => void;
  onClose: () => void;
  style?: React.CSSProperties;
}

export const DrawingCategoryMenu: React.FC<DrawingCategoryMenuProps> = ({ 
  category, activeTool, onSelect, onClose, style 
}) => {
  const { favorites, toggleFavorite } = useDrawingSettings();

  return (
    <div 
      className="absolute bg-tv-bg-pane dark:bg-[#1e222d] border border-tv-border dark:border-[#2a2e39] shadow-2xl py-2 min-w-[220px] z-[100] animate-in fade-in slide-in-from-left-2 duration-150 rounded-lg backdrop-blur-md"
      style={style}
      onMouseLeave={onClose}
    >
      <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
        {category.tools.map((tool, index) => {
          if (!('id' in tool)) {
            return (
              <div key={`section-${index}`} className="px-4 py-1.5 mt-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-tv-text-secondary dark:text-[#787b86]">
                  {tool.section}
                </span>
              </div>
            );
          }

          const isFavorite = favorites.includes(tool.id);
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;

          return (
            <div 
              key={tool.id}
              className={`flex items-center justify-between px-4 py-[6px] cursor-pointer transition-colors group ${
                isActive ? 'text-blue-500 font-bold' : 'text-tv-text-primary dark:text-[#d1d4dc] hover:bg-tv-border/50 dark:hover:bg-[#2a2e39]'
              } ${!tool.supported ? 'opacity-40 cursor-not-allowed' : ''}`}
              onClick={() => tool.supported && onSelect(tool.id)}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={isActive ? 'text-blue-500' : 'text-tv-text-secondary dark:text-[#d1d4dc] group-hover:text-tv-text-primary dark:group-hover:text-white'} />
                <span className="text-[13px]">{tool.name}</span>
              </div>

              <div className="flex items-center gap-3">
                {tool.shortcut && (
                  <span className="text-[11px] text-tv-text-secondary dark:text-[#787b86] hidden group-hover:inline">
                    {tool.shortcut}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(tool.id);
                  }}
                  className={`transition-all p-[2px] rounded hover:bg-tv-border/50 dark:hover:bg-[#363a45] ${
                    isFavorite 
                      ? 'text-orange-400 opacity-100' 
                      : 'text-tv-text-secondary dark:text-[#787b86] group-hover:opacity-100 opacity-0'
                  }`}
                >
                  <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
