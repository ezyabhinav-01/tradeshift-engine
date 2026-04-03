import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, BookOpen,
  TrendingUp, BarChart3, Calculator, Layers, PieChart, Brain,
  Award, ArrowRight, GraduationCap, Sparkles, Flame
} from 'lucide-react';
import { useLearnStore, getXPForLevel, type Module, type Lesson } from '../store/useLearnStore';
import { useAuth } from '../context/AuthContext';
import './LearnPage.css';

const TRACK_ICONS: Record<string, React.ReactNode> = {
  TrendingUp: <TrendingUp size={32} />,
  BarChart3: <BarChart3 size={32} />,
  Calculator: <Calculator size={32} />,
  Layers: <Layers size={32} />,
  PieChart: <PieChart size={32} />,
  Brain: <Brain size={32} />,
};

// ═══════════════════════════════════════════
// XP RING COMPONENT (Mirrored from LearnPage)
// ═══════════════════════════════════════════
const XPRing: React.FC<{ xp: number; level: number }> = ({ xp, level }) => {
  const currentLevelXP = getXPForLevel(level - 1);
  const nextLevelXP = getXPForLevel(level);
  const progress = Math.min(((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100, 100);
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative xp-ring-animated">
      <svg width="80" height="80" viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6"
          className="text-slate-200 dark:text-white/5" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#xp-gradient-track)" strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={dashOffset} className="xp-ring-circle" />
        <defs>
          <linearGradient id="xp-gradient-track" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-white">{level}</span>
        <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Level</span>
      </div>
    </div>
  );
};

const TrackDetailPage: React.FC = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGuest = !user;
  const { 
    tracks, completedLessons, totalXP, level,
    currentStreak,
    getTrackProgress, getModuleProgress,
    fetchTracks, fetchUserStats 
  } = useLearnStore();

  useEffect(() => {
    if (tracks.length === 0) {
      Promise.all([fetchTracks(), fetchUserStats()]);
    }
  }, [tracks.length, fetchTracks, fetchUserStats]);

  const track = useMemo(() => tracks.find(t => t.id === trackId), [tracks, trackId]);
  const progress = track ? getTrackProgress(track.id) : 0;

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] text-center p-8">
        <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
          <BookOpen size={32} className="text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Module Not Found</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
          The learning module you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/learn')}
          className="px-6 py-2.5 rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-400 transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Back to Academy
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      {/* ══════════════ STICKY TOP BAR ══════════════ */}
      <div className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/learn')}
            className="group flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Academy
          </button>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Your Progress</span>
              <span className="text-sm font-black text-white">{isGuest ? 0 : progress}% Complete</span>
            </div>
            <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden hidden md:block">
              <div 
                className={`h-full bg-gradient-to-r ${track.color} transition-all duration-1000`}
                style={{ width: `${isGuest ? 0 : progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-6 py-12 space-y-12">
        {/* ══════════════ HERO SECTION (Theme Match Image 1) ══════════════ */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-slate-100 dark:to-[#0d0d0d] border border-slate-200 dark:border-white/10 p-8 shadow-sm dark:shadow-2xl backdrop-blur-3xl">
          {/* Background Effects */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-[80px] -mr-36 -mt-36" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-purple-500/10 rounded-full blur-[60px] -ml-28 -mb-28" />
          
          {/* Dot Pattern Overlay - Moved to top of background stack for visibility */}
          <div className="absolute inset-0 opacity-[0.25] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #4f46e5 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

          <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-start justify-between gap-8">
            {/* Left: Title */}
            <div className="space-y-4 text-center lg:text-left flex-1">
              <div className="flex items-center justify-center lg:justify-start gap-2">
                <div className="px-2.5 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-500/30 flex items-center gap-1">
                  <GraduationCap size={12} />
                  Academy
                </div>
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Financial Education Hub
                </span>
              </div>
              
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${track.color} text-white shadow-2xl`}>
                  {TRACK_ICONS[track.icon]}
                </div>
                <div>
                  <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-white leading-[1.15] py-2">
                    {track.title.split(' ')[0]} <span className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600 italic px-2 pb-2">{track.title.split(' ').slice(1).join(' ')}</span>
                  </h1>
                  <p className="text-slate-400 mt-2 max-w-lg text-sm leading-relaxed">
                    {track.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Stats cards (Theme Match) */}
            <div className="flex items-center gap-6 flex-wrap justify-center">
              {/* XP Ring */}
              <div className="flex flex-col items-center gap-2">
                <XPRing xp={isGuest ? 0 : totalXP} level={isGuest ? 1 : level} />
                <div className="text-center">
                  <div className="text-xs font-bold text-white">{isGuest ? 0 : totalXP} XP</div>
                  <div className="text-[9px] text-slate-500">Total Progress</div>
                </div>
              </div>

              {/* Streak */}
              <div className="p-5 bg-black/40 border border-white/5 rounded-2xl backdrop-blur-xl group hover:border-emerald-500/30 transition-all min-w-[120px]">
                <div className="text-[10px] text-slate-500 font-bold uppercase mb-2 flex items-center gap-1.5 line-clamp-1">
                  <Flame size={12} className="text-orange-500" /> Streak
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors">{isGuest ? 0 : currentStreak}</span>
                  <span className="streak-flame text-xl">🔥</span>
                </div>
              </div>

              {/* Module Lessons Count */}
              <div className="p-5 bg-black/40 border border-white/5 rounded-2xl backdrop-blur-xl group hover:border-blue-500/30 transition-all min-w-[120px]">
                <div className="text-[10px] text-slate-500 font-bold uppercase mb-2 flex items-center gap-1.5 line-clamp-1">
                  <BookOpen size={12} className="text-blue-500" /> Lessons
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white group-hover:text-blue-400 transition-colors">
                    {completedLessons.filter((id: string) => track.modules.some((m: Module) => m.lessons.some((l: Lesson) => l.id === id))).length}
                  </span>
                  <span className="text-sm font-bold text-slate-600">/{track.totalLessons}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════ CHAPTER INDEX ══════════════ */}
        <div className="space-y-16">
          {track.modules.map((module: Module, mIdx: number) => {
            const modProgress = getModuleProgress(module.id);
            return (
              <div key={module.id} className="space-y-8">
                {/* Module Card Link */}
                <button
                  onClick={() => navigate(`/learn/module/${module.id}`)}
                  className="group relative flex items-center justify-between p-8 rounded-[2rem] bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-indigo-500/30 transition-all w-full text-left overflow-hidden"
                >
                  {/* Subtle background glow */}
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-center gap-8 relative z-10">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black bg-white/5 text-white/20 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-all ring-1 ring-white/5">
                      {String(mIdx + 1).padStart(2, '0')}
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-100 group-hover:text-white transition-colors tracking-tight">
                        {module.title}
                      </h3>
                      <p className="text-slate-500 text-sm mt-1 group-hover:text-slate-400 transition-colors">
                        {module.description}
                      </p>
                      <div className="flex items-center gap-4 mt-4">
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] flex items-center gap-2">
                           VIEW {module.subModules?.length || 0} CHAPTERS <ArrowRight size={10} />
                        </span>
                        <div className="h-1 w-1 rounded-full bg-slate-700" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                          {Math.round(modProgress)}% COMPLETE
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:flex flex-col items-end gap-3 relative z-10">
                     <div className="w-40 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${track.color} shadow-[0_0_10px_rgba(99,102,241,0.5)]`}
                          style={{ width: `${modProgress}%` }}
                        />
                     </div>
                     <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        {isGuest ? 0 : Math.round(modProgress)}% OF GROUP MASTERED
                     </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* ══════════════ ACTION FOOTER ══════════════ */}
        <div className="pt-12 border-t border-white/5">
          <div className="relative overflow-hidden p-10 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-transparent border border-white/5 text-center space-y-6">
            {/* Dot Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
            
            <div className="relative z-10">
              <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-2xl">
                <Award size={40} className="text-indigo-400 shadow-xl shadow-indigo-500/20" />
              </div>
              <h3 className="text-3xl font-black text-white tracking-tighter italic">Ready for the <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">Next Milestone?</span></h3>
              <p className="text-slate-400 max-w-md mx-auto mt-2 text-sm leading-relaxed">
                Each chapter you complete brings you closer to mastering {track.title}. Keep going to earn your module completion badge and climb its leaderboard.
              </p>
              <div className="pt-8">
                <Link
                  to="/learn"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all border border-white/10 hover:border-indigo-500/30 shadow-xl"
                >
                  Explore Other Modules <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackDetailPage;
