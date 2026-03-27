import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ArrowUpRight,
  BrainCircuit,
  BarChart3,
  Zap,
  Target,
  Sparkles,
  ChevronRight,
  Info,
  Search,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import TradingViewWidget from '@/components/ui/TradingViewWidget';
import { SCREENER_WIDGET_CONFIG } from '@/lib/constants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Candidate {
  symbol: string;
  name: string;
  market_cap: number;
  pe_ratio: number;
  roce: number;
  roe: number;
  revenue_growth: number;
  conviction_score: number;
  sector: string;
  persona: string;
  varsity_tip: string;
}

// No API_BASE needed when using proxy for relative paths

const ScreenerPage: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<keyof Candidate>('conviction_score');
  const [category, setCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCandidates = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/screener/multibagger`);
        setCandidates(response.data.candidates);
        setFilteredCandidates(response.data.candidates);
      } catch (error) {
        console.error("Failed to fetch screener candidates:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCandidates();
  }, []);

  useEffect(() => {
    let result = [...candidates];


    // Sort
    result.sort((a, b) => {
      const valA = a[sortBy] as number;
      const valB = b[sortBy] as number;
      return valB - valA; // Descending
    });

    // Filter by sector/category if needed
    if (category !== 'All') {
      result = result.filter(c => c.sector.includes(category) || c.name.includes(category));
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.symbol.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query)
      );
    }

    setFilteredCandidates(result);
  }, [sortBy, category, searchQuery, candidates]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] h-full">
        <div className="relative">
          <div className="w-16 h-16 border-t-4 border-primary rounded-full animate-spin"></div>
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary w-6 h-6" />
        </div>
        <p className="mt-4 text-slate-500 dark:text-tv-text-secondary animate-pulse font-medium">FinGPT Scanning NSE Markets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-4 lg:px-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-blue-500/5 to-slate-100 dark:to-[#050505] border border-slate-200 dark:border-white/5 p-8 shadow-sm dark:shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <div className="px-2 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded text-[10px] font-black uppercase tracking-widest border border-amber-500/30">
                Varsity Powered
              </div>
              <span className="text-slate-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <BrainCircuit className="w-3 h-3" />
                Adaptive Learning Engine
              </span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
              Multibagger <span className="text-primary italic">Academy</span>
            </h1>
            <p className="text-slate-500 dark:text-gray-400 max-w-xl text-sm leading-relaxed">
              Unlock potential 10x picks with our AI-driven fundamental scanner.
              We analyze 10+ years of financials and market data to surface
              high-efficiency compounders before they go mainstream.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="p-5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-md backdrop-blur-xl group hover:border-primary/50 transition-all">
              <div className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase mb-1 flex items-center gap-2">
                <Target className="w-3 h-3" />
                Market Coverage
              </div>
              <div className="text-3xl font-black text-slate-800 dark:text-white group-hover:text-primary transition-colors">Global</div>
            </div>
            <div className="p-5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-md backdrop-blur-xl group hover:border-green-500/50 transition-all text-center">
              <div className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase mb-1">Status</div>
              <div className="text-3xl font-black text-green-500">Live</div>
            </div>
          </div>
        </div>


        {/* Background blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[60px] -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-[50px] -ml-24 -mb-24"></div>
      </div>

      <Tabs defaultValue="multibagger" className="w-full">
        <TabsList className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 p-1 mb-8 shadow-sm dark:shadow-none">
          <TabsTrigger value="multibagger" className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:border-primary text-slate-500 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white shadow-none data-[state=active]:shadow-sm dark:data-[state=active]:shadow-none">
            <Zap className="w-4 h-4" />
            Multibagger Academy
          </TabsTrigger>
          <TabsTrigger value="pro" className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:border-primary text-slate-500 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white shadow-none data-[state=active]:shadow-sm dark:data-[state=active]:shadow-none">
            <Filter className="w-4 h-4" />
            Professional Screener
          </TabsTrigger>
        </TabsList>

        <TabsContent value="multibagger" className="space-y-8 mt-0">
          {/* Filters, Search & Sorting */}
          <div className="flex flex-col lg:flex-row gap-6 items-center justify-between bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-md">
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              {['All', 'Banking', 'Energy', 'IT', 'Consumer', 'FMCG'].map(cat => (
                <Button
                  key={cat}
                  variant="ghost"
                  size="sm"
                  onClick={() => setCategory(cat)}
                  className={`rounded-xl text-xs font-bold ${category === cat ? 'bg-primary text-white hover:bg-primary/90' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5'}`}
                >
                  {cat}
                </Button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto justify-center">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-primary/50 transition-colors placeholder:text-slate-400 dark:placeholder:text-gray-600"
                />
                <Search className="w-4 h-4 text-slate-400 dark:text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              <div className="flex items-center gap-3 bg-slate-100 dark:bg-black/20 p-2 rounded-xl border border-slate-200 dark:border-white/5">
                <span className="text-[10px] uppercase font-black text-slate-400 dark:text-gray-500 tracking-tighter pl-2">Sort By:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as keyof Candidate)}
                  className="bg-transparent text-sm font-bold text-slate-700 dark:text-white border-none focus:ring-0 cursor-pointer outline-none"
                >
                  <option value="conviction_score" className="bg-white dark:bg-[#121212]">FinGPT Conviction</option>
                  <option value="roce" className="bg-white dark:bg-[#121212]">Efficiency (ROCE)</option>
                  <option value="revenue_growth" className="bg-white dark:bg-[#121212]">Growth Rate</option>
                  <option value="market_cap" className="bg-white dark:bg-[#121212]">Market Size</option>
                </select>
              </div>
            </div>
          </div>

          {/* Grid of Potential Multi-baggers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 m-3">
            {filteredCandidates.map((stock, idx) => (
              <div
                key={stock.symbol}
                className="group relative bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 rounded-md p-6 hover:border-primary/50 transition-all duration-500 hover:shadow-[0_0_30px_-10px_rgba(59,130,246,0.2)] dark:hover:shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)] flex flex-col justify-between shadow-sm"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{stock.symbol}</h3>
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      </div>
                      <p className="text-xs text-slate-400 dark:text-gray-500 font-medium truncate max-w-[150px]">{stock.name}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="px-2 py-1 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-1.5 mr-2">
                        <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-black text-primary p-1">{stock.conviction_score}%</span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-gray-600 mt-1 uppercase font-bold tracking-tighter">Conviction Score</span>
                    </div>
                  </div>

                  {/* Fundamental Badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px] font-black uppercase flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {stock.persona}
                    </span>
                    <span className="px-2 py-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-md text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">{stock.sector}</span>
                  </div>

                  {/* Varsity Tip */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/10 rounded-md relative group/tip">
                    <div className="flex items-center gap-2 mb-1">
                      <BrainCircuit className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                      <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-tighter">Why this stock?</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-gray-500 leading-relaxed italic line-clamp-2 group-hover/tip:line-clamp-none transition-all">
                      "{stock.varsity_tip}"
                    </p>
                  </div>

                  {/* Main Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-2 pt-2">
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 dark:text-gray-500 flex items-center gap-1 uppercase font-bold tracking-wider">
                        <Zap className="w-3 h-3 text-amber-400" />
                        ROCE
                      </div>
                      <div className="text-lg font-black text-slate-800 dark:text-white">{stock.roce}%</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 dark:text-gray-500 flex items-center gap-1 uppercase font-bold tracking-wider">
                        <Target className="w-3 h-3 text-emerald-400" />
                        ROE
                      </div>
                      <div className="text-lg font-black text-slate-800 dark:text-white">{stock.roe || (stock.roce > 0 ? (stock.roce - 2).toFixed(1) : 0)}%</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 dark:text-gray-500 flex items-center gap-1 uppercase font-bold tracking-wider">
                        <ArrowUpRight className="w-3 h-3 text-blue-400" />
                        Rev Growth
                      </div>
                      <div className="text-lg font-black text-slate-800 dark:text-white">{stock.revenue_growth}%</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 dark:text-gray-500 flex items-center gap-1 uppercase font-bold tracking-wider">
                        <Target className="w-3 h-3 text-primary" />
                        PE Ratio
                      </div>
                      <div className="text-lg font-black text-slate-800 dark:text-white">{stock.pe_ratio}x</div>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <div className="text-[10px] text-slate-400 dark:text-gray-500 flex items-center gap-1 uppercase font-bold tracking-wider">
                        <BarChart3 className="w-3 h-3 text-purple-400" />
                        Market Cap
                      </div>
                      <div className="text-lg font-black text-slate-800 dark:text-white">₹{(stock.market_cap / 1000).toFixed(1)}k Cr</div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => navigate(`/research/${stock.symbol}`)}
                  className="w-full mt-4 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-blue-600 hover:text-white hover:border-transparent transition-all duration-300 rounded-xl group-hover:translate-y-[-2px]"
                >
                  Start Deep Learning
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>


                {/* Mirror reflection element */}
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-md pointer-events-none"></div>
              </div>
            ))}
          </div>

          {/* Methodology Section */}
          <div className="p-6 bg-slate-50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/5 rounded-md flex flex-col md:flex-row items-center gap-6">
            <div className="p-4 bg-blue-100 dark:bg-blue-500/10 rounded-full">
              <Info className="w-8 h-8 text-blue-500 dark:text-blue-400" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">How we pick multibaggers</h4>
              <p className="text-xs text-slate-500 dark:text-gray-500 leading-relaxed max-w-3xl">
                Our algorithm scans for "The Holy Trinity" of equity investing: 1. Sustainable High Returns on Capital (ROCE &gt; 20%),
                2. Strong Revenue Growth Runway (&gt;15% CAGR), and 3. Valuation Sanity. We avoid "Value Traps" by applying a
                FinGPT-driven qualitative factor scan on corporate governance and debt management.
              </p>
            </div>
            <Button variant="outline" className="text-xs border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">View Full Logic</Button>
          </div>
        </TabsContent>

        <TabsContent value="pro" className="mt-0">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 rounded-md p-6 overflow-hidden">
            <TradingViewWidget
              title="Professional Stock Screener"
              scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-screener.js"
              config={SCREENER_WIDGET_CONFIG}
              height={700}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScreenerPage;
