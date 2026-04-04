import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useLearnStore, type SubModule } from '../store/useLearnStore';
import { useAccessControl } from '../hooks/useAccessControl';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, BookOpen, ChevronRight, Lock, Sparkles, Trophy,
  Sun, Moon, Bell, LogOut, UserCircle, ChevronDown,
  TrendingUp, Clock, Award, ShieldCheck, Brain,
  BarChart3, Target, Fingerprint
} from 'lucide-react';

interface ModuleDetail {
  id: string;
  title: string;
  description: string;
  moduleNumber: string;
  trackId: string;
  trackTitle: string;
  subModules: SubModule[];
}

// ═══════════════════════════════════════════
// HEADER ACTIONS (Theme, Notifications, User)
// ═══════════════════════════════════════════
const ModuleHeaderActions: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <button
        onClick={() => navigate('/notifications')}
        className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all relative"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-[#0a0a0a]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <div className="h-5 w-px bg-slate-200 dark:bg-white/10" />
      {user ? (
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 pl-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/10"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
              {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
            </div>
            <ChevronDown size={14} className={`text-slate-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {isUserMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl py-2 z-50">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 mb-1">
                  <p className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{user.demat_id || 'N/A'}</p>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium truncate">{user.email}</p>
                </div>
                <Link to="/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                  <UserCircle size={18} /> Profile Settings
                </Link>
                <button onClick={() => { logout(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                  <LogOut size={18} /> Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link to="/login" className="text-sm font-medium text-slate-600 dark:text-gray-300 hover:text-indigo-500 transition-colors">Log In</Link>
          <Link to="/signup" className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-md transition-all">Sign Up</Link>
        </div>
      )}
    </div>
  );
};

export default function ModuleDetailPage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  // Removed unused user
  const { checkAccess } = useAccessControl();
  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { completedLessons } = useLearnStore();
  const [mousePosition, setMousePosition] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    async function fetchModule() {
      try {
        const res = await fetch(`/api/learn/modules/${moduleId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setModule(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchModule();
  }, [moduleId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[600px] bg-black">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-indigo-500/10 rounded-full blur-xl animate-pulse" />
            </div>
          </div>
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] animate-pulse">Initializing Group...</p>
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center p-8 min-h-[600px] bg-black">
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 ring-1 ring-white/10">
          <BookOpen className="w-10 h-10 text-slate-600" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Module Group Not Found</h2>
        <p className="text-slate-500 text-sm max-w-xs mb-8 font-medium">The content you are looking for has either been relocated or does not exist.</p>
        <button onClick={() => navigate('/learn')} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all">
          <ArrowLeft size={14} /> Back to Academy
        </button>
      </div>
    );
  }

  // isGuest removed
  const totalModuleLessons = module.subModules.reduce((acc, sm) => acc + (sm.lessons?.length || 0), 0);
  const completedModuleLessons = module.subModules.reduce((acc, sm) => acc + (sm.lessons || []).filter(l => completedLessons.includes(l.id)).length, 0);
  const progressPct = totalModuleLessons > 0 ? Math.round((completedModuleLessons / totalModuleLessons) * 100) : 0;

  return (
    <div
      className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-white dark:bg-[#030303] selection:bg-indigo-500/30 relative"
      style={{ fontFamily: 'Montserrat, sans-serif' }}
      onMouseMove={(e) => setMousePosition({ x: e.clientX, y: e.clientY })}
    >
      <div className="fixed inset-0 pointer-events-none z-0 mt-16 md:mt-0">
        <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(circle, #4f46e5 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }}></div>
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/15 blur-[150px] rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-500/15 blur-[150px] rounded-full"
        />
      </div>

      {/* Dynamic Cursor Glow */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <motion.div
          animate={{
            x: mousePosition.x - 250,
            y: mousePosition.y - 250,
            opacity: mousePosition.x > -100 ? 0.3 : 0
          }}
          transition={{
            type: 'tween',
            ease: 'easeOut',
            duration: 0.15
          }}
          className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-500/30 rounded-full blur-[140px] mix-blend-screen"
        />
      </div>
      <div className="relative z-10 flex flex-col flex-1">
        {/* ══════════════ NAVIGATION BAR ══════════════ */}
        <div className="sticky top-0 z-50 bg-white/80 dark:bg-black/60 backdrop-blur-xl border-b border-slate-200 dark:border-white/5">
          <div className="w-full px-6 lg:px-10 py-3 flex items-center justify-between">
            {/* Left: Logo + Back */}
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-1 shrink-0">
                <span className="text-lg font-bold tracking-wide text-slate-900 dark:text-white">TRADE</span>
                <span className="text-lg font-bold tracking-wide text-indigo-500">SHIFT</span>
              </Link>
              <div className="h-5 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />
              <button
                onClick={() => navigate(`/learn/track/${module.trackId}`)}
                className="group flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Back to Track
              </button>
            </div>

            {/* Center: Progress */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Group Progress</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{progressPct}%</span>
              </div>
              <div className="w-12 h-12 rounded-full border-2 border-slate-200 dark:border-white/5 flex items-center justify-center relative">
                <svg className="w-10 h-10 transform -rotate-90">
                  <circle
                    cx="20" cy="20" r="18"
                    stroke="currentColor" strokeWidth="3"
                    fill="transparent"
                    className="text-slate-200 dark:text-white/5"
                  />
                  <motion.circle
                    cx="20" cy="20" r="18"
                    stroke="currentColor" strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={113}
                    initial={{ strokeDashoffset: 113 }}
                    animate={{ strokeDashoffset: 113 - (113 * progressPct) / 100 }}
                    transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                    className="text-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                  />
                </svg>
              </div>
            </div>

            {/* Right: Actions */}
            <ModuleHeaderActions />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full px-6 md:px-12 lg:px-20 py-16"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-start">
            {/* ══════════════ MAIN CONTENT (Left Column) ══════════════ */}
            <div className="lg:col-span-8">
              {/* ══════════════ MODULE HEADER ══════════════ */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-20"
              >
                <div className="flex items-baseline gap-4 mb-4">
                  <span className="text-8xl font-black text-slate-900 dark:text-white/5 leading-none select-none" style={{ fontFamily: 'Inter, sans-serif' }}>{module.moduleNumber}</span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.3em]" style={{ fontFamily: 'Inter, sans-serif' }}>Module Group</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight uppercase italic" style={{ fontFamily: 'Inter, sans-serif' }}>{module.title}</h1>
                  </div>
                </div>

                <p className="text-lg text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-2xl border-l-2 border-slate-200 dark:border-white/5 pl-8 mt-6">
                  {module.description}
                </p>
              </motion.div>

              {/* ══════════════ CHAPTER SELECTION ══════════════ */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-8 px-2">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Available Chapters</h3>
                  <div className="flex items-center gap-2">
                    <Sparkles size={12} className="text-indigo-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{module.subModules.length} Segments</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-12 border-l border-slate-200 dark:border-white/5 ml-4 pl-12">
                  {module.subModules.length > 0 ? (
                    module.subModules.map((sm, index) => {
                      const smLessons = sm.lessons || [];
                      const smCompletedCount = smLessons.filter(l => completedLessons.includes(l.id)).length;
                      const smProgress = smLessons.length > 0 ? Math.round((smCompletedCount / smLessons.length) * 100) : 0;
                      const isMastered = smProgress === 100 && smLessons.length > 0;

                      return (
                        <motion.button
                          key={sm.id}
                          initial={{ opacity: 0, x: -30, filter: 'blur(10px)' }}
                          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                          transition={{ delay: index * 0.15, duration: 0.5, type: 'spring', bounce: 0.4 }}
                          whileHover={{ x: 15 }}
                          onClick={() => {
                            if (checkAccess()) navigate(`/learn/chapter/${sm.id}`);
                          }}
                          className="group flex flex-col items-start text-left relative"
                        >
                          {/* Visual Indicator on the line */}
                          <div className={`absolute -left-[53px] top-4 w-[11px] h-[11px] rounded-full border-2 z-10 transition-all duration-500 ${isMastered ? 'border-emerald-500 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-white dark:bg-black border-slate-200 dark:border-white/20 group-hover:border-indigo-500 group-hover:scale-125'
                            }`} />

                          <div className="flex items-start gap-4">
                            <span className={`text-3xl font-black transition-colors duration-300 ${isMastered ? 'text-emerald-500' : 'text-slate-900 dark:text-white/20 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                              {index + 1}.
                            </span>
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <h4 className={`text-2xl md:text-3xl font-black tracking-tight transition-all duration-300 uppercase italic ${isMastered ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                                  {sm.title}
                                </h4>
                                {isMastered && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-500 uppercase tracking-widest"
                                  >
                                    Mastered
                                  </motion.div>
                                )}
                              </div>

                              {sm.description && (
                                <p className="text-slate-500 text-sm leading-relaxed max-w-xl group-hover:text-slate-400 transition-colors">
                                  {sm.description}
                                </p>
                              )}

                              <div className="flex items-center gap-6 pt-2">
                                <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-white/[0.03] rounded-full border border-slate-200 dark:border-white/5 ring-1 ring-slate-100 dark:ring-white/5">
                                  <div className="w-12 h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${smProgress}%` }}
                                      transition={{ duration: 1.5, delay: index * 0.15 + 0.5, ease: "easeOut" }}
                                      className={`h-full ${isMastered ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                    />
                                  </div>
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{smProgress}%</span>
                                </div>

                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300 flex items-center gap-2">
                                  Enter Chapter <ChevronRight size={10} />
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })
                  ) : (
                    <div className="py-20 flex flex-col items-center">
                      <Lock className="w-12 h-12 text-slate-800 mb-4" />
                      <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Chapters Restricting Access</p>
                      <p className="text-[10px] text-slate-600 font-medium mt-1">Check back later for updated content.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ══════════════ SIDEBAR (Right Column) ══════════════ */}
            <aside className="lg:col-span-4 space-y-8 sticky top-24">
              {/* Group Analytics Card */}
              <div className="p-8 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 relative overflow-hidden group/card shadow-sm dark:shadow-none">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <BarChart3 size={12} className="text-indigo-500" /> Group Intelligence
                </h5>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Complexity</span>
                      <span className="text-sm font-black text-slate-900 dark:text-slate-100 italic" style={{ fontFamily: 'Inter, sans-serif' }}>Institutional Grade</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => <div key={i} className={`w-1.5 h-3 rounded-full ${i <= 2 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-200 dark:bg-white/10'}`} />)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Est. Commitment</span>
                      <span className="text-sm font-black text-slate-900 dark:text-slate-100 italic" style={{ fontFamily: 'Inter, sans-serif' }}>~45 Minutes</span>
                    </div>
                    <Clock size={16} className="text-slate-500/50" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Analysis Score</span>
                      <span className="text-sm font-black text-slate-900 dark:text-slate-100 italic" style={{ fontFamily: 'Inter, sans-serif' }}>{progressPct < 50 ? 'Developing' : 'Advanced'}</span>
                    </div>
                    <Target size={16} className="text-emerald-500/50" />
                  </div>
                </div>
              </div>

              {/* Institutional Rewards Card */}
              <div className="p-8 rounded-xl bg-indigo-500/[0.03] dark:bg-black border border-indigo-500/10 dark:border-white/5 relative overflow-hidden group/rewards shadow-sm dark:shadow-none">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.02] to-transparent pointer-events-none" />
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <Award size={12} className="text-indigo-500" /> Potential Mastery
                </h5>

                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-indigo-500 shadow-inner group-hover/rewards:scale-110 transition-transform">
                    <Trophy size={28} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>+500</span>
                      <span className="text-[10px] font-black text-indigo-500 uppercase">XP Bonus</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-gray-500 font-medium leading-relaxed">Master all 7 segments to unlock the 'Group Analyst' badge.</p>
                  </div>
                </div>
              </div>

              {/* Varsity Analyst Tip Card */}
              <div className="p-8 rounded-xl bg-slate-900 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-center gap-2 mb-4 text-indigo-400">
                  <ShieldCheck size={14} />
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ fontFamily: 'Inter, sans-serif' }}>Varsity Specialist Advice</span>
                </div>
                <p className="text-sm font-medium text-slate-300 italic leading-relaxed relative z-10">
                  "When analyzing this group, focus on the relationship between Volume and Price Action. The strongest signals often appear when the chapters overlap."
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold">V</div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Chief Market Analyst</span>
                </div>
              </div>

              {/* Meta Stats */}
              <div className="px-8 flex items-center justify-between opacity-50 transition-opacity hover:opacity-100">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID Reference</span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">MOD_GR_SYSC_2026</span>
                </div>
                <Fingerprint size={16} className="text-slate-400" />
              </div>
            </aside>
          </div>
        </motion.div>

        {/* Decorative footer */}
        <div className="mt-auto py-20 px-6 md:px-20 border-t border-slate-200 dark:border-white/5 bg-gradient-to-b from-transparent to-indigo-500/[0.02] dark:to-indigo-500/5">
          <div className="w-full flex flex-col items-start text-left">
            <Trophy className="w-8 h-8 text-indigo-500/20 mb-4" />
            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>Goal Objective</h5>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium max-w-sm">Complete all chapters in this group to earn 500 XP and the module completion badge.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
