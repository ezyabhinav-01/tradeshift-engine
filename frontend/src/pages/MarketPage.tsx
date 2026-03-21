import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart2,
  PieChart,
  RefreshCw,
  Search,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { useGame } from '../context/GameContext';
import TradingViewWidget from '@/components/ui/TradingViewWidget';
import { HEATMAP_WIDGET_CONFIG, MARKET_OVERVIEW_WIDGET_CONFIG } from '@/lib/constants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// No API_BASE needed when using proxy for relative paths

interface IndexData {
  name: string;
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  is_positive: boolean;
}

interface MoverData {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  is_positive: boolean;
}

const MarketPage: React.FC = () => {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [gainers, setGainers] = useState<MoverData[]>([]);
  const [losers, setLosers] = useState<MoverData[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'sectors' | 'fno'>('overview');
  const [sectors, setSectors] = useState<any[]>([]);
  const [optionsData, setOptionsData] = useState<any>(null);
  const [optionsSymbol, setOptionsSymbol] = useState<'NIFTY' | 'BANKNIFTY'>('NIFTY');
  const [isOptionsAdvanced, setIsOptionsAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isLiveWsConnected, setIsLiveWsConnected] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [indices]);

  const scrollByAmount = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const { isPlaying, simulatedIndices, currentTime } = useGame();

  const navigate = useNavigate();

  const fetchMarketData = async () => {
    setIsLoading(true);
    try {
      const [indicesRes, gainersRes, losersRes, sectorsRes, optionsRes] = await Promise.all([
        axios.get(`/api/market/indices`),
        axios.get(`/api/market/gainers`),
        axios.get(`/api/market/losers`),
        axios.get(`/api/market/sectors`).catch(() => ({ data: [] })),
        axios.get(`/api/market/options/${optionsSymbol}`).catch(() => ({ data: null }))
      ]);
      setIndices(indicesRes.data);
      setGainers(gainersRes.data);
      setLosers(losersRes.data);
      setSectors(sectorsRes.data || []);
      setOptionsData(optionsRes.data);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error("Failed to fetch market data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await axios.get(`/api/market/options/${optionsSymbol}`);
        setOptionsData(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    if (activeTab === 'fno') {
      setOptionsData(null);
      fetchOptions();
    }
  }, [optionsSymbol, activeTab]);

  useEffect(() => {
    fetchMarketData();
    // Auto refresh every 5 minutes (for sectors and movers)
    const interval = setInterval(fetchMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check initial dark mode state
    setIsDarkMode(document.documentElement.classList.contains('dark'));

    // Observer to detect dark mode toggles if handled via class changes on HTML
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Only connect to live WS if we are NOT playing the simulator
    if (isPlaying) return;

    // Determine WS URL reliably based on current protocol
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/live_indices`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to Live Market WebSocket');
      setIsLiveWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // data might be a dictionary of all active indices: { "NIFTY 50": { price: ... }, "BANK NIFTY": { ... } }
        setIndices(prev => {
          if (!prev || prev.length === 0) return prev;

          let updated = [...prev];
          let changed = false;

          Object.values(data).forEach((update: any) => {
            if (update && update.name) {
              const idx = updated.findIndex(i => i.name === update.name);
              if (idx !== -1) {
                // Only update if price actually changed or we got new data
                if (updated[idx].price !== update.price) {
                  updated[idx] = {
                    ...updated[idx],
                    price: update.price || updated[idx].price,
                    change: update.change !== undefined ? update.change : updated[idx].change,
                    change_percent: update.change_percent !== undefined ? update.change_percent : updated[idx].change_percent,
                    is_positive: update.is_positive !== undefined ? update.is_positive : updated[idx].is_positive
                  };
                  changed = true;
                }
              }
            }
          });

          return changed ? updated : prev;
        });

      } catch (err) {
        console.error('Error parsing live index data:', err);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from Live Market WebSocket');
      setIsLiveWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [isPlaying]);

  // Determine what indices to show based on simulation state
  const displayIndices = isPlaying ? simulatedIndices : indices;

  const formatCurrency = (val: number | string | undefined | null) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0.00';
    return new Intl.NumberFormat('en-IN').format(Number(val));
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 bg-gradient-to-br from-slate-200/50 via-slate-100 to-slate-200 dark:from-blue-900/10 dark:via-black dark:to-black min-h-screen text-black dark:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Top Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 rounded-xl backdrop-blur-md">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1 font-['Montserrat']">Markets Overview</h1>
          <div className="flex items-center gap-2 text-xs font-medium mt-2">

            {isPlaying ? (
              <>
                <span className="flex items-center gap-1.5 px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-md border border-indigo-200 dark:border-indigo-500/20">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  SIMULATION SYNC: {currentTime?.toLocaleTimeString() ?? 'Loading...'}
                </span>
                <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-500/20">
                  Simulated Indices Active
                </span>
              </>
            ) : (
              <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${isLiveWsConnected ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-500 dark:border-green-500/20' : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-500 dark:border-yellow-500/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isLiveWsConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                {isLiveWsConnected ? 'Live Data Connected' : 'Connecting Live...'}
              </span>
            )}

            <span className="text-slate-400 dark:text-gray-600">•</span>
            <span className="text-slate-500 dark:text-gray-500">Last REST sync: {lastRefreshed.toLocaleTimeString()}</span>
            <button onClick={fetchMarketData} className="ml-2 text-slate-500 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white transition-colors" title="Sync REST Data">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600 dark:text-primary' : ''}`} />
            </button>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search stocks, indices, mutual funds..."
            className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-primary/50 transition-all placeholder:text-slate-500 dark:placeholder:text-gray-600"
          />
          <Search className="w-4 h-4 text-slate-400 dark:text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" onValueChange={(val: string) => setActiveTab(val as any)} className="w-full">
        <TabsList className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 p-1 mb-1 shadow-sm dark:shadow-none">
          {[
            { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
            { id: 'heatmap', label: 'Heatmap', icon: <PieChart className="w-4 h-4" /> },
            { id: 'sectors', label: 'Sectors', icon: <PieChart className="w-4 h-4" /> },
            { id: 'fno', label: 'F&O', icon: <BarChart2 className="w-4 h-4" /> }
          ].map(tab => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:border-primary text-slate-500 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white shadow-none data-[state=active]:shadow-sm dark:data-[state=active]:shadow-none"
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-6">
          <div className="bg-white dark:bg-[#121212] border-2 border-slate-300 dark:border-white/20 rounded-lg p-6 overflow-hidden shadow-md dark:shadow-[0_4px_20px_rgba(255,255,255,0.05)]">
            <TradingViewWidget
              key={`market-pulse-${isDarkMode ? 'dark' : 'light'}`}
              title="Market Pulse"
              scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js"
              config={{
                ...MARKET_OVERVIEW_WIDGET_CONFIG,
                colorTheme: isDarkMode ? 'dark' : 'light',
                backgroundColor: isDarkMode ? '#000000' : '#ffffff',
                isTransparent: false,
                scaleFontColor: isDarkMode ? MARKET_OVERVIEW_WIDGET_CONFIG.scaleFontColor : '#000000'
              }}
              height={500}
            />
          </div>
          {/* Indices Cards */}
          <div className="relative group/scroll">
            {canScrollLeft && (
              <button
                onClick={() => scrollByAmount(-300)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -ml-3 lg:-ml-4 z-10 w-10 h-10 flex items-center justify-center bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_rgba(255,255,255,0.05)] text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition-all opacity-0 group-hover/scroll:opacity-100 focus:outline-none"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <div
              ref={scrollContainerRef}
              onScroll={checkScroll}
              className="flex overflow-x-auto gap-4 pb-4 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {isLoading && (displayIndices?.length ?? 0) === 0 ? (
                [1, 2, 3, 4].map(i => <div key={i} className="min-w-[260px] md:min-w-[280px] flex-1 flex-shrink-0 snap-start h-28 bg-slate-200 dark:bg-white/5 animate-pulse rounded-lg"></div>)
              ) : (
                displayIndices?.map((idx: any) => (
                  <div key={idx.symbol} className="min-w-[260px] md:min-w-[280px] flex-1 flex-shrink-0 snap-start bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 p-5 rounded-lg hover:border-slate-300 dark:hover:border-white/30 transition-all cursor-pointer group shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.03)]">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{idx.name}</h3>
                      {idx.is_positive ? (
                        <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-500" />
                      )}
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1 tracking-tight font-['Montserrat']">
                      {formatCurrency(idx.price)}
                    </div>
                    <div className={`text-xs font-semibold flex items-center gap-1.5 ${idx.is_positive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                      <span>{idx.is_positive ? '+' : ''}{idx.change}</span>
                      <span>({idx.is_positive ? '+' : ''}{idx.change_percent}%)</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {canScrollRight && (
              <button
                onClick={() => scrollByAmount(300)}
                className="absolute right-0 top-1/2 -translate-y-1/2 -mr-3 lg:-mr-4 z-10 w-10 h-10 flex items-center justify-center bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_rgba(255,255,255,0.05)] text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition-all opacity-0 group-hover/scroll:opacity-100 focus:outline-none"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Movers Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top Gainers */}
            <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.03)]">
              <div className="p-5 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/[0.02]">
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-500" />
                  Top Gainers
                </h3>
                <Button variant="ghost" size="sm" className="text-[10px] text-slate-500 hover:text-slate-800 dark:text-gray-500 dark:hover:text-white border-0">View All</Button>
              </div>
              <div className="p-0">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase font-semibold text-slate-500 dark:text-gray-600 bg-slate-100/50 dark:bg-white/[0.01]">
                    <tr>
                      <th className="py-3 px-5 font-medium tracking-wider">Company</th>
                      <th className="py-3 px-5 font-medium tracking-wider text-right">Price</th>
                      <th className="py-3 px-5 font-medium tracking-wider text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {gainers?.slice(0, 5).map((stock: any) => (
                      <tr
                        key={stock.symbol}
                        onClick={() => navigate(`/research/${stock.symbol}`)}
                        className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-5">
                          <div className="font-semibold text-slate-800 dark:text-gray-300 group-hover:text-green-600 dark:group-hover:text-green-500 transition-colors">{stock.symbol}</div>
                          <div className="text-[10px] text-slate-500 dark:text-gray-600 truncate max-w-[120px] group-hover:text-green-600/70 dark:group-hover:text-green-500/70 transition-colors">Vol: {formatCurrency(stock.volume)}</div>
                        </td>
                        <td className="py-4 px-5 text-right font-medium text-slate-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-500 transition-colors">
                          ₹{formatCurrency(stock.price)}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-500 text-xs font-semibold border border-green-200 dark:border-green-500/20">
                            +{stock.change_percent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(gainers?.length ?? 0) === 0 && !isLoading && (
                      <tr><td colSpan={3} className="py-8 text-center text-slate-500 dark:text-gray-500 text-xs">No data available. Market might be closed.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Losers */}
            <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.03)]">
              <div className="p-5 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/[0.02]">
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-500" />
                  Top Losers
                </h3>
                <Button variant="ghost" size="sm" className="text-[10px] text-slate-500 hover:text-slate-800 dark:text-gray-500 dark:hover:text-white border-0">View All</Button>
              </div>
              <div className="p-0">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase font-semibold text-slate-500 dark:text-gray-600 bg-slate-100/50 dark:bg-white/[0.01]">
                    <tr>
                      <th className="py-3 px-5 font-medium tracking-wider">Company</th>
                      <th className="py-3 px-5 font-medium tracking-wider text-right">Price</th>
                      <th className="py-3 px-5 font-medium tracking-wider text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {losers.slice(0, 5).map((stock: any) => (
                      <tr
                        key={stock.symbol}
                        onClick={() => navigate(`/research/${stock.symbol}`)}
                        className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-5">
                          <div className="font-semibold text-slate-800 dark:text-gray-300 group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">{stock.symbol}</div>
                          <div className="text-[10px] text-slate-500 dark:text-gray-600 truncate max-w-[120px] group-hover:text-red-600/70 dark:group-hover:text-red-500/70 transition-colors">Vol: {formatCurrency(stock.volume)}</div>
                        </td>
                        <td className="py-4 px-5 text-right font-medium text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">
                          ₹{formatCurrency(stock.price)}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500 text-xs font-semibold border border-red-200 dark:border-red-500/20">
                            {stock.change_percent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(losers?.length ?? 0) === 0 && !isLoading && (
                      <tr><td colSpan={3} className="py-8 text-center text-slate-500 dark:text-gray-500 text-xs">No data available. Market might be closed.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </TabsContent>

        <TabsContent value="heatmap" className="mt-0">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg p-6 overflow-hidden shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.03)]">
            <TradingViewWidget
              key={`heatmap-${isDarkMode ? 'dark' : 'light'}`}
              title="Global Equity Heatmap"
              scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
              config={{
                ...HEATMAP_WIDGET_CONFIG,
                colorTheme: isDarkMode ? 'dark' : 'light'
              }}
              height={700}
            />
          </div>
        </TabsContent>

        <TabsContent value="sectors" className="mt-0">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg p-6 shadow-sm dark:shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Sector Performance</h2>
            <div className="h-96 w-full">
              {sectors && sectors.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectors} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                    <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} angle={-45} textAnchor="end" />
                    <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                    <RechartsTooltip
                      cursor={{ fill: 'rgba(156,163,175,0.05)' }}
                      contentStyle={{ backgroundColor: 'var(--tw-colors-white, #111827)', border: '1px solid var(--tw-colors-slate-200, #374151)', borderRadius: '8px' }}
                      labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                      itemStyle={{ color: 'var(--tw-colors-slate-900, #fff)', fontWeight: 'bold' }}
                      formatter={(value: any) => [`${value}%`, 'Change']}
                    />
                    <Bar dataKey="change_percent" radius={[4, 4, 4, 4]}>
                      {sectors.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.change_percent >= 0 ? '#10b981' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 dark:text-gray-500 font-mono text-sm">Loading sector data...</div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="fno" className="mt-0">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg p-4 shadow-sm dark:shadow-xl">
              <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
                <button
                  onClick={() => setOptionsSymbol('NIFTY')}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${optionsSymbol === 'NIFTY' ? 'bg-blue-600 dark:bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white'}`}
                >
                  NIFTY
                </button>
                <button
                  onClick={() => setOptionsSymbol('BANKNIFTY')}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${optionsSymbol === 'BANKNIFTY' ? 'bg-blue-600 dark:bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white'}`}
                >
                  BANKNIFTY
                </button>
              </div>

              {optionsData && !optionsData.error && (
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-[10px] text-slate-500 dark:text-gray-500 uppercase font-semibold tracking-wider">PCR</div>
                    <div className={`text-lg font-extrabold ${optionsData.pcr > 1 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>{optionsData.pcr}</div>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-white/10"></div>
                  <div className="text-center">
                    <div className="text-[10px] text-slate-500 dark:text-gray-500 uppercase font-semibold tracking-wider">Max Pain</div>
                    <div className="text-lg font-extrabold text-slate-900 dark:text-white">{optionsData.max_pain}</div>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-white/10"></div>
                  <div className="text-center">
                    <div className="text-[10px] text-slate-500 dark:text-gray-500 uppercase font-semibold tracking-wider">Expiry</div>
                    <div className="text-lg font-extrabold text-slate-900 dark:text-white">{optionsData.expiration}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 dark:text-gray-400 uppercase tracking-widest">View:</span>
                <button onClick={() => setIsOptionsAdvanced(false)} className={`text-xs px-3 py-1.5 rounded-md font-semibold border transition-colors ${!isOptionsAdvanced ? 'border-blue-600 text-blue-600 bg-blue-50 dark:border-primary dark:text-primary dark:bg-primary/10' : 'border-slate-200 text-slate-500 hover:text-slate-800 bg-slate-50 dark:border-white/10 dark:text-gray-500 dark:hover:text-white dark:bg-white/5'}`}>Simple</button>
                <button onClick={() => setIsOptionsAdvanced(true)} className={`text-xs px-3 py-1.5 rounded-md font-semibold border transition-colors ${isOptionsAdvanced ? 'border-blue-600 text-blue-600 bg-blue-50 dark:border-primary dark:text-primary dark:bg-primary/10' : 'border-slate-200 text-slate-500 hover:text-slate-800 bg-slate-50 dark:border-white/10 dark:text-gray-500 dark:hover:text-white dark:bg-white/5'}`}>Advanced</button>
              </div>
            </div>

            {!optionsData || optionsData.error ? (
              <div className="py-24 text-center border border-slate-200 dark:border-white/5 rounded-lg bg-white dark:bg-black text-slate-500 dark:text-gray-500 font-mono text-sm border-dashed">
                {optionsData?.error || "Loading options chain..."}
              </div>
            ) : (
              <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden overflow-x-auto shadow-sm dark:shadow-xl">
                <table className="w-full text-center text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/5 text-[10px] uppercase font-semibold tracking-widest border-b border-slate-100 dark:border-white/5">
                      <th colSpan={isOptionsAdvanced ? 4 : 2} className="py-2.5 border-r border-slate-100 dark:border-white/5 text-green-600 dark:text-green-400">Calls (CE)</th>
                      <th className="py-2.5 text-slate-900 dark:text-white">Strike</th>
                      <th colSpan={isOptionsAdvanced ? 4 : 2} className="py-2.5 border-l border-slate-100 dark:border-white/5 text-red-600 dark:text-red-400">Puts (PE)</th>
                    </tr>
                    <tr className="bg-slate-50/50 dark:bg-white/[0.02] text-xs font-medium text-slate-500 dark:text-gray-400 border-b border-slate-100 dark:border-white/5">
                      {isOptionsAdvanced && <th className="py-3 px-3">OI</th>}
                      {isOptionsAdvanced && <th className="py-3 px-3">IV</th>}
                      <th className="py-3 px-3 text-right">Bid</th>
                      <th className="py-3 px-3 border-r border-slate-100 dark:border-white/5 text-slate-900 dark:text-white text-right">LTP</th>

                      <th className="py-3 px-3 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white font-semibold tracking-wider">Strike Price</th>

                      <th className="py-3 px-3 border-l border-slate-100 dark:border-white/5 text-slate-900 dark:text-white text-left">LTP</th>
                      <th className="py-3 px-3 text-left">Ask</th>
                      {isOptionsAdvanced && <th className="py-3 px-3">IV</th>}
                      {isOptionsAdvanced && <th className="py-3 px-3">OI</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono text-xs">
                    {optionsData?.chain?.map((row: any) => (
                      <tr key={row.strike} className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${row.is_atm ? 'bg-blue-50 dark:bg-primary/10 relative z-10' : ''}`}>
                        {isOptionsAdvanced && <td className="py-4 px-3 text-slate-500 dark:text-gray-500">{row.call?.oi?.toLocaleString('en-IN') || '0'}</td>}
                        {isOptionsAdvanced && <td className="py-4 px-3 text-slate-400 dark:text-gray-400">{row.call?.iv}%</td>}
                        <td className="py-4 px-3 text-green-600/70 dark:text-green-500/70 text-right">{row.call?.bid}</td>
                        <td className="py-4 px-3 border-r border-slate-100 dark:border-white/5 font-semibold text-green-600 dark:text-green-400 text-right">{row.call?.ltp}</td>

                        <td className={`py-4 px-3 font-semibold text-[13px] ${row.is_atm ? 'text-blue-700 bg-blue-100 dark:text-primary dark:bg-primary/20 shadow-inner dark:shadow-[inset_0_0_10px_rgba(59,130,246,0.3)]' : 'text-slate-700 dark:text-gray-300 bg-white dark:bg-white/[0.01]'}`}>
                          {row.is_atm && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-primary animate-pulse"></span>}
                          {formatCurrency(row.strike)}
                        </td>

                        <td className="py-4 px-3 border-l border-slate-100 dark:border-white/5 font-semibold text-red-600 dark:text-red-400 text-left">{row.put.ltp}</td>
                        <td className="py-4 px-3 text-red-600/70 dark:text-red-500/70 text-left">{row.put.ask}</td>
                        {isOptionsAdvanced && <td className="py-4 px-3 text-slate-400 dark:text-gray-400">{row.put.iv}%</td>}
                        {isOptionsAdvanced && <td className="py-4 px-3 text-slate-500 dark:text-gray-500">{row.put.oi.toLocaleString('en-IN')}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
};

export default MarketPage;
