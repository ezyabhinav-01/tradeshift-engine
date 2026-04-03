import { create } from 'zustand';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

export interface Lesson {
  id: string;
  title: string;
  duration: number; // minutes
  xpReward: number;
  type: 'article' | 'video' | 'quiz' | 'interactive';
}

export interface SubModule {
  id: string;
  title: string;
  description?: string;
  subModuleNumber: string | null;
  lessons: Lesson[];
}

export interface Module {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  subModules: SubModule[];
  lessons: Lesson[]; // Direct lessons
}

export interface Track {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  color: string; // tailwind gradient class
  accentColor: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  modules: Module[];
  totalLessons: number;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  condition: string;
}

// ═══════════════════════════════════════════
// MOCK DATA — Rich 4-Level Hierarchy
// ═══════════════════════════════════════════

const AESTHETICS = [
  { icon: 'TrendingUp', color: 'from-emerald-500 to-teal-600', accentColor: '#10b981', difficulty: 'Beginner' as const },
  { icon: 'BarChart3', color: 'from-indigo-500 to-violet-600', accentColor: '#6366f1', difficulty: 'Intermediate' as const },
  { icon: 'Calculator', color: 'from-amber-500 to-orange-600', accentColor: '#f59e0b', difficulty: 'Intermediate' as const },
  { icon: 'Layers', color: 'from-rose-500 to-pink-600', accentColor: '#f43f5e', difficulty: 'Advanced' as const },
  { icon: 'PieChart', color: 'from-cyan-500 to-blue-600', accentColor: '#06b6d4', difficulty: 'Intermediate' as const },
  { icon: 'Brain', color: 'from-purple-500 to-fuchsia-600', accentColor: '#a855f7', difficulty: 'Beginner' as const },
];

const DEFAULT_BADGES: Badge[] = [
  // --- Milestones ---
  { id: 'first_steps', title: 'First Steps', description: 'Complete your first lesson', icon: '🎯', unlocked: false, condition: 'Complete 1 lesson' },
  { id: 'scholar', title: 'Academy Scholar', description: 'First module completed', icon: '📚', unlocked: false, condition: 'Complete 1 module' },
  { id: 'track_master', title: 'Track Master', description: 'Mastered an entire track', icon: '🛤️', unlocked: false, condition: 'Finish all modules in a track' },
  
  // --- XP Levels ---
  { id: 'bronze_trader', title: 'Bronze Trader', description: 'Earn 100 XP', icon: '🥉', unlocked: false, condition: 'Reach 100 XP' },
  { id: 'silver_trader', title: 'Silver Trader', description: 'Earn 500 XP', icon: '🥈', unlocked: false, condition: 'Reach 500 XP' },
  { id: 'gold_trader', title: 'Gold Trader', description: 'Earn 1000 XP', icon: '🥇', unlocked: false, condition: 'Reach 1000 XP' },
  { id: 'emerald_elite', title: 'Emerald Elite', description: 'Earn 2500 XP', icon: '💎', unlocked: false, condition: 'Reach 2500 XP' },
  { id: 'diamond_hands', title: 'Diamond Hands', description: 'Earn 5000 XP', icon: '💠', unlocked: false, condition: 'Reach 5000 XP' },
  
  // --- Streaks ---
  { id: 'on_fire', title: 'On Fire', description: '3-day learning streak', icon: '🔥', unlocked: false, condition: '3 consecutive days' },
  { id: 'unstoppable', title: 'Charging Bull', description: '7-day learning streak', icon: '🐂', unlocked: false, condition: '7 consecutive days' },
  { id: 'market_regular', title: 'Market Regular', description: '14-day learning streak', icon: '📅', unlocked: false, condition: '14 consecutive days' },
  { id: 'consistency_king', title: 'Consistency King', description: '30-day learning streak', icon: '👑', unlocked: false, condition: '30 consecutive days' },
  
  // --- Thematic ---
  { id: 'baby_bull', title: 'Baby Bull', description: 'Basics of Trading master', icon: '🐃', unlocked: false, condition: 'Complete Basics module' },
  { id: 'iron_bear', title: 'Iron Bear', description: 'Risk Management master', icon: '🐻', unlocked: false, condition: 'Complete Risk module' },
  { id: 'wolf_of_ts', title: 'Wolf of TradeShift', description: 'High difficulty track completed', icon: '🐺', unlocked: false, condition: 'Complete Advanced track' },
  { id: 'chart_wizard', title: 'Chart Wizard', description: 'Technical Analysis master', icon: '📉', unlocked: false, condition: 'Complete TA module' },
  { id: 'option_eagle', title: 'Option Eagle', description: 'Options Trading master', icon: '🦅', unlocked: false, condition: 'Complete Options module' },
  { id: 'fundamental_pro', title: 'Fundamental Pro', description: 'Fundamental Analysis master', icon: '📊', unlocked: false, condition: 'Complete Fundamental module' },
  
  // --- Lifestyle ---
  { id: 'night_owl', title: 'Night Owl', description: 'Late night learner', icon: '🦉', unlocked: false, condition: 'Complete lesson 10PM - 4AM' },
  { id: 'early_bird', title: 'Early Bird', description: 'Pre-market prep', icon: '🌅', unlocked: false, condition: 'Complete lesson 5AM - 8AM' },
  
  // --- Final ---
  { id: 'market_legend', title: 'Market Legend', description: 'Completed every module', icon: '🏆', unlocked: false, condition: '100% Academy completion' },
];

// ═══════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════

interface LearnState {
  // Data
  tracks: Track[];
  badges: Badge[];

  // User progress
  completedLessons: string[]; // lesson IDs
  totalXP: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // ISO date string (YYYY-MM-DD)
  lessonsToday: number;
  quizzesCompleted: number;
  tracksStarted: string[]; // track IDs
  learningMinutes: number; // dynamically tracked DB minutes

  // UI state
  activeTrackId: string | null;
  activeModuleId: string | null;

  // Actions
  fetchTracks: () => Promise<void>;
  fetchUserStats: () => Promise<void>;
  completeLesson: (lessonId: string, trackId: string) => Promise<void>;
  setActiveTrack: (trackId: string | null) => void;
  setActiveModule: (moduleId: string | null) => void;
  getTrackProgress: (trackId: string) => number;
  getModuleProgress: (moduleId: string) => number;
  logLearningTime: (minutes: number) => Promise<void>;
}

export function getXPForLevel(level: number): number {
  const thresholds = [0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250, 3000];
  return thresholds[Math.min(level, 10)] || 3000;
}

export const useLearnStore = create<LearnState>((set, get) => ({
  tracks: [],
  badges: DEFAULT_BADGES,

  // Progress defaults (overwritten by fetchUserStats)
  completedLessons: [],
  totalXP: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  lessonsToday: 0,
  quizzesCompleted: 0,
  tracksStarted: [],
  learningMinutes: 0,

  // UI
  activeTrackId: null,
  activeModuleId: null,

  // Actions
  fetchUserStats: async () => {
    try {
      const res = await fetch('/api/learn/stats');
      if (res.ok) {
        const data = await res.json();
        
        // Merge backend badges with our UI defaults
        const backendBadgeIds = data.badges.map((b: any) => b.badge_id);
        const mergedBadges = DEFAULT_BADGES.map(defaultBadge => {
          const backendBadge = data.badges.find((b: any) => b.badge_id === defaultBadge.id);
          return {
            ...defaultBadge,
            unlocked: backendBadgeIds.includes(defaultBadge.id),
            unlockedAt: backendBadge ? backendBadge.earned_at : undefined,
          };
        });

        set({
          totalXP: data.total_xp,
          level: data.level,
          currentStreak: data.current_streak,
          longestStreak: data.longest_streak,
          lastActiveDate: data.last_active_date,
          completedLessons: data.completed_lessons,
          badges: mergedBadges,
          learningMinutes: data.learning_minutes,
        });
      }
    } catch (e) {
      console.error("Failed to fetch user stats", e);
    }
  },

  logLearningTime: async (minutes: number) => {
    try {
      const res = await fetch('/api/learn/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      });
      if (res.ok) {
        const data = await res.json();
        set({ learningMinutes: data.total_learning_minutes });
      }
    } catch (e) {
      console.error("Failed to log learning time", e);
    }
  },

  fetchTracks: async () => {
    try {
      const res = await fetch('/api/learn/tracks');
      const data = await res.json();
      if (Array.isArray(data)) {
        // Map aesthetics dynamically based on index to keep the CMS clean
        const stylizedTracks = data.map((track, i) => {
          const style = AESTHETICS[i % AESTHETICS.length];
          return {
            ...track,
            ...style
          };
        });
        set({ tracks: stylizedTracks });
      }
    } catch (e) {
      console.error("Failed to fetch tracks", e);
    }
  },

  completeLesson: async (lessonId: string, trackId: string) => {
    const state = get();
    if (state.completedLessons.includes(lessonId)) return;

    let xpGained = 0;
    
    // Exact backend progress saving
    try {
      const res = await fetch('/api/learn/progress', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ lesson_id: lessonId, track_id: trackId, xp_earned: xpGained })
      });
      if (res.ok) {
        const data = await res.json();
        // Server calculates the actual XP Reward and awards it
        if (data.xp_earned) {
          xpGained = data.xp_earned;
        }
      }
    } catch (err) {
      console.error("Failed to sync progress on backend", err);
    }

    // Refresh all stats cleanly from backend directly
    await get().fetchUserStats();
  },

  setActiveTrack: (trackId) => set({ activeTrackId: trackId, activeModuleId: null }),
  setActiveModule: (moduleId) => set({ activeModuleId: moduleId }),

  getTrackProgress: (trackId: string) => {
    const state = get();
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return 0;
    
    // Flatten all possible lessons (direct in modules + inside submodules)
    const allLessons: string[] = [];
    track.modules.forEach(m => {
      m.lessons.forEach(l => allLessons.push(l.id));
      m.subModules.forEach(sm => {
        sm.lessons.forEach(l => allLessons.push(l.id));
      });
    });

    if (allLessons.length === 0) return 0;
    const completed = allLessons.filter(lid => state.completedLessons.includes(lid)).length;
    return Math.round((completed / allLessons.length) * 100);
  },

  getModuleProgress: (moduleId: string) => {
    const state = get();
    for (const track of state.tracks) {
      const mod = track.modules.find(m => m.id === moduleId);
      if (mod) {
        const allLessons: string[] = [];
        mod.lessons.forEach(l => allLessons.push(l.id));
        mod.subModules.forEach(sm => {
          sm.lessons.forEach(l => allLessons.push(l.id));
        });

        if (allLessons.length === 0) return 0;
        const completed = allLessons.filter(lid => state.completedLessons.includes(lid)).length;
        return Math.round((completed / allLessons.length) * 100);
      }
    }
    return 0;
  },
}));
