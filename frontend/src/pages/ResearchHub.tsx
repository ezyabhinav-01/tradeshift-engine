import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  BarChart3, 
   
   
  Brain, 
   
   
  Layers,
  Sparkles,
  Newspaper,
  CalendarDays,
  ArrowRight
} from 'lucide-react';
import RatioGrid from '../components/features/analysis/RatioGrid';
import FinancialCharts from '../components/features/analysis/FinancialCharts';
import AIAnalyst from '../components/features/analysis/AIAnalyst';
import { fetchNews as fetchNewsApi } from '../services/newsApi';
import type { NewsItem } from '../services/newsApi';

const ResearchHub: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLaymanMode, setIsLaymanMode] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/stock/${symbol}/profile`);
        setProfile(response.data);
      } catch (error) {
        console.error("Error fetching stock profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchStockNews = async () => {
      try {
        const data = await fetchNewsApi(symbol || 'markets', 3);
        setNews(data);
      } catch (err) {
        console.error("Error fetching stock news", err);
      }
    };

    if (symbol) {
      fetchProfile();
      fetchStockNews();
    }
  }, [symbol]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-[#050505] relative overflow-y-auto overflow-x-hidden text-gray-100 font-sans pb-12 custom-scrollbar">
      {/* Dynamic Background */}
      <div className="absolute top-0 inset-x-0 h-[500px] w-full bg-gradient-to-b from-primary/10 via-blue-500/5 to-transparent pointer-events-none"></div>
      <div className="absolute -top-[300px] -right-[200px] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="relative z-10 p-6 space-y-8 max-w-7xl mx-auto mt-4">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/[0.02] p-8 rounded-3xl border border-white/10 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-white">{symbol}</h1>
            <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium border border-primary/30">
              EQUITY
            </span>
          </div>
          <p className="text-gray-400 text-sm max-w-lg leading-relaxed">
            Institutional-grade deep dive and fundamental analysis powered by FinGPT. Master the mechanics behind the numbers.
          </p>
          </div>

        <div className="flex bg-slate-100 dark:bg-black/40 p-1 rounded-md border border-slate-200 dark:border-white/10">
          <button className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer ${!isLaymanMode ? 'bg-blue-600 dark:bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white'}`} onClick={() => setIsLaymanMode(false)}>
            Professional
          </button>
          <button className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer ${isLaymanMode ? 'bg-green-600 dark:bg-green-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white'}`} onClick={() => setIsLaymanMode(true)}>
            <Brain className="w-4 h-4" />
            Layman Explain
          </button>
        </div>
      </div>

      {/* Company Overview & Metrics (Screener.in style) */}
      {profile?.fundamentals && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full mt-4">
          
          {/* 3x3 Metrics Card */}
          <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/5 shadow-2xl rounded-3xl p-8 relative overflow-hidden">
             
             {/* Title & Actions */}
             <div className="flex justify-between flex-wrap gap-4 items-center border-b border-white/5 pb-6 mb-6">
                <div>
                   <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                     {profile.fundamentals.current_price ? `₹${profile.fundamentals.current_price.toLocaleString()}` : ''}
                     <span className="text-sm font-medium px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                       -1.2%
                     </span>
                   </h2>
                   <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-bold">NSE: {symbol} · BSE: 500{symbol?.length || '000'}</p>
                </div>
                <div className="flex items-center gap-3">
                   <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg border border-white/10 transition-colors uppercase tracking-wider">
                     Export to Excel
                   </button>
                   <button className="px-6 py-2 bg-primary text-black text-xs font-black rounded-lg shadow-lg hover:bg-primary/90 transition-all uppercase tracking-wider">
                     + Follow
                   </button>
                </div>
             </div>

             {/* 3 columns grid */}
             <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-4">
                <div className="flex justify-between items-center md:items-start md:flex-col md:gap-2 border-b border-white/5 pb-3 md:border-none md:pb-0">
                  <span className="text-gray-500 text-xs uppercase font-bold tracking-wider">Market Cap</span>
                  <span className="text-white font-black text-xl">₹{profile.fundamentals.market_cap?.toLocaleString()} <span className="text-xs text-gray-500 font-bold uppercase">Cr.</span></span>
                </div>
                
                <div className="flex justify-between items-center md:items-start md:flex-col md:gap-2 border-b border-white/5 pb-3 md:border-none md:pb-0">
                  <span className="text-gray-500 text-xs uppercase font-bold tracking-wider">Current Price</span>
                  <span className="text-white font-black text-xl">₹{profile.fundamentals.current_price || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center md:items-start md:flex-col md:gap-2 border-b border-white/5 pb-3 md:border-none md:pb-0">
                  <span className="text-gray-500 text-xs uppercase font-bold tracking-wider">High / Low</span>
                  <span className="text-white font-black text-xl">₹{profile.fundamentals.high_52w || 'N/A'} <span className="text-gray-600 font-normal">/</span> {profile.fundamentals.low_52w || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center md:items-start md:flex-col md:gap-2 border-b border-white/5 pb-3 md:border-none md:pb-0">
                  <span className="text-gray-500 text-xs uppercase font-bold tracking-wider">Stock P/E</span>
                  <span className="text-white font-black text-xl">{profile.fundamentals.pe_ratio}</span>
                </div>

                <div className="flex justify-between items-center md:items-start md:flex-col md:gap-2 border-b border-white/5 pb-3 md:border-none md:pb-0">
                  <span className="text-gray-500 text-xs uppercase font-bold tracking-wider">Book Value</span>
                  <span className="text-white font-black text-xl">₹{profile.fundamentals.book_value || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center md:items-start md:flex-col md:gap-2 border-b border-white/5 pb-3 md:border-none md:pb-0">
                  <span className="text-gray-500 text-xs uppercase font-bold tracking-wider">Dividend Yield</span>
                  <span className="text-white font-black text-xl">{profile.fundamentals.dividend_yield}%</span>
                </div>

                <div className="flex justify-between items-center md:items-start md:flex-col md:gap-2 border-b border-white/5 pb-3 md:border-none md:pb-0 mt-2 md:mt-0">
                  <span className="text-gray-500 text-xs uppercase font-bold tracking-wider">ROCE</span>
                  <span className="text-white font-black text-xl">{profile.fundamentals.roce}%</span>
                </div>

                <div className="flex justify-between items-center md:items-start md:flex-col md:gap-2 border-b border-white/5 pb-3 md:border-none md:pb-0 mt-2 md:mt-0">
                  <span className="text-gray-500 text-xs uppercase font-bold tracking-wider">ROE</span>
                  <span className="text-white font-black text-xl">{profile.fundamentals.roe}%</span>
                </div>

                <div className="flex justify-between items-center md:items-start md:flex-col md:gap-2 mt-2 md:mt-0">
                  <span className="text-gray-500 text-xs uppercase font-bold tracking-wider">Face Value</span>
                  <span className="text-white font-black text-xl">₹{profile.fundamentals.face_value || 'N/A'}</span>
                </div>
             </div>
             
             {/* Edit Ratios Input mock */}
             <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="flex-1 max-w-sm relative">
                  <input type="text" placeholder="Add ratio to table (eg. Promoter holding)" className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 px-4 text-xs text-white focus:border-primary/50 outline-none" />
                </div>
                <button className="text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-primary/10 px-3 py-1.5 rounded-md transition-colors">
                  EDIT RATIOS
                </button>
             </div>
          </div>

          {/* About Section */}
          <div className="bg-[#0a0a0a] border border-white/5 shadow-2xl rounded-3xl p-8 space-y-8 h-full">
              <div>
                <h3 className="text-sm font-black tracking-widest uppercase text-white mb-4 flex items-center gap-2">
                  About <button className="text-[10px] text-blue-400 font-normal hover:underline lowercase tracking-normal">[edit]</button>
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed font-medium">
                  {profile.fundamentals.about || `${symbol} is a publicly traded company on the Indian stock exchanges.`}
                </p>
              </div>
              
              {profile.fundamentals.key_points && (
                <div>
                  <h3 className="text-sm font-black tracking-widest uppercase text-white mb-4 flex items-center gap-2">
                    Key Points <button className="text-[10px] text-blue-400 font-normal hover:underline lowercase tracking-normal">[edit]</button>
                  </h3>
                  <div className="space-y-5 text-sm">
                    {Object.entries(profile.fundamentals.key_points).map(([key, val]) => (
                       <div key={key}>
                         <span className="font-bold text-gray-200 block mb-1 text-[15px]">{key}</span>
                         <span className="text-gray-400 whitespace-pre-line leading-relaxed block">{val as string}</span>
                       </div>
                    ))}
                  </div>
                </div>
              )}
              
              <button className="text-primary text-xs font-bold uppercase tracking-wider hover:underline">
                READ MORE &gt;
              </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-2">
        {/* Left Content: Fundamentals & Charts */}
        <div className="xl:col-span-2 space-y-8">
          {/* Key Metrics Grid */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Layers className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Key Fundamental Ratios</h2>
            </div>
            <RatioGrid data={profile?.fundamentals} isLaymanMode={isLaymanMode} />
          </section>

          {/* Quarterly Performance Table */}
          {profile?.quarterly_performance && (
            <section className="space-y-4 pt-4">
              <div className="flex items-center gap-2 px-1">
                <CalendarDays className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Quarterly Performance</h2>
              </div>
              <div className="bg-[#0a0a0a] rounded-md border border-white/5 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02]">
                        <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-gray-400">Quarter</th>
                        {profile.quarterly_performance.map((q: any) => (
                          <th key={q.quarter} className="py-4 px-6 text-xs font-bold tracking-wider text-white text-right">{q.quarter}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-6 font-medium text-gray-300">Revenue <span className="text-[10px] text-gray-500 ml-1">(Cr.)</span></td>
                        {profile.quarterly_performance.map((q: any) => (
                          <td key={`rev-${q.quarter}`} className="py-4 px-6 text-right font-bold text-white">₹{q.revenue.toLocaleString()}</td>
                        ))}
                      </tr>
                      <tr className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-6 font-medium text-gray-300">Net Profit <span className="text-[10px] text-gray-500 ml-1">(Cr.)</span></td>
                        {profile.quarterly_performance.map((q: any) => (
                          <td key={`np-${q.quarter}`} className="py-4 px-6 text-right font-bold text-green-400">₹{q.net_profit.toLocaleString()}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Financial Visualizations */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Yearly Financial Growth</h2>
            </div>
            <div className="bg-[#0a0a0a] p-6 rounded-md border border-white/5 h-[400px]">
              <FinancialCharts data={profile?.financials} />
            </div>
          </section>
        </div>

        {/* Right Content: AI Analyst Section */}
        <div className="space-y-8">
          <section className="space-y-4 h-full">
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <h2 className="text-xl font-semibold">The AI's Thesis</h2>
            </div>
            <div className="flex-1 min-h-[400px]">
                <AIAnalyst symbol={symbol || ''} isLaymanMode={isLaymanMode} />
            </div>
          </section>

          {/* Latest News & Insights */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Latest Insights</h2>
              </div>
            </div>
            <div className="space-y-4">
              {news.length > 0 ? (
                news.map((item) => (
                  <a 
                    key={item.id} 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block group bg-[#0a0a0a] p-5 rounded-md border border-white/5 hover:border-primary/30 transition-all hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <h4 className="font-bold text-sm text-white group-hover:text-primary transition-colors line-clamp-2 leading-relaxed">
                        {item.title}
                      </h4>
                      <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-primary flex-shrink-0 transition-colors" />
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
                      {item.description}
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-[10px] uppercase font-bold text-gray-600 tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 block"></span>
                        {item.source}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        item.sentiment === 'Bullish' ? 'bg-green-500/10 text-green-500' : 
                        item.sentiment === 'Bearish' ? 'bg-red-500/10 text-red-500' : 
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {item.sentiment}
                      </span>
                    </div>
                  </a>
                ))
              ) : (
                <div className="text-center py-8 bg-[#0a0a0a] rounded-md border border-white/5 text-sm text-gray-500">
                  No recent insights available for this symbol.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ResearchHub;
