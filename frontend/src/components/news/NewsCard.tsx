import React from 'react';
import { ExternalLink, BrainCircuit, Clock } from 'lucide-react';
import type { NewsItem } from '../../services/newsApi';

interface NewsCardProps {
  news: NewsItem;
  onExplain: (id: string, title: string, desc: string) => void;
  explaining: boolean;
}

export const NewsCard: React.FC<NewsCardProps> = ({ news, onExplain, explaining }) => {
  const publishedDate = new RegExp(/^\d{4}-\d{2}-\d{2}/).test(news.publishedAt) 
    ? new Date(news.publishedAt).toLocaleString()
    : news.publishedAt;

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'bullish':
      case 'somewhat-bullish':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'bearish':
      case 'somewhat-bearish':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="group relative bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-[#2a2e39] rounded-xl p-5 hover:border-tv-primary/50 transition-all duration-300 shadow-sm hover:shadow-md">
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-bold text-tv-primary uppercase tracking-wider bg-tv-primary/10 px-2 py-0.5 rounded">
          {news.source}
        </span>
        <div className="flex items-center gap-2">
            {news.sentiment && (
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getSentimentColor(news.sentiment)}`}>
                    {news.sentiment}
                </span>
            )}
            <div className="flex items-center text-slate-400 text-xs">
                <Clock size={12} className="mr-1" />
                {publishedDate}
            </div>
        </div>
      </div>

      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 group-hover:text-tv-primary transition-colors line-clamp-2">
        {news.title}
      </h3>
      
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-3 leading-relaxed">
        {news.description}
      </p>

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-[#2a2e39]">
        <a 
          href={news.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center text-xs font-medium text-slate-500 hover:text-tv-primary transition-colors"
        >
          Read Full Article <ExternalLink size={14} className="ml-1" />
        </a>

        <button
          onClick={() => onExplain(news.id, news.title, news.description)}
          disabled={explaining}
          className="flex items-center gap-2 bg-slate-900 dark:bg-tv-primary hover:bg-black dark:hover:bg-tv-primary/80 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all"
        >
          {explaining ? (
            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <BrainCircuit size={16} />
          )}
          {explaining ? 'Analyzing...' : 'Explain with AI'}
        </button>
      </div>
    </div>
  );
};
