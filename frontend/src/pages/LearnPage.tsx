import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, BarChart3, Calculator, Layers, PieChart, Brain,
  GraduationCap, Flame, Trophy, Star, ChevronRight,
  Clock, BookOpen, Play, Lock, Target,
  ArrowRight, Sparkles
} from 'lucide-react';
import { useLearnStore, getXPForLevel } from '../store/useLearnStore';
import type { Track, Badge } from '../store/useLearnStore';
import './LearnPage.css';

// ═══════════════════════════════════════════
// ICON MAPPING
// ═══════════════════════════════════════════
const TRACK_ICONS: Record<string, React.ReactNode> = {
  TrendingUp: <TrendingUp size={28} />,
  BarChart3: <BarChart3 size={28} />,
  Calculator: <Calculator size={28} />,
  Layers: <Layers size={28} />,
  PieChart: <PieChart size={28} />,
  Brain: <Brain size={28} />,
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  Intermediate: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  Advanced: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

// Constants removed as they are now used in TrackDetailPage.tsx

// ═══════════════════════════════════════════
// XP RING COMPONENT
// ═══════════════════════════════════════════
const XPRing: React.FC<{ xp: number; level: number }> = ({ xp, level }) => {
  const currentLevelXP = getXPForLevel(level - 1);
  const nextLevelXP = getXPForLevel(level);
  const progress = Math.min(((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100, 100);
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative xp-ring-animated">
      <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
        {/* Background ring */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6"
          className="text-slate-200 dark:text-white/5" />
        {/* Progress ring */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#xp-gradient)" strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={dashOffset} className="xp-ring-circle" />
        <defs>
          <linearGradient id="xp-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-slate-900 dark:text-white">{level}</span>
        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Level</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// STREAK CALENDAR COMPONENT
// ═══════════════════════════════════════════
const StreakCalendar: React.FC<{ streak: number; lastActiveDate: string | null }> = ({ streak, lastActiveDate }) => {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  const todayDay = today.getDay(); // 0=Sun, 1=Mon...
  const adjustedToday = todayDay === 0 ? 6 : todayDay - 1; // Convert to Mon=0

  return (
    <div className="flex items-center gap-2">
      {days.map((day, i) => {
        const isActiveDay = i <= adjustedToday && i > adjustedToday - Math.min(streak, adjustedToday + 1);
        const isToday = i === adjustedToday;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase">{day}</span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all streak-day ${
              isActiveDay
                ? 'bg-emerald-500 text-white active'
                : isToday && lastActiveDate !== new Date().toISOString().split('T')[0]
                  ? 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 ring-2 ring-emerald-500/30'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-slate-600'
            }`}>
              {isActiveDay ? '✓' : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════
// BADGE CARD
// ═══════════════════════════════════════════
const BadgeCard: React.FC<{ badge: Badge }> = ({ badge }) => (
  <div className={`group relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all min-w-[100px] cursor-default ${
    badge.unlocked
      ? 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 badge-unlocked hover:border-primary/30'
      : 'bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/5 badge-locked'
  }`}>
    <span className="text-3xl">{badge.icon}</span>
    <span className={`text-[10px] font-bold text-center leading-tight ${
      badge.unlocked ? 'text-slate-700 dark:text-white' : 'text-slate-400 dark:text-slate-600'
    }`}>{badge.title}</span>
    {!badge.unlocked && (
      <Lock size={10} className="absolute top-2 right-2 text-slate-300 dark:text-slate-600" />
    )}
    {/* Tooltip */}
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
      {badge.condition}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 dark:bg-white rotate-45" />
    </div>
  </div>
);

// ═══════════════════════════════════════════
// TRACK CARD
// ═══════════════════════════════════════════
const TrackCard: React.FC<{
  track: Track;
  progress: number;
  isActive: boolean;
  onClick: () => void;
  index: number;
}> = ({ track, progress, onClick, index }) => {
  const completedLessons = useLearnStore(s => {
    const allLessons = track.modules.flatMap(m => m.subModules.flatMap(sub => sub.lessons.map(l => l.id)));
    return allLessons.filter(lid => s.completedLessons.includes(lid)).length;
  });

  return (
    <div
      onClick={onClick}
      className={`track-card learn-stagger-enter cursor-pointer relative overflow-hidden rounded-2xl border p-6 group 
        bg-white dark:bg-[#0a0a0a] border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg dark:hover:shadow-2xl hover:border-slate-300 dark:hover:border-white/10 transition-all`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Gradient accent line on top */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${track.color} rounded-t-2xl`} />
      
      {/* Background Decoration */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${track.color} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity blur-2xl`} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${track.color} text-white shadow-lg`}>
          {TRACK_ICONS[track.icon]}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border ${DIFFICULTY_COLORS[track.difficulty]}`}>
            {track.difficulty}
          </span>
          <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      {/* Title & Description */}
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5 tracking-tight">{track.title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 line-clamp-2">{track.description}</p>

      {/* Stats Row */}
      <div className="flex items-center gap-4 mb-4 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
        <span className="flex items-center gap-1">
          <BookOpen size={12} />
          {track.modules.length} Modules
        </span>
        <span className="flex items-center gap-1">
          <Target size={12} />
          {track.totalLessons} Lessons
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {track.totalLessons * 5} min
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
          <div
            className={`progress-fill h-full rounded-full bg-gradient-to-r ${track.color}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
            {completedLessons}/{track.totalLessons} Completed
          </span>
          <span className="text-[10px] font-bold" style={{ color: track.accentColor }}>
            {progress}%
          </span>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// MAIN LEARN PAGE
// ═══════════════════════════════════════════
export default function LearnPage() {
  const {
    tracks, badges, completedLessons, totalXP, level,
    currentStreak, longestStreak, lastActiveDate, learningMinutes,
    getTrackProgress,
    fetchUserStats, fetchTracks
  } = useLearnStore();

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // Check streak and fetch tracks on mount
  useEffect(() => {
    Promise.all([fetchUserStats(), fetchTracks()]).finally(() => setIsLoading(false));
  }, []);

  const unlockedBadges = badges.filter(b => b.unlocked);
  const totalLessons = useMemo(() => tracks.reduce((s, t) => s + t.totalLessons, 0), [tracks]);
  const nextLevelXP = getXPForLevel(level);

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // Find continue learning suggestion
  const continueSuggestion = useMemo(() => {
    for (const track of tracks) {
      for (const mod of track.modules) {
        for (const sub of mod.subModules) {
          const nextLesson = sub.lessons.find(l => !completedLessons.includes(l.id));
          if (nextLesson) {
            return { track, module: mod, subModule: sub, lesson: nextLesson };
          }
        }
      }
    }
    return null;
  }, [tracks, completedLessons]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[600px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Syncing with TradeShift Academy CMS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto pb-20">
      <div className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-8 space-y-8">

        {/* ══════════════ HERO SECTION ══════════════ */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-slate-100 dark:to-[#050505] border border-slate-200 dark:border-white/5 p-8 shadow-sm dark:shadow-2xl">
          {/* Background Effects */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-[80px] -mr-36 -mt-36" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-purple-500/10 rounded-full blur-[60px] -ml-28 -mb-28" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-start justify-between gap-8">
            {/* Left: Title */}
            <div className="space-y-4 text-center lg:text-left flex-1">
              <div className="flex items-center justify-center lg:justify-start gap-2">
                <div className="px-2.5 py-1 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-500/30 flex items-center gap-1">
                  <GraduationCap size={12} />
                  Academy
                </div>
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Financial Education Hub
                </span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
                TradeShift <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600 italic">Academy</span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400 max-w-lg text-sm leading-relaxed">
                Master the markets with structured courses. From stock basics to advanced options —
                earn XP, maintain streaks, and unlock badges as you progress.
              </p>
            </div>

            {/* Right: Stats cards */}
            <div className="flex items-center gap-6 flex-wrap justify-center">
              {/* XP Ring */}
              <div className="flex flex-col items-center gap-2">
                <XPRing xp={totalXP} level={level} />
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-700 dark:text-white">{totalXP} XP</div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500">{nextLevelXP - totalXP} to Lvl {level + 1}</div>
                </div>
              </div>

              {/* Streak */}
              <div className="p-5 bg-white/80 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl backdrop-blur-xl group hover:border-emerald-500/30 transition-all">
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-2 flex items-center gap-1.5">
                  <Flame size={12} className="text-orange-500" /> Current Streak
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-800 dark:text-white group-hover:text-emerald-500 transition-colors">{currentStreak}</span>
                  <span className="streak-flame text-xl">🔥</span>
                </div>
                <div className="text-[9px] text-slate-400 dark:text-slate-600 mt-1">Best: {longestStreak} days</div>
              </div>

              {/* Badges Count */}
              <div className="p-5 bg-white/80 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl backdrop-blur-xl group hover:border-amber-500/30 transition-all">
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-2 flex items-center gap-1.5">
                  <Trophy size={12} className="text-amber-500" /> Badges
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-800 dark:text-white group-hover:text-amber-500 transition-colors">{unlockedBadges.length}</span>
                  <span className="text-sm font-bold text-slate-300 dark:text-slate-600">/{badges.length}</span>
                </div>
                <div className="text-[9px] text-slate-400 dark:text-slate-600 mt-1">Earned</div>
              </div>

              {/* Lessons Progress */}
              <div className="p-5 bg-white/80 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl backdrop-blur-xl group hover:border-blue-500/30 transition-all">
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-2 flex items-center gap-1.5">
                  <BookOpen size={12} className="text-blue-500" /> Lessons Done
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-800 dark:text-white group-hover:text-blue-500 transition-colors">{completedLessons.length}</span>
                  <span className="text-sm font-bold text-slate-300 dark:text-slate-600">/{totalLessons}</span>
                </div>
                <div className="text-[9px] text-slate-400 dark:text-slate-600 mt-1">Completed</div>
              </div>

              {/* Time Spent */}
              <div className="p-5 bg-white/80 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl backdrop-blur-xl group hover:border-emerald-400/30 transition-all">
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-2 flex items-center gap-1.5">
                  <Clock size={12} className="text-emerald-500" /> Time Spent
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-800 dark:text-white group-hover:text-emerald-500 transition-colors uppercase tracking-tight">{formatMinutes(learningMinutes)}</span>
                </div>
                <div className="text-[9px] text-slate-400 dark:text-slate-600 mt-1">Active Learning</div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════ STREAK & BADGES ROW ══════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Streak Calendar */}
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Flame size={16} className="text-orange-500" />
                Weekly Streak
              </h3>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                {currentStreak} Day Streak
              </span>
            </div>
            <StreakCalendar streak={currentStreak} lastActiveDate={lastActiveDate} />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 leading-relaxed">
              Complete at least one lesson each day to maintain your streak. Consistency compounds knowledge. 💪
            </p>
          </div>

          {/* Badge Gallery */}
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Star size={16} className="text-amber-500" />
                Badge Collection
              </h3>
              <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                {unlockedBadges.length} Unlocked
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 badge-gallery">
              {badges.map(badge => (
                <BadgeCard key={badge.id} badge={badge} />
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════ CONTINUE LEARNING ══════════════ */}
        {continueSuggestion && completedLessons.length > 0 && (
          <div className="continue-card relative overflow-hidden rounded-2xl border border-indigo-200 dark:border-indigo-500/10 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/5 dark:to-purple-500/5 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${continueSuggestion.track.color} text-white shadow-lg`}>
                  <Play size={24} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <ArrowRight size={10} /> Continue Learning
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">{continueSuggestion.lesson.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {continueSuggestion.track.title} → {continueSuggestion.module.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  navigate(`/learn/track/${continueSuggestion.track.id}`);
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                Resume
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════ LEARNING TRACKS ══════════════ */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Learning Tracks</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Choose a track and start mastering finance</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              <BookOpen size={14} />
              {tracks.length} Tracks · {totalLessons} Total Lessons
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {tracks.map((track, idx) => {
              const progress = getTrackProgress(track.id);
              return (
                <TrackCard
                  key={track.id}
                  track={track}
                  progress={progress}
                  isActive={false}
                  onClick={() => navigate(`/learn/track/${track.id}`)}
                  index={idx}
                />
              );
            })}
          </div>
        </div>

        {/* ══════════════ METHODOLOGY FOOTER ══════════════ */}
        <div className="p-6 bg-slate-50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/5 rounded-2xl flex flex-col md:flex-row items-center gap-6">
          <div className="p-4 bg-indigo-100 dark:bg-indigo-500/10 rounded-2xl">
            <GraduationCap className="w-8 h-8 text-indigo-500" />
          </div>
          <div className="flex-1 space-y-1 text-center md:text-left">
            <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Structured for Success</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">
              Our curriculum follows the Varsity model — designed by market practitioners, structured as
              Tracks → Modules → Sub-modules → Lessons. Each concept builds on the last. Complete quizzes
              and interactive exercises to cement your understanding and earn bonus XP.
            </p>
          </div>
          <div className="px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-center">
            <div className="text-2xl font-black text-indigo-500">{Math.round((completedLessons.length / totalLessons) * 100)}%</div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Overall</div>
          </div>
        </div>

      </div>
    </div>
  );
}
