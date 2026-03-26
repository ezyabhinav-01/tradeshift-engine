import React, { useState } from 'react';
import { X, Tag, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, category: string, tags: string[]) => void;
  thumbnail: string | null;
}

const CATEGORIES = ['Trend', 'Fibonacci', 'Shapes', 'Full Setup', 'Custom'];

export const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  thumbnail,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Trend');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), category, tags);
    setName('');
    setTags([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#131722] w-full max-w-md rounded-md border border-[#2a2e39] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2e39]">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">Save Template</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 transition-colors">
            <X size={18} className="text-[#d1d4dc]/40" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Thumbnail Preview */}
          <div className="aspect-video bg-black/40 rounded-xl border border-[#2a2e39] overflow-hidden flex items-center justify-center relative">
            {thumbnail ? (
              <img src={thumbnail} alt="Preview" className="w-full h-full object-cover opacity-60" />
            ) : (
              <p className="text-[10px] text-[#d1d4dc]/20 font-black uppercase tracking-widest">No Preview</p>
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[8px] text-white/60 font-black uppercase tracking-widest">Live Capture</span>
            </div>
          </div>

          {/* Name Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#d1d4dc]/40 font-black uppercase tracking-widest px-1">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BTC Bullish Fractal"
              className="w-full bg-[#1e222d] border border-[#2a2e39] rounded-xl px-4 py-2.5 text-xs text-[#d1d4dc] focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-[#d1d4dc]/10 font-bold"
            />
          </div>

          {/* Category Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#d1d4dc]/40 font-black uppercase tracking-widest px-1">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    category === cat
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 shadow-xl'
                      : 'bg-[#1e222d] text-[#d1d4dc]/40 hover:text-[#d1d4dc] border border-[#2a2e39]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-[10px] text-[#d1d4dc]/40 font-black uppercase tracking-widest px-1 flex items-center gap-1">
              <Tag size={10} /> Tags <span className="text-[8px] opacity-30 lowercase ml-1">(Press Enter)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2 px-1">
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1.5 text-[9px] text-blue-400 font-bold uppercase tracking-tight bg-blue-400/10 px-2 py-1 rounded-md border border-blue-400/20">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-white"><X size={8} /></button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tags..."
              className="w-full bg-[#1e222d] border border-[#2a2e39] rounded-xl px-4 py-2.5 text-xs text-[#d1d4dc] focus:outline-none focus:border-blue-400/30 transition-colors placeholder:text-[#d1d4dc]/10 font-bold"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-2 flex gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 text-[10px] font-black uppercase tracking-widest h-11 rounded-xl text-[#d1d4dc]/40 hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest h-11 rounded-xl shadow-xl shadow-blue-600/20 flex items-center gap-2 disabled:opacity-30 disabled:shadow-none"
          >
            <Save size={14} /> Save Template
          </Button>
        </div>
      </div>
    </div>
  );
};
