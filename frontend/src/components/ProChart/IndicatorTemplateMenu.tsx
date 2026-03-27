import React, { useState } from 'react';
import { CloudUpload, LayoutGrid, Trash2 } from 'lucide-react';
import { useChartObjects } from '../../store/useChartObjects';
import type { IndicatorTemplate } from '../../store/useChartObjects';
import { useIndicatorSettings } from '../../store/useIndicatorSettings';

interface IndicatorTemplateMenuProps {
  activeIndicatorIds: string[];
  onApplyTemplate: (template: IndicatorTemplate) => void;
}

export const IndicatorTemplateMenu: React.FC<IndicatorTemplateMenuProps> = ({
  activeIndicatorIds,
  onApplyTemplate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  
  const { indicatorTemplates, saveIndicatorTemplate, deleteIndicatorTemplate } = useChartObjects();
  const { settings } = useIndicatorSettings();

  const handleSave = () => {
    if (!newTemplateName.trim()) return;
    
    const template: IndicatorTemplate = {
      id: Math.random().toString(36).substr(2, 9),
      name: newTemplateName.trim(),
      indicatorIds: [...activeIndicatorIds],
      settings: JSON.parse(JSON.stringify(settings)), // Deep clone to prevent state sharing
      timestamp: Date.now(),
    };
    
    console.log('💾 Saving Indicator Template:', template);
    saveIndicatorTemplate(template);
    setNewTemplateName('');
    setShowSaveDialog(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md transition-colors flex items-center gap-1 ${isOpen ? 'text-[#2962ff]' : 'text-tv-text-secondary dark:text-[#d1d4dc] hover:text-tv-text-primary dark:hover:text-white'}`}
        title="Indicator Templates"
      >
        <LayoutGrid size={18} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full left-0 mt-1 w-64 bg-tv-bg-pane dark:bg-[#1e222d] border border-tv-border dark:border-[#2a2e39] rounded-lg shadow-2xl z-[101] py-1 animate-in fade-in slide-in-from-top-1 duration-100 backdrop-blur-md">
            <button
              onClick={() => {
                setShowSaveDialog(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-tv-text-primary dark:text-[#d1d4dc] hover:bg-blue-600 hover:text-white transition-colors font-medium"
            >
              <CloudUpload size={16} />
              <span>Save Indicator template...</span>
            </button>
            
            <div className="h-[1px] bg-tv-border dark:bg-[#2a2e39] my-1" />
            
            <div className="px-3 py-1.5 text-[10px] font-bold text-tv-text-secondary dark:text-[#5d606b] uppercase tracking-wider">
              Templates
            </div>
            
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {indicatorTemplates.length === 0 ? (
                <div className="px-3 py-4 text-xs text-center text-tv-text-secondary dark:text-[#5d606b]">
                  No templates saved yet
                </div>
              ) : (
                indicatorTemplates.map((template) => (
                  <div 
                    key={template.id}
                    className="group flex items-center justify-between px-3 py-2 hover:bg-tv-border/50 dark:hover:bg-[#2a2e39] cursor-pointer transition-colors"
                  >
                    <div 
                      className="flex-1 flex flex-col min-w-0"
                      onClick={() => {
                        onApplyTemplate(template);
                        setIsOpen(false);
                      }}
                    >
                      <span className="text-sm text-tv-text-primary dark:text-[#d1d4dc] truncate group-hover:text-tv-text-primary dark:group-hover:text-white font-medium">
                        {template.name}
                      </span>
                      <span className="text-[10px] text-tv-text-secondary dark:text-[#5d606b] truncate">
                        {template.indicatorIds.join(', ')}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteIndicatorTemplate(template.id);
                      }}
                      className="p-1 text-tv-text-secondary dark:text-[#5d606b] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Save Dialog Modal */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-tv-bg-pane dark:bg-[#1e222d] border border-tv-border dark:border-[#2a2e39] rounded-lg shadow-2xl w-full max-w-sm p-5 animate-in zoom-in-95 duration-200">
            <div className="text-lg font-bold text-tv-text-primary dark:text-white mb-4">Save Indicator Template</div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-tv-text-secondary dark:text-[#5d606b] uppercase tracking-wider mb-1.5">Template Name</label>
                <input
                  type="text"
                  autoFocus
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.target Strategy"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  className="w-full bg-tv-bg-base dark:bg-[#131722] border border-tv-border dark:border-[#2a2e39] rounded px-3 py-2 text-tv-text-primary dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="text-xs text-tv-text-secondary dark:text-[#5d606b]">
                Includes {activeIndicatorIds.length} active indicators: {activeIndicatorIds.join(', ')}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 text-sm font-bold text-tv-text-secondary dark:text-[#d1d4dc] hover:bg-tv-border/50 dark:hover:bg-[#2a2e39] rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!newTemplateName.trim()}
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
