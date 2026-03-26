import React, { useEffect, useState, useCallback } from 'react';
import { CategoryTabs } from '../components/news/CategoryTabs';
import { NewsCard } from '../components/news/NewsCard';
import { fetchNews as fetchNewsApi, explainNews } from '../services/newsApi';
import type { NewsItem } from '../services/newsApi';
import { Loader2, BrainCircuit, X, Info, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['all', 'indian', 'global'];

const NewsPage: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [explainingId, setExplainingId] = useState<string | null>(null);
  
  // AI Explanation Modal State
  const [explanation, setExplanation] = useState<string | null>(null);
  const [selectedNewsTitle, setSelectedNewsTitle] = useState<string | null>(null);

  const fetchNews = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const data = await fetchNewsApi(cat);
      setNews(data);
    } catch (error) {
      console.error('Failed to fetch news:', error);
      toast.error('Failed to load news. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(activeCategory);
  }, [activeCategory, fetchNews]);

  const handleExplain = async (id: string, title: string) => {
    setExplainingId(id);
    setSelectedNewsTitle(title);
    try {
      const result = await explainNews(id, 'Beginner');
      setExplanation(result);
    } catch (error) {
      console.error('AI Explanation failed:', error);
      toast.error('AI explanation currently unavailable.');
    } finally {
      setExplainingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-[#0b0e14]">
      <div className="max-w-7xl mx-auto px-4 py-8 lg:px-8">
        
        {/* Header Section */}
        <div className="mb-8 p-6 rounded-md bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-[#2a2e39] overflow-hidden relative">
            <div className="relative z-10">
                <div className="flex items-center gap-2 text-tv-primary mb-2">
                    <BrainCircuit size={20} />
                    <span className="text-xs font-bold uppercase tracking-wider">Market Intelligence</span>
                </div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
                    Global News <span className="text-tv-primary">& AI Insights</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 max-w-2xl">
                    Stay ahead of the markets with real-time news curated from global sources and simplified by AI.
                </p>
            </div>
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-tv-primary/5 blur-[80px] -mr-32 -mt-32 pointer-events-none" />
        </div>

        {/* Categories */}
        <CategoryTabs 
          categories={CATEGORIES} 
          active={activeCategory} 
          onChange={setActiveCategory} 
        />

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-tv-primary animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Fetching market insights...</p>
          </div>
        ) : news.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item) => (
              <NewsCard 
                key={item.id} 
                news={item} 
                onExplain={handleExplain} 
                explaining={explainingId === item.id}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-4">
                <ShieldAlert size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No news found</h3>
            <p className="text-slate-500">Try switching categories or check back later.</p>
          </div>
        )}
      </div>

      {/* AI Explanation Modal */}
      {explanation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1e222d] w-full max-w-2xl rounded-md shadow-2xl border border-slate-200 dark:border-[#363a45] overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-4 border-b border-slate-100 dark:border-[#2a2e39] flex justify-between items-center bg-slate-50 dark:bg-[#1e222d]">
              <div className="flex items-center gap-2 text-tv-primary">
                <BrainCircuit size={20} />
                <span className="text-sm font-bold uppercase">AI News Explainer</span>
              </div>
              <button 
                onClick={() => { setExplanation(null); setSelectedNewsTitle(null); }}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Source Article</h4>
                <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {selectedNewsTitle}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3">
                    <div className="mt-1 p-1 bg-tv-primary/10 text-tv-primary rounded">
                        <Info size={18} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-wide">AI Summary & Impact</h4>
                        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {explanation}
                        </div>
                    </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-[#2a2e39] bg-slate-50 dark:bg-[#1e222d] flex justify-end">
                <button 
                  onClick={() => { setExplanation(null); setSelectedNewsTitle(null); }}
                  className="px-6 py-2 bg-slate-900 dark:bg-tv-primary text-white text-sm font-bold rounded-lg hover:bg-black transition-colors"
                >
                    Got it!
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsPage;
