import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
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
  { id: 'history', label: 'Trade History', icon: Clock },
  { id: 'sectors', label: 'Sector Analysis', icon: PieIcon },
  { id: 'research', label: 'Advanced Analytics', icon: Brain },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Main Component ────────────────────────────────────────────
export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<TabId>('holdings');
  const [summary, setSummary] = useState<any>(null);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any[]>([]);
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
      const [sumR, holdR, posR, secR, resR, histR, monthR] = await Promise.all([
        api.get('/api/portfolio/summary', { params }),
        api.get('/api/portfolio/holdings', { params }),
        api.get('/api/portfolio/positions', { params }),
        api.get('/api/portfolio/sectors', { params }),
        api.get('/api/portfolio/research', { params }),
        api.get('/api/history/trades', { params: { ...params, limit: 100 } }),
        api.get('/api/history/monthly-summary', { params }),
      ]);
      setSummary(sumR.data);
      setHoldings(holdR.data.holdings || []);
      setPositions(posR.data.positions || []);
      setSectors(secR.data);
      setResearch(resR.data);
      setHistory(histR.data.trades || []);
      setMonthlySummary(monthR.data.months || []);
    } catch (err) {
      console.error('Portfolio fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [sessionType]);

  const s = summary || fallback;

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto space-y-8 font-sans pb-20">
      
      {/* ─── Header & Summary ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
             Portfolio <span className="text-sidebar-primary text-sm bg-sidebar-primary/10 px-2 py-0.5 rounded uppercase tracking-widest">{sessionType}</span>
          </h2>
          <p className="text-muted-foreground text-sm">Real-time asset tracking and behavioral analytics.</p>
        </div>
        <button onClick={fetchAll} disabled={loading} className="p-2.5 rounded-full bg-sidebar-accent/50 hover:bg-sidebar-accent text-sidebar-primary transition-colors disabled:opacity-50">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main P&L Card */}
        <div className="lg:col-span-1 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-8 flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
            <Briefcase size={140} />
          </div>
          <div className="space-y-1 z-10">
            <p className="text-[10px] uppercase font-black tracking-widest text-gray-500 dark:text-muted-foreground">Current Value</p>
            <h3 className="text-5xl font-black text-slate-800 dark:text-white font-mono tracking-tighter">
              ₹{s.current_value.toLocaleString('en-IN')}
            </h3>
          </div>
          <div className="mt-8 space-y-4 z-10">
            <div className="flex justify-between items-end border-b border-sidebar-border/30 pb-3">
              <span className="text-xs text-gray-500 dark:text-muted-foreground">Total Invested</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">₹{s.total_invested.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-xs text-gray-500 dark:text-muted-foreground">Total Profit/Loss</span>
              <div className={`flex flex-col items-end`}>
                 <div className={`flex items-center gap-1 font-black font-mono text-xl ${s.is_positive ? 'text-green-500' : 'text-red-500'}`}>
                    {s.is_positive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    {s.is_positive ? '+' : ''}{s.total_pnl.toLocaleString('en-IN')}
                 </div>
                 <span className={`text-xs font-bold ${s.is_positive ? 'text-green-500/80' : 'text-red-500/80'}`}>{s.pnl_percent}% absolute</span>
              </div>
            </div>
          </div>
        </div>

        {/* Equity Curve Chart */}
        <div className="lg:col-span-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-6 min-h-[300px]">
           <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                 <BarChart3 className="w-4 h-4 text-sidebar-primary" />
                 <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Equity Growth (30D)</span>
              </div>
              <div className="flex items-center gap-4">
                 <div className="text-right">
                    <p className="text-[10px] text-gray-500 dark:text-muted-foreground uppercase font-black tracking-widest">XIRR (Annualized)</p>
                    <p className="text-lg font-black font-mono text-sidebar-primary">{s.xirr_percent}%</p>
                 </div>
              </div>
           </div>
           <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={s.equity_curve}>
                  <defs>
                    <linearGradient id="curveColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={s.is_positive ? '#22c55e' : '#f43f5e'} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={s.is_positive ? '#22c55e' : '#f43f5e'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px', color: '#fff' }} />
                  <Area type="monotone" dataKey="value" stroke={s.is_positive ? '#22c55e' : '#f43f5e'} fillOpacity={1} fill="url(#curveColor)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* ─── Detailed Tabs ─── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="w-full">
        <TabsList className="bg-sidebar-accent/50 p-1 space-x-1 mb-8 overflow-x-auto no-scrollbar flex-nowrap w-full justify-start rounded-xl">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-sidebar-primary dark:data-[state=active]:text-black font-bold text-xs flex items-center gap-2 py-2.5 px-5 transition-all">
              <tab.icon size={14} /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="holdings">
          <HoldingsTab holdings={holdings} />
        </TabsContent>
        <TabsContent value="positions">
          <PositionsTab positions={positions} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab history={history} sessionType={sessionType} />
        </TabsContent>
        <TabsContent value="sectors">
          <SectorsTab sectors={sectors} />
        </TabsContent>
        <TabsContent value="research">
          <ResearchTab research={research} monthlySummary={monthlySummary} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: HOLDINGS (Equity Portfolio)
// ═══════════════════════════════════════════════════════════════
function HoldingsTab({ holdings }: { holdings: any[] }) {
  return (
    <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="bg-sidebar-accent/30 text-[10px] uppercase font-black tracking-widest text-gray-500 dark:text-muted-foreground">
            <tr>
              <th className="px-6 py-4">Instrument</th>
              <th className="px-6 py-4">Quantity</th>
              <th className="px-6 py-4">Avg. Cost</th>
              <th className="px-6 py-4">LTP</th>
              <th className="px-6 py-4">Invested</th>
              <th className="px-6 py-4">Current Val</th>
              <th className="px-6 py-4">P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {holdings.length === 0 ? (
               <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">No equity holdings found. Place delivery trades to see them here.</td></tr>
            ) : holdings.map((h) => (
              <tr key={h.symbol} className="hover:bg-sidebar-accent/20 transition-colors">
                <td className="px-6 py-5">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{h.symbol}</span>
                </td>
                <td className="px-6 py-5 font-mono text-sm text-gray-500 dark:text-muted-foreground">{h.quantity}</td>
                <td className="px-6 py-5 font-mono text-sm text-gray-500 dark:text-muted-foreground">₹{h.average_cost}</td>
                <td className="px-6 py-5 font-mono text-sm text-gray-500 dark:text-muted-foreground">₹{h.ltp}</td>
                <td className="px-6 py-5 font-mono text-sm text-gray-900 dark:text-white">₹{h.invested_value.toLocaleString('en-IN')}</td>
                <td className="px-6 py-5 font-mono text-sm text-gray-900 dark:text-white font-bold">₹{h.current_value.toLocaleString('en-IN')}</td>
                <td className="px-6 py-5">
                  <div className={`font-mono font-bold text-sm ${h.is_positive ? 'text-green-500' : 'text-red-500'}`}>
                    {h.is_positive ? '+' : ''}₹{h.pnl.toLocaleString('en-IN')}
                    <span className="block text-[10px] opacity-70">({h.pnl_percent}%)</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: OPEN POSITIONS (Active Trades)
// ═══════════════════════════════════════════════════════════════
function PositionsTab({ positions }: { positions: any[] }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Active Intraday / Swing Positions</h3>
            <span className="text-[10px] bg-sidebar-primary/20 text-sidebar-primary px-2 py-0.5 rounded font-bold">{positions.length} Open</span>
        </div>
        {positions.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No open positions in the current session.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-sidebar-accent/10 border-b border-white/5 text-[10px] font-black uppercase text-gray-400">
                <tr>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">LTP</th>
                  <th className="px-4 py-3">Unrealized P&L</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Sector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {positions.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">{p.symbol}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${p.direction === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{p.direction}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-gray-500 dark:text-muted-foreground">{p.quantity}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-500 dark:text-muted-foreground">₹{p.entry_price}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-900 dark:text-white">₹{p.ltp}</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono font-bold ${p.is_positive ? 'text-green-500' : 'text-red-500'}`}>
                        {p.is_positive ? '+' : ''}₹{p.unrealized_pnl} ({p.pnl_percent}%)
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-muted-foreground text-xs">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />{p.holding_minutes > 60 ? `${(p.holding_minutes / 60).toFixed(1)}h` : `${p.holding_minutes}m`}
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><span className="text-[10px] uppercase font-black tracking-widest bg-sidebar-accent/20 text-gray-500 dark:text-muted-foreground px-2 py-1 rounded">{p.sector}</span></td>
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
// TAB 3: TRADE HISTORY (Historical Logs)
// ═══════════════════════════════════════════════════════════════
function HistoryTab({ history, sessionType }: { history: any[], sessionType: string }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Completed Trades ({sessionType})</h3>
        <a 
          href={`/api/history/trades/export?session_type=${sessionType}`} 
          className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-sidebar-accent/50 hover:bg-sidebar-accent rounded-lg border border-sidebar-border/30 transition-all text-sidebar-primary"
        >
          Download CSV
        </a>
      </div>
      <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-sidebar-accent/30 text-[10px] uppercase font-black tracking-widest text-gray-500 dark:text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Symbol</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Entry / Exit</th>
                <th className="px-6 py-4">Qty</th>
                <th className="px-6 py-4">P&L</th>
                <th className="px-6 py-4">Holding Time</th>
                <th className="px-6 py-4">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {history.length === 0 ? (
                 <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">No historical trades found for this session.</td></tr>
              ) : history.map((t) => (
                <tr key={t.id} className="hover:bg-sidebar-accent/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800 dark:text-white">{t.symbol}</span>
                      <span className="text-[10px] uppercase font-black text-gray-400">{t.sector}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${t.direction === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{t.direction}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-muted-foreground whitespace-nowrap">
                    <div>Entry: ₹{t.entry_price}</div>
                    <div>Exit: ₹{t.exit_price}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-500 dark:text-muted-foreground">{t.quantity}</td>
                  <td className="px-6 py-4">
                    <div className={`font-mono font-bold text-sm ${t.is_win ? 'text-green-500' : 'text-red-500'}`}>
                      {t.is_win ? '+' : ''}₹{t.pnl.toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 dark:text-muted-foreground">
                    {t.holding_time > 60 ? `${(t.holding_time / 60).toFixed(1)}h` : `${t.holding_time}m`}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 dark:text-muted-foreground italic max-w-[150px] truncate">{t.exit_reason || "Market Exit"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: SECTOR ANALYSIS (donut chart + risk alerts)
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
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">out of 100</p>
        </div>
        <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Sectors Covered</p>
          <p className="text-5xl font-black font-mono text-sidebar-primary">{total_sectors}</p>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">unique sectors</p>
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
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{s.sector}</span>
                    <span className="text-xs font-mono text-gray-500 dark:text-muted-foreground">{s.percent}% · ₹{s.value.toLocaleString('en-IN')}</span>
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-yellow-500" /> Risk Alerts</h3>
          {risks.map((r: any, i: number) => (
            <div key={i} className={`border rounded-xl p-4 flex items-start gap-3 ${r.severity === 'high' ? 'border-red-500/30 bg-red-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${r.severity === 'high' ? 'text-red-500' : 'text-yellow-500'}`} />
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{r.title}</p>
                <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">{r.description}</p>
                <div className="flex gap-3 mt-2">
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-500 dark:text-muted-foreground">Current: {r.metric}</span>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-500 dark:text-muted-foreground">Threshold: {r.threshold}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {risks.length === 0 && (
        <div className="p-6 border border-green-500/10 bg-green-500/5 rounded-xl flex items-center gap-3">
          <Shield className="text-green-500 w-5 h-5" />
          <p className="text-sm font-medium text-green-500">Your portfolio is well-diversified. No major concentration risks detected.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 5: ADVANCED ANALYTICS (behavioral + performance)
// ═══════════════════════════════════════════════════════════════
function ResearchTab({ research, monthlySummary }: { research: any, monthlySummary: any[] }) {
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
                  {research.loss_rate > 15 && <span className="text-[10px] font-bold text-gray-900 dark:text-white">{research.losses}L</span>}
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-muted-foreground">
                <span className="text-green-500 font-mono">{research.win_rate}% wins</span>
                <span className="text-red-500 font-mono">{research.loss_rate}% losses</span>
              </div>
            </div>

            {/* Monthly Performance Chart */}
            <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-6">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Performance by Month</h4>
              <div className="h-[100px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySummary}>
                    <XAxis dataKey="label" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="total_pnl" radius={[4, 4, 0, 0]}>
                      {(monthlySummary || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.total_pnl >= 0 ? '#22c55e' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-center text-gray-500 mt-2">Cumulative P&L per month</p>
            </div>

            {/* Best/Worst Trade */}
            <div className="grid grid-rows-2 gap-3">
              {research.best_trade && (
                <div className="border border-green-500/20 bg-green-500/5 rounded-xl p-4 flex items-center gap-3">
                  <ArrowUpRight className="w-6 h-6 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-green-400 font-bold">Best Trade</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{research.best_trade.symbol} · {research.best_trade.direction}</p>
                  </div>
                  <p className="text-lg font-bold font-mono text-green-500">+₹{research.best_trade.pnl}</p>
                </div>
              )}
              {research.worst_trade && (
                <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-4 flex items-center gap-3">
                  <ArrowDownRight className="w-6 h-6 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Worst Trade</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{research.worst_trade.symbol} · {research.worst_trade.direction}</p>
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
                      <span className="text-sm text-gray-900 dark:text-white w-24 truncate">{s.sector}</span>
                      <div className="flex-1 bg-sidebar-border/30 rounded-full h-2">
                        <div className="h-2 bg-sidebar-primary rounded-full transition-all duration-500" style={{ width: `${s.percent}%` }} />
                      </div>
                      <span className="text-xs font-mono text-gray-500 dark:text-muted-foreground w-16 text-right">{s.count} ({s.percent}%)</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-muted-foreground text-sm">No sector data available.</p>
              )}
            </div>

            {/* AI Insights */}
            <div className="border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121212] rounded-md p-6">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2"><Brain className="w-4 h-4 text-purple-400" /> AI Insights</h4>
              <div className="space-y-3">
                {research.insights.map((insight: string, i: number) => (
                  <div key={i} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                    <p className="text-sm text-gray-500 dark:text-muted-foreground leading-relaxed">{insight}</p>
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
      <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-black font-mono ${color}`}>{value}</p>
    </div>
  );
}
