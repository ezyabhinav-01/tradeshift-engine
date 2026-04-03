import React, { useState, useEffect } from 'react';
import { BrainCircuit, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { NewsItem } from '../../services/newsApi';

interface NewsCardProps {
  news: NewsItem;
  onExplain: (id: string, title: string, desc: string) => void;
  explaining: boolean;
}



import '@/styles/NewsCardMagazine.css';

export const NewsCard: React.FC<NewsCardProps> = ({ news, onExplain, explaining }) => {
  const [imgSrc, setImgSrc] = useState(news.imageUrl || `https://image.pollinations.ai/prompt/${encodeURIComponent(news.title + " global stock market trading professional 4k")}&width=800&height=500&nologo=true`);
  const [errorStage, setErrorStage] = useState(0); 
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  const handleCardClick = () => {
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 400);
  };

  // Sync state if news item changes
  useEffect(() => {
    setImgSrc(news.imageUrl || `https://image.pollinations.ai/prompt/${encodeURIComponent(news.title + " financial news trading professional cinematic")}&width=800&height=500&nologo=true`);
    setErrorStage(0);
    setHasError(false);
    setIsLoading(true);
  }, [news.id, news.imageUrl, news.title]);


  const publishedDate = new Date(news.publishedAt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata'
  });

  const getSentimentDetails = (sentiment?: string) => {
    const s = sentiment?.toLowerCase() || '';
    if (s.includes('bullish')) {
      return {
        color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
        icon: <TrendingUp size={12} />,
        label: 'Bullish',
        sentimentClass: 'bullish'
      };
    } else if (s.includes('bearish')) {
      return {
        color: 'text-rose-400 bg-rose-500/20 border-rose-500/30',
        icon: <TrendingDown size={12} />,
        label: 'Bearish',
        sentimentClass: 'bearish'
      };
    }
    return {
      color: 'text-slate-400 bg-slate-500/20 border-slate-500/30',
      icon: <Minus size={12} />,
      label: 'Neutral',
      sentimentClass: 'neutral'
    };
  };

  const sentiment = getSentimentDetails(news.sentiment);

  const handleImageError = () => {
    if (errorStage === 0) {
      setErrorStage(1);
      setImgSrc(`https://image.pollinations.ai/prompt/${encodeURIComponent(news.title + " global stock market trading professional 4k")}&width=800&height=500&nologo=true&seed=${news.id}`);
    } else if (errorStage === 1) {
      setErrorStage(2);
      setImgSrc(`https://images.unsplash.com/photo-1611974717482-482bc9eeaf43?auto=format&fit=crop&w=800&q=80`);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`news-card-magazine group relative flex flex-col h-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden ${sentiment.sentimentClass} ${isClicking ? 'click-zoom-effect' : ''}`}
    >
      
      {/* 1. Header Image (Magazine Style) */}
      <div className="magazine-image-wrap w-full border-b border-slate-100 dark:border-white/5">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-slate-100 dark:bg-slate-900 animate-pulse" />
        )}

        {!hasError && (
          <img
            src={imgSrc}
            alt={news.title}
            onLoad={() => setIsLoading(false)}
            onError={handleImageError}
            className={`w-full h-full object-cover grayscale-[0.2] transition-all duration-[1.5s] group-hover:grayscale-0 relative z-10 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          />
        )}

        {/* Floating Metadata Glassy Chips */}
        <div className="magazine-metadata-bar">
          <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest bg-slate-100/90 dark:bg-black/40 backdrop-blur-md text-slate-800 dark:text-white/80 border border-slate-200 dark:border-white/10 rounded-md shadow-sm">
            {news.source}
          </span>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[9px] font-black uppercase tracking-widest backdrop-blur-md ${sentiment.color}`}>
            {sentiment.icon}
            {sentiment.label}
          </div>
        </div>
      </div>

      {/* 2. High-Contrast Content Section (Perfect Legibility) */}
      <div className="news-content-section bg-white dark:bg-[#0d1117] group-hover:bg-slate-50 dark:group-hover:bg-[#11161d] transition-colors duration-500">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-[1.3] tracking-tight group-hover:text-emerald-600 dark:group-hover:text-tv-primary transition-colors">
          {news.title}
        </h3>

        {/* 3. Narrative Hover Reveal (Insight line) */}
        <p className="narrative-insight italic line-clamp-1 text-slate-600 dark:text-slate-400 group-hover:text-emerald-500 dark:group-hover:text-slate-100">
          "{news.description.substring(0, 100)}..."
        </p>

        <div className="mt-auto flex items-center justify-between pt-5 border-t border-slate-100 dark:border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
           <div className="flex items-center text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
            <Clock size={11} className="mr-1.5 opacity-50" />
            {publishedDate}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onExplain(news.id, news.title, news.description); }}
            disabled={explaining}
            className="flex items-center gap-2 bg-emerald-500/10 dark:bg-tv-primary/10 hover:bg-emerald-600 dark:hover:bg-tv-primary text-emerald-600 dark:text-tv-primary hover:text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all border border-emerald-500/20 dark:border-tv-primary/20"
          >
            {explaining ? (
              <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <BrainCircuit size={13} />
            )}
            Insight
          </button>
        </div>
      </div>

      {/* High-end Corner Light Artifact */}
      <div className="absolute inset-0 pointer-events-none border border-transparent group-hover:border-black/5 dark:group-hover:border-white/5 rounded-3xl transition-colors duration-700" />
    </div>

  );
};
