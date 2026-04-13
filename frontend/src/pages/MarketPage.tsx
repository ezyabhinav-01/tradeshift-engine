import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getCachedOrFetch } from '@/utils/requestCache';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// NEW: Professional Market Components
import SimulationHeader from './market/SimulationHeader';
import IndicesScroll from './market/IndicesScroll';
import MoversTable from './market/MoversTable';

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
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const { isPlaying, currentTime } = useGamePlayback();
  const { simulatedIndices } = useGameMarket();

  // Optimized configurations for TradingView widgets
  const marketPulseConfig = useMemo(() => ({
    ...MARKET_OVERVIEW_WIDGET_CONFIG,
    colorTheme: isDarkMode ? 'dark' : 'light',
    backgroundColor: isDarkMode ? '#000000' : '#ffffff',
    isTransparent: false,
    scaleFontColor: isDarkMode ? MARKET_OVERVIEW_WIDGET_CONFIG.scaleFontColor : '#000000'
  }), [isDarkMode]);

  const heatmapConfig = useMemo(() => ({
    ...HEATMAP_WIDGET_CONFIG,
    colorTheme: isDarkMode ? 'dark' : 'light'
  }), [isDarkMode]);

  const navigate = useNavigate();
  const hasInitialSnapshotRef = useRef(false);

  const toNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const extractArrayFromPayload = (payload: any, key?: string) => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    if (key && Array.isArray(payload[key])) return payload[key];
    if (Array.isArray(payload.data)) return payload.data;
    if (key && Array.isArray(payload.data?.[key])) return payload.data[key];
    if (key && Array.isArray(payload.result?.[key])) return payload.result[key];
    if (Array.isArray(payload.result)) return payload.result;
    if (payload.items && Array.isArray(payload.items)) return payload.items;
    return [];
  };

  const extractFromSettled = (result: PromiseSettledResult<any>, key?: string) => {
    if (result.status !== 'fulfilled') return [];
    return extractArrayFromPayload(result.value?.data, key);
  };

  const normalizeMovers = (rows: any[]): MoverData[] =>
    rows
      .map((row) => {
        const symbol = String(row?.symbol ?? row?.ticker ?? row?.name ?? '').trim();
        const price = toNumber(row?.price ?? row?.ltp ?? row?.last_price ?? row?.close);
        const change = toNumber(row?.change ?? row?.price_change);
        const changePercent = toNumber(row?.change_percent ?? row?.changePercent ?? row?.percent_change);
        const volume = toNumber(row?.volume ?? row?.vol);
        return {
          symbol,
          price,
          change,
          change_percent: changePercent,
          volume,
          is_positive: row?.is_positive !== undefined ? Boolean(row.is_positive) : changePercent >= 0,
        };
      })
      .filter((row) => row.symbol.length > 0)
      .slice(0, 15);

  const fetchMarketData = async (opts?: { forceRefresh?: boolean; background?: boolean }) => {
    const forceRefresh = opts?.forceRefresh ?? false;
    const background = opts?.background ?? false;
    if (!background || !hasInitialSnapshotRef.current) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const snapshot = await getCachedOrFetch(
        'market:snapshot',
        async () => {
          const [indicesRes, gainersRes, losersRes, sectorsRes, activeRes] = await Promise.allSettled([
            axios.get(`/api/market/indices`),
            axios.get(`/api/market/gainers`),
            axios.get(`/api/market/losers`),
            axios.get(`/api/market/sectors`),
            axios.get(`/api/market/most-active`),
          ]);

          const parsedIndices = extractFromSettled(indicesRes);
          const parsedSectors = extractFromSettled(sectorsRes);

          let parsedGainers = normalizeMovers(extractFromSettled(gainersRes, 'gainers'));
          let parsedLosers = normalizeMovers(extractFromSettled(losersRes, 'losers'));
          const parsedActive = normalizeMovers(extractFromSettled(activeRes, 'active'));

          if ((parsedGainers.length === 0 || parsedLosers.length === 0) && parsedActive.length > 0) {
            const byPerformanceDesc = [...parsedActive].sort((a, b) => b.change_percent - a.change_percent);
            if (parsedGainers.length === 0) parsedGainers = byPerformanceDesc.slice(0, 10);
            if (parsedLosers.length === 0) parsedLosers = [...byPerformanceDesc].reverse().slice(0, 10);
          }

          return {
            indices: parsedIndices,
            gainers: parsedGainers,
            losers: parsedLosers,
            sectors: parsedSectors,
          };
        },
        { ttlMs: 60_000, forceRefresh }
      );
      setIndices(snapshot.indices);
      setGainers(snapshot.gainers);
      setLosers(snapshot.losers);
      setSectors(snapshot.sectors);
      hasInitialSnapshotRef.current = true;
      setLastRefreshed(new Date());
    } catch (error) {
      console.error("Failed to fetch market data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const data = await getCachedOrFetch(
          `market:options:${optionsSymbol}`,
          async () => {
            const res = await axios.get(`/api/market/options/${optionsSymbol}`);
            return res.data;
          },
          { ttlMs: 60_000 }
        );
        setOptionsData(data);
      } catch (err) {
        console.error(err);
      }
    };
    if (activeTab === 'fno') {
      fetchOptions();
    }
  }, [optionsSymbol, activeTab]);

  useEffect(() => {
    fetchMarketData();
    // Auto refresh every 5 minutes (for sectors and movers)
    const interval = setInterval(() => fetchMarketData({ background: true, forceRefresh: true }), 5 * 60 * 1000);
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 bg-transparent text-black dark:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Top Header & Search */}
      <SimulationHeader 
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        isLiveWsConnected={isLiveWsConnected}
        lastRefreshed={lastRefreshed}
        onRefresh={() => fetchMarketData({ forceRefresh: true })}
      />

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
              config={marketPulseConfig}
              height={500}
            />
          </div>
          {/* Indices Cards */}
          <IndicesScroll 
            indices={displayIndices} 
            isLoading={isLoading} 
          />

          {/* Movers Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top Gainers */}
            <MoversTable 
              title="Top Gainers"
              data={gainers}
              type="gainers"
              isLoading={isLoading}
              onNavigate={(s) => navigate(`/research/${s}`)}
            />

            {/* Top Losers */}
            <MoversTable 
              title="Top Losers"
              data={losers}
              type="losers"
              isLoading={isLoading}
              onNavigate={(s) => navigate(`/research/${s}`)}
            />

          </div>
        </TabsContent>

        <TabsContent value="heatmap" className="mt-0">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-lg p-6 overflow-hidden shadow-sm dark:shadow-[0_4px_20px_rgba(255,255,255,0.03)]">
            <TradingViewWidget
              key={`heatmap-${isDarkMode ? 'dark' : 'light'}`}
              title="Global Equity Heatmap"
              scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
              config={heatmapConfig}
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
