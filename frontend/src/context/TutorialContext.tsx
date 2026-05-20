import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

export interface TutorialStep {
  targetId?: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  route?: string;
  focusLabel?: string;
}

export type TourId =
  | 'global'
  | 'markets'
  | 'screener'
  | 'trade'
  | 'portfolio'
  | 'learn'
  | 'news'
  | 'community'
  | 'help';

export interface TutorialContextType {
  isActive: boolean;
  currentTour: TourId | null;
  currentStepIndex: number;
  totalSteps: number;
  currentStep: TutorialStep | null;
  startTour: (tourId: TourId) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
  skipTour: () => void;
  hasCompletedTour: (tourId: TourId) => boolean;
}

const TUTORIAL_RELEASE_DATE = new Date('2026-04-16T00:00:00Z').getTime();

const TOUR_CONFIG: Record<TourId, TutorialStep[]> = {
  global: [
    {
      title: 'Welcome to TradeShift',
      content:
        'You do not need to understand finance on day one. This tour shows you where to look, why each page matters, and how the pieces connect: learn a concept, watch the market, test it safely, then review what happened.',
      placement: 'center',
      focusLabel: 'Your guided start',
    },
    {
      targetId: 'nav-markets',
      title: 'Start With The Market Map',
      content:
        'Markets is your first checkpoint. Use it to understand whether the day is broadly strong, weak, or mixed before you think about any single trade. This protects beginners from making decisions in isolation.',
      placement: 'bottom',
      route: '/markets',
      focusLabel: 'Market direction',
    },
    {
      targetId: 'market-overview',
      title: 'Read The Big Picture First',
      content:
        'The overview, indices, heatmap, sectors, and F&O tabs help you answer simple questions: is money flowing into the market, which sectors are leading, and where is risk building? Use this before choosing stocks.',
      placement: 'bottom',
      route: '/markets',
      focusLabel: 'Overview, sectors and F&O',
    },
    {
      targetId: 'nav-screener',
      title: 'Find Ideas With A Reason',
      content:
        'The screener turns the whole market into a short list. Instead of chasing random tips, sort companies by quality, growth, conviction, and sector. It teaches you to ask, "why this stock?" before you act.',
      placement: 'bottom',
      route: '/screener',
      focusLabel: 'Idea discovery',
    },
    {
      targetId: 'screener-controls',
      title: 'Filter, Compare, Then Research',
      content:
        'Use search and filters to narrow the list, then open a company for deeper research. This matters because good decisions come from comparison, not excitement over the first name you see.',
      placement: 'bottom',
      route: '/screener',
      focusLabel: 'Filters and sorting',
    },
    {
      targetId: 'nav-learn',
      title: 'Build Skill In The Academy',
      content:
        'Learn is the safest place to start if trading feels unfamiliar. Follow modules, finish chapters, earn XP, and build a streak. Use it whenever a term, chart pattern, or market idea feels unclear.',
      placement: 'bottom',
      route: '/learn',
      focusLabel: 'Structured learning',
    },
    {
      targetId: 'learn-progress',
      title: 'Progress Turns Confusion Into Momentum',
      content:
        'XP, streaks, badges, time spent, and lesson counts make learning visible. The point is not decoration: it helps you build the habit that eventually makes charts and risk feel natural.',
      placement: 'bottom',
      route: '/learn',
      focusLabel: 'XP and streaks',
    },
    {
      targetId: 'track-list',
      title: 'Choose One Learning Path',
      content:
        'Start with the most basic module and move forward step by step. A beginner gets the best experience by completing one chapter, then practicing that exact idea in the simulator.',
      placement: 'top',
      route: '/learn',
      focusLabel: 'Learning modules',
    },
    {
      targetId: 'nav-trade',
      title: 'Practice In The Trading Terminal',
      content:
        'Trade is your simulator. Open charts, change timeframes, add indicators, replay historical sessions, and place paper orders. Use it after you have a reason, so practice becomes training instead of gambling.',
      placement: 'bottom',
      route: '/trade',
      focusLabel: 'Safe paper trading',
    },
    {
      targetId: 'chart',
      title: 'Charts Show The Story Of Price',
      content:
        'This is where you study entries and exits. Draw levels, compare candles, and test ideas with replay. Beginners should focus on one symbol and one timeframe first, then add complexity slowly.',
      placement: 'left',
      route: '/trade',
      focusLabel: 'Chart workspace',
    },
    {
      targetId: 'indicators',
      title: 'Indicators Are Confirmation Tools',
      content:
        'Indicators help confirm momentum, trend, and exhaustion. They are useful when they support a plan; they are dangerous when they replace thinking. Add them only to answer a specific question.',
      placement: 'bottom',
      route: '/trade',
      focusLabel: 'Indicators and tools',
    },
    {
      targetId: 'nav-portfolio',
      title: 'Review Results In Portfolio',
      content:
        'Portfolio is your report card. Check holdings, open positions, pending orders, trade history, sector exposure, and analytics. This is where you learn whether your strategy is actually improving.',
      placement: 'bottom',
      route: '/portfolio',
      focusLabel: 'Performance review',
    },
    {
      targetId: 'portfolio-metrics',
      title: 'Know Your Risk Before Your Profit',
      content:
        'These cards summarize exposure, available cash, pending orders, and diversification. Use them before adding new trades so you do not accidentally overcommit or ignore concentration risk.',
      placement: 'bottom',
      route: '/portfolio',
      focusLabel: 'Risk and cash',
    },
    {
      targetId: 'news-categories',
      title: 'Use News For Context',
      content:
        'News and AI insights explain what may be moving markets. Read it after checking charts and before placing larger trades. It helps you avoid being surprised by earnings, policy, or macro events.',
      placement: 'bottom',
      route: '/news',
      focusLabel: 'Market context',
    },
    {
      targetId: 'news-categories',
      title: 'Turn Headlines Into Understanding',
      content:
        'Filter by category and use AI Perspective to translate headlines into plain language. The goal is not to react to every story; it is to understand which stories could change sentiment.',
      placement: 'bottom',
      route: '/news',
      focusLabel: 'AI news explanations',
    },
    {
      targetId: 'community-sidebar',
      title: 'Learn With Other Traders',
      content:
        'Community gives you channels and direct messages for discussion. Use it to ask questions, compare views, and sanity-check ideas. Treat it as collaboration, not blind advice.',
      placement: 'bottom',
      route: '/community',
      focusLabel: 'Discussion and feedback',
    },
    {
      targetId: 'community-compose',
      title: 'Ask Clear Questions',
      content:
        'When you post, include the symbol, timeframe, reason for interest, and what you are unsure about. Better questions get better help and train you to think like an analyst.',
      placement: 'top',
      route: '/community',
      focusLabel: 'Channels and messages',
    },
    {
      targetId: 'help-tutorials',
      title: 'Come Back To The Guide Anytime',
      content:
        'Help contains support, feedback, FAQs, and replayable tutorials. If you forget where something lives, restart this tour from Help and use it as your map.',
      placement: 'bottom',
      route: '/help',
      focusLabel: 'Support and tutorials',
    },
    {
      targetId: 'help-tutorials',
      title: 'Your Learning Path',
      content:
        'A strong routine is simple: Learn one concept, scan the market, shortlist with the screener, practice in Trade, review Portfolio, then discuss and refine. TradeShift is built to make that loop easy.',
      placement: 'top',
      route: '/help',
      focusLabel: 'Replay guided tours',
    },
  ],
  markets: [
    {
      targetId: 'market-overview',
      title: 'Market Overview',
      content:
        'Start here to understand trend, breadth, sector strength, and F&O pressure. It helps you avoid trading a stock against the mood of the broader market.',
      placement: 'bottom',
      route: '/markets',
    },
    {
      targetId: 'market-movers',
      title: 'Gainers And Losers',
      content:
        'Movers show where attention is strongest. Use them for discovery, then verify with charts, news, and fundamentals before making a trade plan.',
      placement: 'top',
      route: '/markets',
    },
  ],
  screener: [
    {
      targetId: 'screener-controls',
      title: 'Screen With Discipline',
      content:
        'Filter by sector, search names, and sort by conviction or fundamentals. This page turns a noisy market into a smaller research list.',
      placement: 'bottom',
      route: '/screener',
    },
    {
      targetId: 'screener-results',
      title: 'Every Idea Needs Evidence',
      content:
        'Each card shows quality, growth, valuation, and a learning tip. Open deep research only after the numbers and the story both make sense.',
      placement: 'top',
      route: '/screener',
    },
  ],
  trade: [
    {
      targetId: 'chart',
      title: 'Chart Workspace',
      content:
        'Use this area to observe price action, replay sessions, draw levels, and test orders without risking real money.',
      placement: 'left',
      route: '/trade',
    },
    {
      targetId: 'indicators',
      title: 'Tools And Indicators',
      content:
        'Open indicators when you need confirmation. The cleanest trades usually have price structure, risk level, and indicator evidence pointing together.',
      placement: 'bottom',
      route: '/trade',
    },
  ],
  portfolio: [
    {
      targetId: 'portfolio-metrics',
      title: 'Portfolio Metrics',
      content:
        'These metrics show exposure, cash, pending orders, and diversification. Review them before adding trades and after closing trades.',
      placement: 'bottom',
      route: '/portfolio',
    },
  ],
  learn: [
    {
      targetId: 'learn-progress',
      title: 'Your Learning Dashboard',
      content:
        'XP, streaks, badges, lessons, and time spent help you build a habit. Use this page daily until the basics become familiar.',
      placement: 'bottom',
      route: '/learn',
    },
    {
      targetId: 'track-list',
      title: 'Structured Curriculum',
      content:
        'Start with the beginner modules and move up. Each module gives you the why behind a concept, then the simulator lets you practice it.',
      placement: 'top',
      route: '/learn',
    },
  ],
  news: [
    {
      targetId: 'news-categories',
      title: 'News Filters',
      content:
        'Use categories to focus on the type of story that matters to your plan: market-wide events, company updates, or macro shifts.',
      placement: 'bottom',
      route: '/news',
    },
    {
      targetId: 'news-featured',
      title: 'AI Perspective',
      content:
        'Use AI Perspective to translate complex headlines into plain language and connect news to possible market impact.',
      placement: 'top',
      route: '/news',
    },
  ],
  community: [
    {
      targetId: 'community-sidebar',
      title: 'Channels And People',
      content:
        'Switch between channels and direct messages here. Use channels for broad learning and DMs for focused conversations.',
      placement: 'right',
      route: '/community',
    },
    {
      targetId: 'community-compose',
      title: 'Share A Clear Setup',
      content:
        'Ask with context: symbol, timeframe, reason, risk, and what you want reviewed. Clear posts help you learn faster.',
      placement: 'top',
      route: '/community',
    },
  ],
  help: [
    {
      targetId: 'help-tutorials',
      title: 'Tutorial Library',
      content:
        'Replay onboarding or a page-specific guide whenever you need. This is built for returning users who want a refresher without creating a new account.',
      placement: 'top',
      route: '/help',
    },
  ],
};

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isActive, setIsActive] = useState(false);
  const [currentTour, setCurrentTour] = useState<TourId | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedTours, setCompletedTours] = useState<Set<string>>(new Set());

  const currentStep = currentTour ? TOUR_CONFIG[currentTour]?.[currentStepIndex] || null : null;
  const totalSteps = currentTour ? TOUR_CONFIG[currentTour]?.length || 0 : 0;
  const storageKey = user ? `tutorial:completed:${user.id}` : 'tutorial:completed';

  useEffect(() => {
    const localCompleted = new Set<string>();
    try {
      const localStr = localStorage.getItem(storageKey);
      if (localStr) {
        JSON.parse(localStr).forEach((tourId: string) => localCompleted.add(tourId));
      }
    } catch {
      // Ignore storage errors and keep tutorial usable.
    }

    const completed = new Set(localCompleted);

    if (user?.onboarding_status) {
      const status = user.onboarding_status;
      if (status?.global_tour_completed || status?.global_tour_skipped) completed.add('global');
      if (Array.isArray(status?.page_tours_completed)) {
        status.page_tours_completed.forEach((tourId: string) => completed.add(tourId));
      }
    }

    setCompletedTours(completed);
  }, [storageKey, user]);

  useEffect(() => {
    if (!user || isActive || completedTours.has('global')) return;

    const isNewUser = user.created_at
      ? new Date(user.created_at).getTime() >= TUTORIAL_RELEASE_DATE
      : false;

    if (!isNewUser) {
      void syncOnboardingStatus('global');
      return;
    }

    const timer = window.setTimeout(() => startTour('global'), 1200);
    return () => window.clearTimeout(timer);
  }, [user, completedTours, isActive]);

  useEffect(() => {
    if (!isActive || !currentStep?.route || location.pathname === currentStep.route) return;
    navigate(currentStep.route);
  }, [isActive, currentStep?.route, location.pathname, navigate]);

  const persistCompletedTours = (next: Set<string>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
    } catch {
      // Ignore storage failures; backend sync may still succeed.
    }
  };

  const syncOnboardingStatus = async (tourId: TourId) => {
    setCompletedTours((prev) => {
      const next = new Set(prev);
      next.add(tourId);
      persistCompletedTours(next);
      return next;
    });

    if (!user) return;

    try {
      const currentStatus = user.onboarding_status || {};
      const newStatus = { ...currentStatus };

      if (tourId === 'global') {
        newStatus.global_tour_completed = true;
      } else {
        const pageTours = Array.isArray(newStatus.page_tours_completed)
          ? [...newStatus.page_tours_completed]
          : [];
        if (!pageTours.includes(tourId)) pageTours.push(tourId);
        newStatus.page_tours_completed = pageTours;
      }

      await axios.patch('/auth/update-profile', {
        onboarding_status: newStatus,
      });
    } catch (err) {
      console.error('Failed to sync onboarding status', err);
    }
  };

  const hasCompletedTour = (tourId: TourId) => completedTours.has(tourId);

  const startTour = (tourId: TourId) => {
    if (!TOUR_CONFIG[tourId]) return;
    setCurrentTour(tourId);
    setCurrentStepIndex(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (!currentTour) return;
    const steps = TOUR_CONFIG[currentTour];
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      endTour();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const endTour = () => {
    if (currentTour) {
      void syncOnboardingStatus(currentTour);
    }
    setIsActive(false);
    setCurrentTour(null);
    setCurrentStepIndex(0);
  };

  const skipTour = () => {
    if (currentTour) {
      void syncOnboardingStatus(currentTour);
    }
    setIsActive(false);
    setCurrentTour(null);
    setCurrentStepIndex(0);
  };

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentTour,
        currentStepIndex,
        totalSteps,
        currentStep,
        startTour,
        nextStep,
        prevStep,
        endTour,
        skipTour,
        hasCompletedTour,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};
