import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { NewsCard } from '../components/news/NewsCard';
import { fetchNews as fetchNewsApi, explainNews } from '../services/newsApi';
import type { NewsItem } from '../services/newsApi';
import { Loader2, BrainCircuit, X, Info, ShieldAlert, Sparkles, Zap, ArrowRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['all', 'indian', 'global'];

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  indian: 'India',
  global: 'Global',
};

// Using Bing proxy to reliably resolve dynamic market imagery
// Using Bing Image Search for highly reliable, realistic market imagery
const FALLBACK_HERO = `https://tse1.mm.bing.net/th?q=${encodeURIComponent("global financial market news trading floor")}&w=1600&h=900&c=7&rs=1&p=0`;

const NewsPage: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  // AI Explanation Modal State
  const [explanation, setExplanation] = useState<string | null>(null);
  const [selectedNewsTitle, setSelectedNewsTitle] = useState<string | null>(null);

  const fetchNews = useCallback(async (cat: string, opts?: { background?: boolean }) => {
    const shouldBackgroundRefresh = opts?.background ?? false;
    if (!shouldBackgroundRefresh || !hasLoadedRef.current) {
      setLoading(true);
    }
    try {
      const parsePublishedAt = (value?: string): number | null => {
        if (!value) return null;
        const direct = new Date(value).getTime();
        if (!Number.isNaN(direct)) return direct;

        const compact = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
        if (compact) {
          const [, y, m, d, hh, mm, ss] = compact;
          const asIso = `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
          const parsed = new Date(asIso).getTime();
          if (!Number.isNaN(parsed)) return parsed;
        }
        return null;
      };

      let data = await fetchNewsApi(cat, 36);
      if (cat !== 'all' && data.length === 0) {
        // Automatic fallback so category dead-ends don't blank the page.
        data = await fetchNewsApi('all', 36);
      }

      const cutoff = Date.now() - 96 * 60 * 60 * 1000;
      const withTs = data.map(item => ({ item, ts: parsePublishedAt(item.publishedAt) }));
      const freshData = withTs.filter(({ ts }) => ts !== null && ts >= cutoff);
      const sourceData = freshData.length > 0 ? freshData : withTs;
      const sortedData = sourceData.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));

      const finalData = sortedData.map(({ item }) => item).slice(0, 100);
      setNews(finalData);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error('Failed to fetch news:', error);
      toast.error('Failed to load news. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(activeCategory);

    // Auto-refresh every 20 minutes
    const interval = setInterval(() => {
      fetchNews(activeCategory, { background: true });
    }, 1200000);

    return () => clearInterval(interval);
  }, [activeCategory, fetchNews]);

  const handleExplain = async (id: string, title: string, description?: string) => {
    setExplainingId(id);
    setSelectedNewsTitle(title);
    try {
      const result = await explainNews(id, 'Beginner', title, description);
      setExplanation(result);
    } catch (error) {
      console.error('AI Explanation failed:', error);
      setExplanation(
        "AI explainer is temporarily under load. Key takeaway: focus on how this headline can affect earnings expectations, liquidity, and sector sentiment over the next session."
      );
      toast.error('AI explanation is running in fallback mode.');
    } finally {
      setExplainingId(null);
    }
  };

  const featuredNews = useMemo(() => news[0], [news]);
  const [heroImg, setHeroImg] = useState<string | undefined>();

  useEffect(() => {
    if (featuredNews) {
      setHeroImg(featuredNews.imageUrl || FALLBACK_HERO);
    }
  }, [featuredNews]);

  const sections = useMemo(() => {
    const regularNews = news.slice(1);
    
    // Get IST Date Strings for boundary matching
    const getISTDateStr = (date: Date) => 
      date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

    const now = new Date();
    const todayStr = getISTDateStr(now);
    
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yesterdayStr = getISTDateStr(yest);

    const tda = new Date();
    tda.setDate(tda.getDate() - 2);
    const twoDaysAgoStr = getISTDateStr(tda);

    const todayList = regularNews.filter(item => getISTDateStr(new Date(item.publishedAt)) === todayStr);
    const yesterdayList = regularNews.filter(item => getISTDateStr(new Date(item.publishedAt)) === yesterdayStr);
    const twoDaysAgoList = regularNews.filter(item => getISTDateStr(new Date(item.publishedAt)) === twoDaysAgoStr);

    return {
      today: todayList,
      yesterday: yesterdayList,
      twoDaysAgo: twoDaysAgoList,
      older: regularNews.filter(item => {
        const dStr = getISTDateStr(new Date(item.publishedAt));
        return dStr !== todayStr && dStr !== yesterdayStr && dStr !== twoDaysAgoStr;
      })
    };
  }, [news]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-transparent relative">
      <div className="ambient-dot-grid" />

      <div className="max-w-7xl mx-auto px-4 py-8 lg:px-8 relative z-10">

        {/* Header Section */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in slide-in-from-top duration-700">
          <div>
            <div className="flex items-center gap-2 text-tv-primary mb-3">
              <div className="p-1.5 bg-tv-primary/10 rounded-lg">
                <Zap size={18} fill="currentColor" />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.2em]">Live Intelligence Feed</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black dark:text-white mb-4 tracking-tight">
              Market <span className="text-transparent bg-clip-text bg-gradient-to-r from-tv-primary to-cyan-400">Pulse</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl text-lg font-medium leading-relaxed">
              Real-time global financial insights powered by AI analysis to keep you ahead of every market move.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Connected to Terminal</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-widest">
              <span>Next Refresh: <span className="text-slate-700 dark:text-slate-300">Syncing...</span></span>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span>Sources: <span className="text-slate-700 dark:text-slate-300">24+</span></span>
            </div>
          </div>
        </div>

        {/* Categories Tab Bar */}
        <div className="mb-8 p-1 bg-white/5 backdrop-blur-md border border-white/5 rounded-2xl inline-flex items-center gap-1 animate-in fade-in duration-1000 delay-300">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeCategory === cat
                ? 'bg-tv-primary text-white shadow-lg shadow-tv-primary/20 scale-100'
                : 'text-slate-400 hover:text-white hover:bg-white/5 active:scale-95'
                }`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-500">
            <div className="relative">
              <Loader2 className="h-16 w-16 text-tv-primary animate-spin mb-6" />
              <div className="absolute inset-0 blur-xl bg-tv-primary/20 animate-pulse" />
            </div>
            <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-sm">
              Loading {CATEGORY_LABELS[activeCategory] || activeCategory} Feed
            </p>
          </div>
        ) : news.length > 0 ? (
          <div className="space-y-12">

            {/* Hero / Featured News */}
            {activeCategory === 'all' && featuredNews && (
              <div className="group relative w-full min-h-[450px] lg:min-h-[550px] flex flex-col justify-end rounded-3xl overflow-hidden border border-white/10 hover:border-emerald-500/50 transition-all duration-700 animate-in fade-in slide-in-from-bottom duration-1000 shadow-2xl hover:shadow-emerald-500/10">

                <img
                  src={heroImg}
                  alt={featuredNews.title}
                  referrerPolicy="no-referrer"
                  onError={() => { 
                    setHeroImg(`https://image.pollinations.ai/prompt/${encodeURIComponent(featuredNews?.title || 'financial market news')}&width=1600&height=900&nologo=true`); 
                  }}
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/75 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0b0e14]/85 via-transparent to-transparent" />

                <div className="relative p-8 md:p-10 lg:p-12 w-full max-w-4xl z-20">
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    <span className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-md shadow-xl">
                      Featured Highlight
                    </span>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                      {featuredNews.source} • {new Date(featuredNews.publishedAt).toLocaleString('en-IN', { 
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false,
                        timeZone: 'Asia/Kolkata' 
                      })}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-5xl font-black text-white mb-5 leading-[1.1] tracking-tight group-hover:text-emerald-400 transition-colors cursor-pointer">
                    {featuredNews.title}
                  </h2>
                  <p className="text-slate-300 text-base md:text-lg lg:text-xl font-medium mb-8 max-w-3xl opacity-90 leading-relaxed">
                    {featuredNews.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      onClick={() => handleExplain(featuredNews.id, featuredNews.title, featuredNews.description)}
                      disabled={explainingId === featuredNews.id}
                      className="flex items-center gap-2 bg-white text-black px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-tv-primary hover:text-white transition-all transform active:scale-95 disabled:opacity-50"
                    >
                      <BrainCircuit size={18} />
                      {explainingId === featuredNews.id ? 'Analyzing...' : 'AI Perspective'}
                    </button>
                    <a
                      href={featuredNews.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest text-white border border-white/20 hover:bg-white/10 transition-all"
                    >
                      Read Article <ExternalLink size={18} />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Today's News Section */}
            {sections.today.length > 0 && (
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    Today's Pulse
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-white/10 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {sections.today.map((item, idx) => (
                    <div
                      key={item.id}
                      className="animate-in fade-in slide-in-from-bottom duration-700 fill-mode-both"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <NewsCard
                        news={item}
                        onExplain={handleExplain}
                        explaining={explainingId === item.id}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Yesterday's News Section */}
            {sections.yesterday.length > 0 && (
              <div className="space-y-8 mt-16">
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    Yesterday's Insights
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-white/10 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {sections.yesterday.map((item, idx) => (
                    <div
                      key={item.id}
                      className="animate-in fade-in slide-in-from-bottom duration-700 fill-mode-both"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <NewsCard
                        news={item}
                        onExplain={handleExplain}
                        explaining={explainingId === item.id}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2rd Day News Section */}
            {sections.twoDaysAgo.length > 0 && (
              <div className="space-y-8 mt-16">
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    Market Legacy: 2 Days Ago
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-white/10 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {sections.twoDaysAgo.map((item, idx) => (
                    <div
                      key={item.id}
                      className="animate-in fade-in slide-in-from-bottom duration-700 fill-mode-both"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <NewsCard
                        news={item}
                        onExplain={handleExplain}
                        explaining={explainingId === item.id}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Older Catch-all Section */}
            {sections.older.length > 0 && (
              <div className="space-y-8 mt-16">
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    Recent Market Memory
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-white/10 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {sections.older.map((item, idx) => (
                    <div
                      key={item.id}
                      className="animate-in fade-in slide-in-from-bottom duration-700 fill-mode-both"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <NewsCard
                        news={item}
                        onExplain={handleExplain}
                        explaining={explainingId === item.id}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-32 bg-white/5 rounded-3xl border border-white/5 animate-in zoom-in duration-500">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-slate-800 text-slate-400 mb-6 shadow-2xl">
              <ShieldAlert size={48} />
            </div>
            <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tighter">Transmission Interrupted</h3>
            <p className="text-slate-500 font-medium max-w-xs mx-auto">No news nodes found in the current frequency. Try another category.</p>
            <button
              onClick={() => setActiveCategory('all')}
              className="mt-8 px-8 py-3 bg-tv-primary/10 text-tv-primary border border-tv-primary/20 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-tv-primary hover:text-white transition-all"
            >
              Reset Frequency
            </button>
          </div>
        )}
      </div>

      {/* AI Explanation Modal */}
      {explanation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#1c212d] w-full max-w-3xl rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">

            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#1e222d]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-tv-primary/20 text-tv-primary rounded-xl">
                  <Sparkles size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-tv-primary leading-none">AI Neural Insight</span>
                  <h3 className="text-xl font-black text-white leading-tight">Advanced Interpretation</h3>
                </div>
              </div>
              <button
                onClick={() => { setExplanation(null); setSelectedNewsTitle(null); }}
                className="p-3 hover:bg-white/5 rounded-2xl transition-colors group"
              >
                <X size={24} className="text-slate-500 group-hover:text-white transition-colors" />
              </button>
            </div>

            <div className="p-10 overflow-y-auto custom-scrollbar space-y-10">
              <div className="relative">
                <div className="absolute -left-6 top-0 bottom-0 w-1 bg-tv-primary/30 rounded-full" />
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-3">Context Node</h4>
                <p className="text-2xl font-black text-white leading-[1.3] tracking-tight">
                  {selectedNewsTitle}
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3 text-emerald-400">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                    <Info size={16} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Summary & Strategic Impact</span>
                </div>
                <div className="text-lg text-slate-300 font-medium leading-[1.8] whitespace-pre-wrap selection:bg-tv-primary selection:text-white">
                  {explanation}
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-white/5 bg-[#1e222d] flex justify-end">
              <button
                onClick={() => { setExplanation(null); setSelectedNewsTitle(null); }}
                className="group flex items-center gap-3 px-6 sm:px-10 py-3 sm:py-5 bg-tv-primary text-white text-xs sm:text-sm font-black uppercase tracking-[0.2em] rounded-2xl sm:rounded-[1.5rem] hover:bg-tv-primary-dark transition-all shadow-2xl active:scale-95"
              >
                Acknowledge Pulse <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NewsPage;
