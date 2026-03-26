import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, RefreshCw, Briefcase,
  PieChart as PieIcon, BarChart3, Brain, AlertTriangle,
  Shield, Target, Zap, Clock, Award, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

import { useGame } from '../context/GameContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const api = axios.create({ baseURL: '', withCredentials: true });

const TABS = [
  { id: 'holdings', label: 'Holdings', icon: Briefcase },
  { id: 'positions', label: 'Positions', icon: Target },
  { id: 'sectors', label: 'Sector Analysis', icon: PieIcon },
  { id: 'research', label: 'Trade Research', icon: Brain },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Main Component ────────────────────────────────────────────
export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<TabId>('holdings');
  const [summary, setSummary] = useState<any>(null);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any>(null);
  const [research, setResearch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { sessionType } = useGame();

  const fallback = {
    current_value: 0, total_invested: 0, total_pnl: 0,
    pnl_percent: 0, xirr_percent: 0, is_positive: true, equity_curve: [],
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = { session_type: sessionType };
      const [sumR, holdR, posR, secR, resR] = await Promise.all([
        api.get('/api/portfolio/summary', { params }),
        api.get('/api/portfolio/holdings', { params }),
        api.get('/api/portfolio/positions', { params }),
        api.get('/api/portfolio/sectors', { params }),
        api.get('/api/portfolio/research', { params }),
      ]);
      setSummary(sumR.data || fallback);
      setHoldings(holdR.data?.holdings || []);
      setPositions(posR.data?.positions || []);
      setSectors(secR.data || { allocation: [], risks: [], diversity_score: 0 });
      setResearch(resR.data || null);
    } catch (e) {
      console.error('Portfolio fetch error:', e);
      setSummary(fallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [sessionType]);

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-sidebar-primary mx-auto opacity-50" />
          <p className="text-muted-foreground text-sm animate-pulse">Loading portfolio analytics...</p>
        </div>
      </div>
    );
  }

  const data = summary || fallback;
  const isPositive = data.is_positive;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 w-full">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Briefcase className="text-sidebar-primary" /> My Portfolio
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Track holdings, positions, sector allocation & trade analytics.</p>
        </div>
        <button onClick={fetchAll} className="p-2 bg-sidebar border border-sidebar-border hover:bg-sidebar-accent/10 rounded-lg text-sidebar-foreground/70 hover:text-white transition-colors flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /><span className="text-sm font-medium">Refresh</span>
        </button>
      </div>

      {/* ─── TABS ─── */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
        <TabsList className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 p-1 mb-1 shadow-sm dark:shadow-none w-full flex">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:border-primary text-slate-500 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white shadow-none data-[state=active]:shadow-sm dark:data-[state=active]:shadow-none"
              >
                <Icon className="w-4 h-4" />{tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* ─── TAB CONTENT ─── */}
      {activeTab === 'holdings' && <HoldingsTab data={data} holdings={holdings} isPositive={isPositive} fetchData={fetchAll} />}
      {activeTab === 'positions' && <PositionsTab positions={positions} />}
      {activeTab === 'sectors' && <SectorsTab sectors={sectors} />}
      {activeTab === 'research' && <ResearchTab research={research} />}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 1: HOLDINGS (existing, enhanced)
// ═══════════════════════════════════════════════════════════════
function HoldingsTab({ data, holdings, isPositive }: any) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Health Cards + Equity Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-sm p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sidebar-primary/5 rounded-full blur-3xl" />
          <div className="space-y-5 z-10">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Current Value</p>
              <h2 className={`text-4xl font-bold font-mono tracking-tight ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                ₹{data.current_value.toLocaleString('en-IN')}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total Invested</p>
                <p className="font-mono text-lg text-white">₹{data.total_invested.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">XIRR</p>
                <p className="font-mono text-lg text-sidebar-primary">{data.xirr_percent.toFixed(2)}%</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total Returns</p>
              <div className="flex items-center gap-2 font-mono text-lg">
                <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
                  {isPositive ? '+' : '-'}₹{Math.abs(data.total_pnl).toLocaleString('en-IN')}
                </span>
                <span className={`text-sm px-2 py-0.5 rounded-full bg-opacity-10 ${isPositive ? 'text-green-500 bg-green-500' : 'text-red-500 bg-red-500'}`}>
                  {isPositive ? '+' : ''}{data.pnl_percent.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Portfolio Growth</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.equity_curve} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Value']} labelStyle={{ color: '#a3a3a3' }} />
                <Area type="monotone" dataKey="value" stroke={isPositive ? "#10b981" : "#ef4444"} strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Your Holdings</h3>
          <span className="text-xs text-muted-foreground bg-slate-100 dark:bg-sidebar-accent/10 px-3 py-1 rounded-full">{holdings.length} stocks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-sidebar-accent/10 border-b border-gray-200 dark:border-white/10 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5">Symbol</th><th className="px-4 py-2.5">Qty</th>
                <th className="px-4 py-2.5">Avg Cost</th><th className="px-4 py-2.5">LTP</th>
                <th className="px-4 py-2.5">P&L</th><th className="px-4 py-2.5">Day Change</th>
                <th className="px-4 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sidebar-border/30">
              {holdings.map((h: any) => {
                const pos = h.pnl >= 0;
                const dayPct = (Math.random() * 4 - 2).toFixed(2);
                const dayPos = parseFloat(dayPct) >= 0;
                return (
                  <tr key={h.id} className="hover:bg-sidebar-accent/5 transition-colors group text-sm">
                    <td className="px-4 py-2.5"><div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-sidebar-primary/10 flex items-center justify-center text-[10px] font-bold text-sidebar-primary border border-sidebar-primary/20">{h.symbol.substring(0, 2)}</div>
                      <span className="font-bold text-white">{h.symbol}</span>
                    </div></td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{h.quantity}</td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">₹{h.average_cost.toFixed(2)}</td>
                    <td className="px-4 py-2.5 font-mono font-medium text-white">₹{h.ltp.toFixed(2)}</td>
                    <td className="px-4 py-2.5"><div className="flex flex-col">
                      <span className={`font-mono font-medium ${pos ? 'text-green-500' : 'text-red-500'}`}>{pos ? '+' : ''}₹{h.pnl.toFixed(2)}</span>
                      <span className="text-[10px] text-muted-foreground">{pos ? '+' : ''}{h.pnl_percent.toFixed(2)}%</span>
                    </div></td>
                    <td className="px-4 py-2.5"><div className={`flex items-center gap-1 text-xs font-medium ${dayPos ? 'text-green-500' : 'text-red-500'}`}>
                      {dayPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{dayPos ? '+' : ''}{dayPct}%
                    </div></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 px-2 text-[10px] font-bold text-blue-500 hover:bg-blue-500/10 border border-sidebar-border rounded" title="Buy More">BUY</button>
                        <button className="p-1 px-2 text-[10px] font-bold text-red-500 hover:bg-red-500/10 border border-sidebar-border rounded" title="Sell">SELL</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {holdings.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No holdings found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 2: POSITIONS (open trades)
// ═══════════════════════════════════════════════════════════════
function PositionsTab({ positions }: { positions: any[] }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-sidebar-primary" /> Open Positions
          </h3>
          <span className="text-xs bg-sidebar-accent/10 text-muted-foreground px-3 py-1 rounded-full">{positions.length} active</span>
        </div>
        {positions.length === 0 ? (
          <div className="p-12 text-center">
            <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No open positions. Start trading to see live positions here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-sidebar-accent/10 border-b border-sidebar-border/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-2.5">Symbol</th><th className="px-4 py-2.5">Direction</th>
                  <th className="px-4 py-2.5">Qty</th><th className="px-4 py-2.5">Entry</th>
                  <th className="px-4 py-2.5">LTP</th><th className="px-4 py-2.5">Unrealized P&L</th>
                  <th className="px-4 py-2.5">Holding Time</th><th className="px-4 py-2.5">Sector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sidebar-border/30">
                {positions.map((p: any) => (
                  <tr key={p.id} className="hover:bg-sidebar-accent/5 transition-colors text-sm">
                    <td className="px-4 py-2.5 font-bold text-white">{p.symbol}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${p.direction === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{p.direction}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{p.quantity}</td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">₹{p.entry_price}</td>
                    <td className="px-4 py-2.5 font-mono text-white">₹{p.ltp}</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono font-bold ${p.is_positive ? 'text-green-500' : 'text-red-500'}`}>
                        {p.is_positive ? '+' : ''}₹{p.unrealized_pnl} ({p.pnl_percent}%)
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />{p.holding_minutes > 60 ? `${(p.holding_minutes / 60).toFixed(1)}h` : `${p.holding_minutes}m`}
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><span className="text-[10px] uppercase font-black tracking-widest bg-sidebar-accent/20 text-muted-foreground px-2 py-1 rounded">{p.sector}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 3: SECTOR ANALYSIS (donut chart + risk alerts)
// ═══════════════════════════════════════════════════════════════
function SectorsTab({ sectors }: { sectors: any }) {
  if (!sectors) return null;
  const { allocation, risks, diversity_score, total_sectors, risk_level } = sectors;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Diversification Score</p>
          <p className={`text-5xl font-black font-mono ${diversity_score > 70 ? 'text-green-500' : diversity_score > 40 ? 'text-yellow-500' : 'text-red-500'}`}>{diversity_score}</p>
          <p className="text-xs text-muted-foreground mt-1">out of 100</p>
        </div>
        <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Sectors Covered</p>
          <p className="text-5xl font-black font-mono text-sidebar-primary">{total_sectors}</p>
          <p className="text-xs text-muted-foreground mt-1">unique sectors</p>
        </div>
        <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Risk Level</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Shield className={`w-8 h-8 ${risk_level === 'Low' ? 'text-green-500' : risk_level === 'Medium' ? 'text-yellow-500' : 'text-red-500'}`} />
            <p className={`text-3xl font-black ${risk_level === 'Low' ? 'text-green-500' : risk_level === 'Medium' ? 'text-yellow-500' : 'text-red-500'}`}>{risk_level}</p>
          </div>
        </div>
      </div>

      {/* Chart + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut chart */}
        <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><PieIcon className="w-5 h-5 text-sidebar-primary" /> Sector Allocation</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocation} dataKey="percent" nameKey="sector" cx="50%" cy="50%" innerRadius={70} outerRadius={120} paddingAngle={2} strokeWidth={0} label={({ sector, percent }: any) => `${sector} ${percent}%`} labelLine={false}>
                  {allocation.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px', color: '#fff' }} formatter={(value: any) => [`${value}%`, 'Weight']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector breakdown table */}
        <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Sector Breakdown</h3>
          <div className="space-y-3">
            {allocation.map((s: any) => (
              <div key={s.sector} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-white">{s.sector}</span>
                    <span className="text-xs font-mono text-muted-foreground">{s.percent}% · ₹{s.value.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full bg-sidebar-border/30 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${s.percent}%`, backgroundColor: s.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Concentration Risk Alerts */}
      {risks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-yellow-500" /> Risk Alerts</h3>
          {risks.map((r: any, i: number) => (
            <div key={i} className={`border rounded-xl p-4 flex items-start gap-3 ${r.severity === 'high' ? 'border-red-500/30 bg-red-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${r.severity === 'high' ? 'text-red-500' : 'text-yellow-500'}`} />
              <div>
                <p className="text-sm font-bold text-white">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                <div className="flex gap-3 mt-2">
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-muted-foreground">Current: {r.metric}</span>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-muted-foreground">Threshold: {r.threshold}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {risks.length === 0 && (
        <div className="border border-green-500/20 bg-green-500/5 rounded-xl p-5 flex items-center gap-3">
          <Shield className="w-6 h-6 text-green-500" />
          <div>
            <p className="text-sm font-bold text-green-400">Portfolio Well Diversified</p>
            <p className="text-xs text-muted-foreground">No concentration risks detected. Your allocation looks healthy.</p>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 4: TRADE RESEARCH (behavioral analytics)
// ═══════════════════════════════════════════════════════════════
function ResearchTab({ research }: { research: any }) {
  if (!research) return null;

  const hasData = research.total_trades > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {!hasData ? (
        <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-12 text-center">
          <Brain className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Trade History Yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">Start trading in the simulator to unlock AI-powered behavioral analysis, win rate tracking, and personalized insights.</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Total Trades" value={research.total_trades} color="text-sidebar-primary" />
            <StatCard icon={<Award className="w-5 h-5" />} label="Win Rate" value={`${research.win_rate}%`} color={research.win_rate >= 50 ? 'text-green-500' : 'text-red-500'} />
            <StatCard icon={<Clock className="w-5 h-5" />} label="Avg Hold Time" value={research.avg_holding_time_mins > 60 ? `${(research.avg_holding_time_mins / 60).toFixed(1)}h` : `${research.avg_holding_time_mins}m`} color="text-blue-400" />
            <StatCard icon={<Zap className="w-5 h-5" />} label="Total P&L" value={`₹${research.total_pnl.toLocaleString('en-IN')}`} color={research.total_pnl >= 0 ? 'text-green-500' : 'text-red-500'} />
          </div>

          {/* Win/Loss + Best/Worst */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Win/Loss bar */}
            <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-6">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Win / Loss Distribution</h4>
              <div className="flex gap-1 h-6 rounded-full overflow-hidden mb-3">
                <div className="bg-green-500 transition-all duration-700 flex items-center justify-center" style={{ width: `${research.win_rate}%` }}>
                  {research.win_rate > 15 && <span className="text-[10px] font-bold text-black">{research.wins}W</span>}
                </div>
                <div className="bg-red-500 transition-all duration-700 flex items-center justify-center" style={{ width: `${research.loss_rate}%` }}>
                  {research.loss_rate > 15 && <span className="text-[10px] font-bold text-white">{research.losses}L</span>}
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="text-green-500 font-mono">{research.win_rate}% wins</span>
                <span className="text-red-500 font-mono">{research.loss_rate}% losses</span>
              </div>
            </div>

            {/* Best/Worst Trade */}
            <div className="grid grid-rows-2 gap-3">
              {research.best_trade && (
                <div className="border border-green-500/20 bg-green-500/5 rounded-xl p-4 flex items-center gap-3">
                  <ArrowUpRight className="w-6 h-6 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-green-400 font-bold">Best Trade</p>
                    <p className="text-sm font-bold text-white truncate">{research.best_trade.symbol} · {research.best_trade.direction}</p>
                  </div>
                  <p className="text-lg font-bold font-mono text-green-500">+₹{research.best_trade.pnl}</p>
                </div>
              )}
              {research.worst_trade && (
                <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-4 flex items-center gap-3">
                  <ArrowDownRight className="w-6 h-6 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Worst Trade</p>
                    <p className="text-sm font-bold text-white truncate">{research.worst_trade.symbol} · {research.worst_trade.direction}</p>
                  </div>
                  <p className="text-lg font-bold font-mono text-red-500">₹{research.worst_trade.pnl}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sector Bias + Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sector bias */}
            <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-6">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2"><Target className="w-4 h-4 text-sidebar-primary" /> Trading Sector Bias</h4>
              {research.sector_bias.length > 0 ? (
                <div className="space-y-3">
                  {research.sector_bias.map((s: any) => (
                    <div key={s.sector} className="flex items-center gap-3">
                      <span className="text-sm text-white w-24 truncate">{s.sector}</span>
                      <div className="flex-1 bg-sidebar-border/30 rounded-full h-2">
                        <div className="h-2 bg-sidebar-primary rounded-full transition-all duration-500" style={{ width: `${s.percent}%` }} />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground w-16 text-right">{s.count} ({s.percent}%)</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No sector data available.</p>
              )}
            </div>

            {/* AI Insights */}
            <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-6">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2"><Brain className="w-4 h-4 text-purple-400" /> AI Insights</h4>
              <div className="space-y-3">
                {research.insights.map((insight: string, i: number) => (
                  <div key={i} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                    <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


// ─── Reusable Stat Card ────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: any; color: string }) {
  return (
    <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-5 text-center">
      <div className={`${color} mx-auto mb-2 opacity-60`}>{icon}</div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-black font-mono ${color}`}>{value}</p>
    </div>
  );
}
