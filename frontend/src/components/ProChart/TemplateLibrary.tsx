import React, { useState } from 'react';
import { Search, Grid, List, Trash2, Play, Plus, X, Tag, Layers } from 'lucide-react';
import { useChartObjects, type DrawingTemplate } from '../../store/useChartObjects';
import { Button } from '@/components/ui/button';

interface TemplateLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (template: DrawingTemplate) => void;
  onDelete?: (id: string) => void;
  onSaveNew: () => void;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  isOpen,
  onClose,
  onApply,
  onDelete,
  onSaveNew,
}) => {
  const { templates, deleteTemplate } = useChartObjects();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      if (onDelete) {
        onDelete(id);
      } else {
        deleteTemplate(id);
      }
    }
  };

  if (!isOpen) return null;

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())) ||
      t.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#131722] w-full max-w-4xl max-h-[80vh] rounded-md border border-[#2a2e39] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2e39]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Plus className="text-blue-500" size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Drawing Templates</h2>
              <p className="text-[10px] text-[#d1d4dc]/40 font-bold uppercase tracking-tight">Save and reuse your setups</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 transition-colors">
            <X size={20} className="text-[#d1d4dc]/40" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-[#2a2e39] flex items-center justify-between gap-4">
          <div className="flex-1 flex items-center gap-2 bg-[#1e222d] rounded-xl px-4 py-2 border border-[#2a2e39]">
            <Search size={16} className="text-[#d1d4dc]/30 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates, tags, or categories..."
              className="bg-transparent text-sm text-[#d1d4dc] placeholder:text-[#d1d4dc]/20 focus:outline-none w-full font-medium"
            />
          </div>
          
          <div className="flex items-center gap-2 border-l border-[#2a2e39] pl-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('grid')}
              className={`h-9 w-9 rounded-lg ${viewMode === 'grid' ? 'bg-blue-500/10 text-blue-500' : 'text-[#d1d4dc]/40'}`}
            >
              <Grid size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('list')}
              className={`h-9 w-9 rounded-lg ${viewMode === 'list' ? 'bg-blue-500/10 text-blue-500' : 'text-[#d1d4dc]/40'}`}
            >
              <List size={18} />
            </Button>
            <Button
              onClick={onSaveNew}
              className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest px-6 h-9 rounded-lg shadow-lg shadow-blue-600/20"
            >
              Save New
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#0b0e14]/50">
          {filteredTemplates.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#d1d4dc]/20 flex items-center justify-center mb-4">
                <Search size={24} />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1">No templates found</p>
              <p className="text-[10px] uppercase tracking-tight">Try a different search or save your current setup</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group relative bg-[#1c212b] rounded-md border border-[#2a2e39] overflow-hidden hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/5"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-black/40 relative overflow-hidden">
                    {template.thumbnail ? (
                      <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Layers className="text-[#d1d4dc]/10" size={32} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#131722] via-transparent to-transparent opacity-60" />
                    
                    {/* Actions Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
                      <Button
                        size="sm"
                        onClick={() => onApply(template)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg h-8 px-4"
                      >
                        <Play size={10} className="mr-1 fill-current" /> Apply
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(template.id)}
                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg h-8 w-8"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-xs font-black uppercase tracking-widest text-[#d1d4dc] group-hover:text-blue-400 transition-colors truncate">
                        {template.name}
                      </h4>
                      <span className="text-[9px] bg-[#131722] px-2 py-0.5 rounded text-blue-400 font-bold uppercase tracking-tighter border border-[#2a2e39]">
                        {template.category}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {template.tags.map((tag) => (
                        <span key={tag} className="flex items-center gap-1 text-[9px] text-[#d1d4dc]/30 font-bold uppercase tracking-tight bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                          <Tag size={8} /> {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map((template) => (
                <div key={template.id} className="flex items-center gap-4 bg-[#1c212b] p-3 rounded-xl border border-[#2a2e39] hover:border-blue-500/30 transition-colors group">
                  <div className="w-20 h-12 bg-black/40 rounded-lg overflow-hidden shrink-0 border border-white/5">
                    {template.thumbnail && <img src={template.thumbnail} className="w-full h-full object-cover opacity-60" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black uppercase tracking-widest text-[#d1d4dc] truncate">{template.name}</h4>
                    <p className="text-[9px] text-[#d1d4dc]/30 font-bold uppercase tracking-tight">{template.category} · {new Date(template.timestamp).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      onClick={() => onApply(template)}
                      className="bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-lg h-8 border border-blue-600/20"
                    >
                      Apply
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTemplate(template.id)}
                      className="text-red-500/40 hover:text-red-500 hover:bg-red-500/10 h-8 w-8"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2e39] text-center">
          <p className="text-[9px] text-[#d1d4dc]/20 font-black uppercase tracking-[0.2em]">
            {filteredTemplates.length} Templates loaded · Sync across devices enabled
          </p>
        </div>
      </div>
    </div>
  );
};
