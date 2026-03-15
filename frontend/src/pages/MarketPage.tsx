import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  TrendingUp, 
  TrendingDown,
  Activity,
  BarChart2,
  PieChart,
  RefreshCw,
  Search,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { useGame } from '../context/GameContext';
import TradingViewWidget from '@/components/ui/TradingViewWidget';
import { HEATMAP_WIDGET_CONFIG, MARKET_OVERVIEW_WIDGET_CONFIG } from '@/lib/constants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  
  const { isPlaying, simulatedIndices, currentTime } = useGame();
  
  const navigate = useNavigate();

  const fetchMarketData = async () => {
    setIsLoading(true);
    try {
      const [indicesRes, gainersRes, losersRes, sectorsRes, optionsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/market/indices`),
        axios.get(`${API_BASE}/api/market/gainers`),
        axios.get(`${API_BASE}/api/market/losers`),
        axios.get(`${API_BASE}/api/market/sectors`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/market/options/${optionsSymbol}`).catch(() => ({ data: null }))
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
        const res = await axios.get(`${API_BASE}/api/market/options/${optionsSymbol}`);
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
      // Only connect to live WS if we are NOT playing the simulator
      if (isPlaying) return;

      // Determine WS URL based on API_BASE
      const wsUrl = API_BASE.replace('http', 'ws') + '/ws/live_indices';
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

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN').format(val);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Top Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/[0.02] border border-white/5 p-6 rounded-3xl backdrop-blur-md">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-1">Markets Overview</h1>
          <div className="flex items-center gap-2 text-xs font-medium mt-2">
            
            {isPlaying ? (
              <>
                <span className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  SIMULATION SYNC: {currentTime?.toLocaleTimeString() ?? 'Loading...'}
                </span>
                <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20">
                  Simulated Indices Active
                </span>
              </>
            ) : (
              <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${isLiveWsConnected ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isLiveWsConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                {isLiveWsConnected ? 'Live Data Connected' : 'Connecting Live...'}
              </span>
            )}

            <span className="text-gray-600">•</span>
            <span className="text-gray-500">Last REST sync: {lastRefreshed.toLocaleTimeString()}</span>
            <button onClick={fetchMarketData} className="ml-2 text-gray-500 hover:text-white transition-colors" title="Sync REST Data">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>
        </div>
        
        <div className="relative w-full md:w-72">
          <input 
            type="text" 
            placeholder="Search stocks, indices, mutual funds..." 
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-gray-600"
          />
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" onValueChange={(val) => setActiveTab(val as any)} className="w-full">
        <TabsList className="bg-black/40 border border-white/10 p-1 mb-1">
          {[
            { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
            { id: 'heatmap', label: 'Heatmap', icon: <PieChart className="w-4 h-4" /> },
            { id: 'sectors', label: 'Sectors', icon: <PieChart className="w-4 h-4" /> },
            { id: 'fno', label: 'F&O', icon: <BarChart2 className="w-4 h-4" /> }
          ].map(tab => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-primary text-gray-500 hover:text-white"
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-6">
          <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 overflow-hidden">
            <TradingViewWidget 
                title="Market Pulse"
                scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js"
                config={MARKET_OVERVIEW_WIDGET_CONFIG}
                height={500}
            />
          </div>
          {/* Indices Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading && displayIndices.length === 0 ? (
              [1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white/5 animate-pulse rounded-2xl"></div>)
            ) : (
              displayIndices.map((idx: any) => (
                <div key={idx.symbol} className="bg-[#0a0a0a] border border-white/5 p-5 rounded-2xl hover:border-white/20 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">{idx.name}</h3>
                    {idx.is_positive ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="text-2xl font-black text-white mb-1 tracking-tight">
                    {formatCurrency(idx.price)}
                  </div>
                  <div className={`text-xs font-bold flex items-center gap-1.5 ${idx.is_positive ? 'text-green-500' : 'text-red-500'}`}>
                    <span>{idx.is_positive ? '+' : ''}{idx.change}</span>
                    <span>({idx.is_positive ? '+' : ''}{idx.change_percent}%)</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Movers Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top Gainers */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden">
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Top Gainers
                </h3>
                <Button variant="ghost" size="sm" className="text-[10px] text-gray-500 hover:text-white">View All</Button>
              </div>
              <div className="p-0">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase font-bold text-gray-600 bg-white/[0.01]">
                    <tr>
                      <th className="py-3 px-5 font-medium tracking-wider">Company</th>
                      <th className="py-3 px-5 font-medium tracking-wider text-right">Price</th>
                      <th className="py-3 px-5 font-medium tracking-wider text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {gainers.slice(0, 5).map(stock => (
                      <tr 
                        key={stock.symbol} 
                        onClick={() => navigate(`/research/${stock.symbol}`)}
                        className="hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-5">
                          <div className="font-bold text-gray-300 group-hover:text-primary transition-colors">{stock.symbol}</div>
                          <div className="text-[10px] text-gray-600 truncate max-w-[120px]">Vol: {formatCurrency(stock.volume)}</div>
                        </td>
                        <td className="py-4 px-5 text-right font-medium text-white">
                          ₹{formatCurrency(stock.price)}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-500 text-xs font-bold border border-green-500/20">
                            +{stock.change_percent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {gainers.length === 0 && !isLoading && (
                      <tr><td colSpan={3} className="py-8 text-center text-gray-500 text-xs">No data available. Market might be closed.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Losers */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden">
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  Top Losers
                </h3>
                <Button variant="ghost" size="sm" className="text-[10px] text-gray-500 hover:text-white">View All</Button>
              </div>
              <div className="p-0">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase font-bold text-gray-600 bg-white/[0.01]">
                    <tr>
                      <th className="py-3 px-5 font-medium tracking-wider">Company</th>
                      <th className="py-3 px-5 font-medium tracking-wider text-right">Price</th>
                      <th className="py-3 px-5 font-medium tracking-wider text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {losers.slice(0, 5).map(stock => (
                      <tr 
                        key={stock.symbol} 
                        onClick={() => navigate(`/research/${stock.symbol}`)}
                        className="hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-5">
                          <div className="font-bold text-gray-300 group-hover:text-primary transition-colors">{stock.symbol}</div>
                          <div className="text-[10px] text-gray-600 truncate max-w-[120px]">Vol: {formatCurrency(stock.volume)}</div>
                        </td>
                        <td className="py-4 px-5 text-right font-medium text-white">
                          ₹{formatCurrency(stock.price)}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-xs font-bold border border-red-500/20">
                            {stock.change_percent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {losers.length === 0 && !isLoading && (
                      <tr><td colSpan={3} className="py-8 text-center text-gray-500 text-xs">No data available. Market might be closed.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </TabsContent>

        <TabsContent value="heatmap" className="mt-0">
            <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 overflow-hidden">
                <TradingViewWidget 
                    title="Global Equity Heatmap"
                    scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
                    config={HEATMAP_WIDGET_CONFIG}
                    height={700}
                />
            </div>
        </TabsContent>

        <TabsContent value="sectors" className="mt-0">
        <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-6">Sector Performance</h2>
          <div className="h-96 w-full">
            {sectors && sectors.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectors} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                  <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} angle={-45} textAnchor="end" />
                  <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                  <RechartsTooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(value: any) => [`${value}%`, 'Change']}
                  />
                  <Bar dataKey="change_percent" radius={[4, 4, 4, 4]}>
                    {sectors.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.change_percent >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-gray-500 font-mono text-sm">Loading sector data...</div>
            )}
          </div>
        </div>
        </TabsContent>

        <TabsContent value="fno" className="mt-0">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 shadow-xl">
            <div className="flex bg-white/5 p-1 rounded-lg">
              <button 
                onClick={() => setOptionsSymbol('NIFTY')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${optionsSymbol === 'NIFTY' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                NIFTY
              </button>
              <button 
                onClick={() => setOptionsSymbol('BANKNIFTY')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${optionsSymbol === 'BANKNIFTY' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                BANKNIFTY
              </button>
            </div>
            
            {optionsData && !optionsData.error && (
              <div className="flex items-center gap-6">
                 <div className="text-center">
                   <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">PCR</div>
                   <div className={`text-lg font-black ${optionsData.pcr > 1 ? 'text-green-500' : 'text-red-500'}`}>{optionsData.pcr}</div>
                 </div>
                 <div className="h-8 w-px bg-white/10"></div>
                 <div className="text-center">
                   <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Max Pain</div>
                   <div className="text-lg font-black text-white">{optionsData.max_pain}</div>
                 </div>
                 <div className="h-8 w-px bg-white/10"></div>
                 <div className="text-center">
                   <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Expiry</div>
                   <div className="text-lg font-black text-white">{optionsData.expiration}</div>
                 </div>
              </div>
            )}

            <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">View:</span>
               <button onClick={() => setIsOptionsAdvanced(false)} className={`text-xs px-3 py-1.5 rounded-md font-bold border transition-colors ${!isOptionsAdvanced ? 'border-primary text-primary bg-primary/10' : 'border-white/10 text-gray-500 hover:text-white bg-white/5'}`}>Simple</button>
               <button onClick={() => setIsOptionsAdvanced(true)} className={`text-xs px-3 py-1.5 rounded-md font-bold border transition-colors ${isOptionsAdvanced ? 'border-primary text-primary bg-primary/10' : 'border-white/10 text-gray-500 hover:text-white bg-white/5'}`}>Advanced</button>
            </div>
          </div>

          {!optionsData || optionsData.error ? (
             <div className="py-24 text-center border border-white/5 rounded-3xl bg-[#0a0a0a] text-gray-500 font-mono text-sm border-dashed">
               {optionsData?.error || "Loading options chain..."}
             </div>
          ) : (
             <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden overflow-x-auto shadow-xl">
               <table className="w-full text-center text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-white/5 text-[10px] uppercase font-bold tracking-widest border-b border-white/5">
                      <th colSpan={isOptionsAdvanced ? 4 : 2} className="py-2.5 border-r border-white/5 text-green-400">Calls (CE)</th>
                      <th className="py-2.5 text-white">Strike</th>
                      <th colSpan={isOptionsAdvanced ? 4 : 2} className="py-2.5 border-l border-white/5 text-red-400">Puts (PE)</th>
                    </tr>
                    <tr className="bg-white/[0.02] text-xs font-medium text-gray-400 border-b border-white/5">
                      {isOptionsAdvanced && <th className="py-3 px-3">OI</th>}
                      {isOptionsAdvanced && <th className="py-3 px-3">IV</th>}
                      <th className="py-3 px-3 text-right">Bid</th>
                      <th className="py-3 px-3 border-r border-white/5 text-white text-right">LTP</th>
                      
                      <th className="py-3 px-3 bg-white/5 text-white font-bold tracking-wider">Strike Price</th>
                      
                      <th className="py-3 px-3 border-l border-white/5 text-white text-left">LTP</th>
                      <th className="py-3 px-3 text-left">Ask</th>
                      {isOptionsAdvanced && <th className="py-3 px-3">IV</th>}
                      {isOptionsAdvanced && <th className="py-3 px-3">OI</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-xs">
                    {optionsData.chain.map((row: any) => (
                      <tr key={row.strike} className={`hover:bg-white/5 transition-colors ${row.is_atm ? 'bg-primary/10 relative z-10' : ''}`}>
                         {isOptionsAdvanced && <td className="py-4 px-3 text-gray-500">{row.call.oi.toLocaleString('en-IN')}</td>}
                         {isOptionsAdvanced && <td className="py-4 px-3 text-gray-400">{row.call.iv}%</td>}
                         <td className="py-4 px-3 text-green-500/70 text-right">{row.call.bid}</td>
                         <td className="py-4 px-3 border-r border-white/5 font-bold text-green-400 text-right">{row.call.ltp}</td>
                         
                         <td className={`py-4 px-3 font-bold text-[13px] ${row.is_atm ? 'text-primary bg-primary/20 rounded shadow-[inset_0_0_10px_rgba(59,130,246,0.3)]' : 'text-gray-300 bg-white/[0.01]'}`}>
                           {row.is_atm && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>}
                           {formatCurrency(row.strike)}
                         </td>
                         
                         <td className="py-4 px-3 border-l border-white/5 font-bold text-red-400 text-left">{row.put.ltp}</td>
                         <td className="py-4 px-3 text-red-500/70 text-left">{row.put.ask}</td>
                         {isOptionsAdvanced && <td className="py-4 px-3 text-gray-400">{row.put.iv}%</td>}
                         {isOptionsAdvanced && <td className="py-4 px-3 text-gray-500">{row.put.oi.toLocaleString('en-IN')}</td>}
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
