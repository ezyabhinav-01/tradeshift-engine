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
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Candidate {
  symbol: string;
  name: string;
  market_cap: number;
  pe_ratio: number;
  roce: number;
  revenue_growth: number;
  conviction_score: number;
  sector: string;
  persona: string;
  varsity_tip: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
        const response = await axios.get(`${API_BASE}/api/screener/multibagger`);
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
        <p className="mt-4 text-tv-text-secondary animate-pulse font-medium">FinGPT Scanning NSE Markets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-blue-500/5 to-[#050505] border border-white/5 p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <div className="px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded text-[10px] font-black uppercase tracking-widest border border-amber-500/30">
                Varsity Powered
              </div>
              <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <BrainCircuit className="w-3 h-3" />
                Adaptive Learning Engine
              </span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
              The Multi-bagger <span className="text-primary italic">Academy</span>
            </h1>
            <p className="text-gray-400 max-w-xl text-sm leading-relaxed">
                Scan the markets like a pro. This isn't just a screener—it's your mentor. 
                Learn the "Why" behind the "Buy" as we analyze capital efficiency, 
                cash flows, and growth runways for the next decade.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="p-5 bg-black/40 border border-white/10 rounded-2xl backdrop-blur-xl group hover:border-primary/50 transition-all">
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-2">
                    <Target className="w-3 h-3" />
                    Confidence Interval
                </div>
                <div className="text-3xl font-black text-white group-hover:text-primary transition-colors">99.2%</div>
            </div>
            <div className="p-5 bg-black/40 border border-white/10 rounded-2xl backdrop-blur-xl group hover:border-green-500/50 transition-all text-center">
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Learning Level</div>
                <div className="text-3xl font-black text-green-500">Mastery</div>
            </div>
          </div>
        </div>
        
        {/* Background blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-[80px] -ml-24 -mb-24"></div>
      </div>

      {/* Filters, Search & Sorting */}
      <div className="flex flex-col lg:flex-row gap-6 items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-3xl">
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            {['All', 'Banking', 'Energy', 'IT', 'Consumer', 'FMCG'].map(cat => (
                <Button 
                    key={cat}
                    variant="ghost" 
                    size="sm"
                    onClick={() => setCategory(cat)}
                    className={`rounded-xl text-xs font-bold ${category === cat ? 'bg-primary text-black hover:bg-primary/90' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    {cat}
                </Button>
            ))}
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto justify-end">
          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              placeholder="Search companies..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder:text-gray-600"
            />
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex items-center gap-3 bg-black/20 p-2 rounded-xl border border-white/5">
              <span className="text-[10px] uppercase font-black text-gray-500 tracking-tighter pl-2">Sort By:</span>
              <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as keyof Candidate)}
                  className="bg-transparent text-sm font-bold text-white border-none focus:ring-0 cursor-pointer outline-none"
              >
                  <option value="conviction_score" className="bg-[#121212]">FinGPT Conviction</option>
                  <option value="roce" className="bg-[#121212]">Efficiency (ROCE)</option>
                  <option value="revenue_growth" className="bg-[#121212]">Growth Rate</option>
                  <option value="market_cap" className="bg-[#121212]">Market Size</option>
              </select>
          </div>
        </div>
      </div>

      {/* Grid of Potential Multi-baggers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
        {filteredCandidates.map((stock, idx) => (
          <div 
            key={stock.symbol}
            className="group relative bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 hover:border-primary/50 transition-all duration-500 hover:shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)] flex flex-col justify-between"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-2xl font-bold tracking-tight text-white">{stock.symbol}</h3>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-xs text-gray-500 font-medium truncate max-w-[150px]">{stock.name}</p>
                </div>
                <div className="flex flex-col items-end">
                  <div className="px-2 py-1 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-black text-primary">{stock.conviction_score}%</span>
                  </div>
                  <span className="text-[10px] text-gray-600 mt-1 uppercase font-bold tracking-tighter">Conviction Score</span>
                </div>
              </div>

              {/* Fundamental Badges */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px] font-black uppercase flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {stock.persona}
                </span>
                <span className="px-2 py-1 bg-white/5 rounded-md text-[10px] font-bold text-gray-400 uppercase">{stock.sector}</span>
              </div>

              {/* Varsity Tip */}
              <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl relative group/tip">
                <div className="flex items-center gap-2 mb-1">
                    <BrainCircuit className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">Why this stock?</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed italic line-clamp-2 group-hover/tip:line-clamp-none transition-all">
                    "{stock.varsity_tip}"
                </p>
              </div>

              {/* Main Metrics */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 flex items-center gap-1 uppercase font-bold tracking-wider">
                        <Zap className="w-3 h-3 text-amber-400" />
                        ROCE
                    </div>
                    <div className="text-lg font-black text-white">{stock.roce}%</div>
                </div>
                <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 flex items-center gap-1 uppercase font-bold tracking-wider">
                        <ArrowUpRight className="w-3 h-3 text-blue-400" />
                        Rev Growth
                    </div>
                    <div className="text-lg font-black text-white">{stock.revenue_growth}%</div>
                </div>
                <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 flex items-center gap-1 uppercase font-bold tracking-wider">
                        <Target className="w-3 h-3 text-primary" />
                        PE Ratio
                    </div>
                    <div className="text-lg font-black text-white">{stock.pe_ratio}x</div>
                </div>
                <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 flex items-center gap-1 uppercase font-bold tracking-wider">
                        <BarChart3 className="w-3 h-3 text-purple-400" />
                        Market Cap
                    </div>
                    <div className="text-lg font-black text-white">₹{(stock.market_cap / 1000).toFixed(1)}k Cr</div>
                </div>
              </div>
            </div>

            <Button 
                onClick={() => navigate(`/research/${stock.symbol}`)}
                className="w-full mt-4 bg-white/5 hover:bg-primary hover:text-black border border-white/10 hover:border-transparent transition-all duration-300 rounded-xl group-hover:translate-y-[-2px]"
            >
                Start Deep Learning
                <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
            
            {/* Mirror reflection element */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl pointer-events-none"></div>
          </div>
        ))}
      </div>

      {/* Methodology Section */}
      <div className="p-6 bg-white/[0.01] border border-white/5 rounded-3xl flex flex-col md:flex-row items-center gap-6">
        <div className="p-4 bg-blue-500/10 rounded-full">
            <Info className="w-8 h-8 text-blue-400" />
        </div>
        <div className="flex-1 space-y-1">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">How we pick multibaggers</h4>
            <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
                Our algorithm scans for "The Holy Trinity" of equity investing: 1. Sustainable High Returns on Capital (ROCE &gt; 20%), 
                2. Strong Revenue Growth Runway (&gt;15% CAGR), and 3. Valuation Sanity. We avoid "Value Traps" by applying a 
                FinGPT-driven qualitative factor scan on corporate governance and debt management.
            </p>
        </div>
        <Button variant="outline" className="text-xs border-white/10 hover:bg-white/5">View Full Logic</Button>
      </div>
    </div>
  );
};

export default ScreenerPage;
