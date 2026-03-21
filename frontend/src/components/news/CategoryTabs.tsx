import React from 'react';

interface CategoryTabsProps {
  categories: string[];
  active: string;
  onChange: (category: string) => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ categories, active, onChange }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
            active === cat
              ? 'bg-tv-primary text-white border-tv-primary shadow-lg shadow-tv-primary/20'
              : 'bg-slate-100 dark:bg-[#1e222d] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2a2e39] hover:border-tv-primary/50'
          }`}
        >
          {cat.charAt(0).toUpperCase() + cat.slice(1)}
        </button>
      ))}
    </div>
  );
};
