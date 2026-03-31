import { create } from 'zustand';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

export interface Lesson {
  id: string;
  title: string;
  duration: number; // minutes
  type: 'article' | 'video' | 'quiz' | 'interactive';
}

export interface SubModule {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Module {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  subModules: SubModule[];
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
  { id: 'first-lesson', title: 'First Steps', description: 'Complete your first lesson', icon: '🎯', unlocked: false, condition: 'Complete 1 lesson' },
  { id: 'streak-3', title: 'On Fire', description: '3-day learning streak', icon: '🔥', unlocked: false, condition: '3 consecutive days' },
  { id: 'streak-7', title: 'Unstoppable', description: '7-day learning streak', icon: '⚡', unlocked: false, condition: '7 consecutive days' },
  { id: 'streak-30', title: 'Legend', description: '30-day learning streak', icon: '👑', unlocked: false, condition: '30 consecutive days' },
  { id: 'module-complete', title: 'Module Master', description: 'Complete an entire module', icon: '📚', unlocked: false, condition: 'Finish all lessons in a module' },
  { id: 'track-complete', title: 'Track Champion', description: 'Complete an entire track', icon: '🏆', unlocked: false, condition: 'Finish all modules in a track' },
  { id: 'xp-100', title: 'Rising Star', description: 'Earn 100 XP', icon: '⭐', unlocked: false, condition: 'Accumulate 100 XP' },
  { id: 'xp-500', title: 'Knowledge Seeker', description: 'Earn 500 XP', icon: '🧠', unlocked: false, condition: 'Accumulate 500 XP' },
  { id: 'xp-1000', title: 'Market Scholar', description: 'Earn 1000 XP', icon: '🎓', unlocked: false, condition: 'Accumulate 1000 XP' },
  { id: 'speed-learner', title: 'Speed Learner', description: 'Complete 5 lessons in one day', icon: '🚀', unlocked: false, condition: '5 lessons in a single day' },
  { id: 'quiz-ace', title: 'Quiz Ace', description: 'Complete 5 quizzes', icon: '💯', unlocked: false, condition: 'Finish 5 quiz lessons' },
  { id: 'all-tracks', title: 'Finance Guru', description: 'Start all 6 tracks', icon: '🌟', unlocked: false, condition: 'Begin at least 1 lesson in each track' },
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
    const allLessons = track.modules.flatMap(m => m.subModules.flatMap(s => s.lessons.map(l => l.id)));
    if (allLessons.length === 0) return 0;
    const completed = allLessons.filter(lid => state.completedLessons.includes(lid)).length;
    return Math.round((completed / allLessons.length) * 100);
  },

  getModuleProgress: (moduleId: string) => {
    const state = get();
    for (const track of state.tracks) {
      const mod = track.modules.find(m => m.id === moduleId);
      if (mod) {
        const allLessons = mod.subModules.flatMap(s => s.lessons.map(l => l.id));
        if (allLessons.length === 0) return 0;
        const completed = allLessons.filter(lid => state.completedLessons.includes(lid)).length;
        return Math.round((completed / allLessons.length) * 100);
      }
    }
    return 0;
  },
}));
