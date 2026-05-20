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
      targetId: 'global-symbol-search',
      title: 'Search Any Index Or Stock',
      content:
        'Use this search bar whenever you already know what you want to study. Type NIFTY, BANKNIFTY, SENSEX, HDFCBANK, RELIANCE, or another symbol, select it, and TradeShift takes you straight into the Trading Terminal with that instrument loaded.',
      placement: 'bottom',
      route: '/markets',
      focusLabel: 'Fast symbol access',
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
      targetId: 'global-ticker',
      title: 'The Global Ticker Is Your Market Pulse',
      content:
        'This strip stays across the app. In live mode it shows current index movement; in replay mode it syncs to the selected replay date and simulation time, so the numbers match the historical session you are practicing.',
      placement: 'bottom',
      route: '/markets',
      focusLabel: 'Live and replay sync',
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
      targetId: 'trade-symbol-picker',
      title: 'Confirm Or Change The Trading Symbol',
      content:
        'The symbol button controls the active chart. If you searched RELIANCE from the top bar, RELIANCE appears here. You can change it any time without leaving the terminal.',
      placement: 'bottom',
      route: '/trade',
      focusLabel: 'Active instrument',
    },
    {
      targetId: 'trade-timeframe',
      title: 'Choose The Timeframe For Your Question',
      content:
        'Use 1m and 3m for replay practice and intraday timing, 5m or 15m for cleaner structure, and 1H for the bigger picture. Do not switch randomly: choose the timeframe that matches your trade idea.',
      placement: 'bottom',
      route: '/trade',
      focusLabel: 'Timeframe discipline',
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
      targetId: 'trade-ohlc-readout',
      title: 'Read The Candle Before Acting',
      content:
        'The OHLC row shows open, high, low, close, and candle change. Use it to understand whether the current candle is expanding, rejecting, or reversing before you press Buy or Sell.',
      placement: 'right',
      route: '/trade',
      focusLabel: 'Candle reading',
    },
    {
      targetId: 'trade-buy-sell',
      title: 'Paper Buy And Sell Buttons',
      content:
        'These buttons open the order panel at the current price. Treat every paper trade like a real trade: define entry, quantity, stop loss, take profit, and whether the setup came from market context, chart structure, or news.',
      placement: 'right',
      route: '/trade',
      focusLabel: 'Order practice',
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
      targetId: 'trade-drawing-tools',
      title: 'Draw The Plan On The Chart',
      content:
        'Use drawing tools for trendlines, support, resistance, channels, measurements, and annotations. Draw first, trade second: the chart should show where your idea becomes invalid.',
      placement: 'right',
      route: '/trade',
      focusLabel: 'Drawing and planning',
    },
    {
      targetId: 'trade-split-layout',
      title: 'Split Screens For Comparison',
      content:
        'Split layouts let you compare multiple charts at once: one symbol across timeframes, or several symbols side by side. This helps you see whether your stock is moving with or against the broader market.',
      placement: 'bottom',
      route: '/trade',
      focusLabel: 'Multi-chart workspace',
    },
    {
      targetId: 'trade-replay-button',
      title: 'Replay Mode Is Your Practice Engine',
      content:
        'Replay lets you train on historical sessions without knowing what happens next. Pick a date, press play, pause at decision points, step forward candle by candle, and review if your logic matched the market.',
      placement: 'bottom',
      route: '/trade',
      focusLabel: 'Historical practice',
    },
    {
      targetId: 'trade-alert-button',
      title: 'Use Alerts To Avoid Staring At Charts',
      content:
        'Create alerts for price levels and conditions. A good alert comes from a plan: if price crosses support, breaks resistance, or reaches your entry zone, the platform can bring your attention back.',
      placement: 'bottom',
      route: '/trade',
      focusLabel: 'Price alerts',
    },
    {
      targetId: 'trade-news-panel',
      title: 'Open News Pulse Inside The Terminal',
      content:
        'The news button opens Market Pulse beside your chart. During replay, the news feed is designed to appear in the same historical timeframe, so you can learn how headlines and sentiment affected that session.',
      placement: 'left',
      route: '/trade',
      focusLabel: 'News and chart together',
    },
    {
      targetId: 'trade-research-button',
      title: 'Jump From Chart To Stock Research',
      content:
        'Use the research button to open the deep stock page for the active symbol. This connects chart behavior with fundamentals and screener-style reasoning, so you are not judging a stock from candles alone.',
      placement: 'left',
      route: '/trade',
      focusLabel: 'Chart to research',
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
      targetId: 'nav-more',
      title: 'More Holds The Extra Workspaces',
      content:
        'News, Community, and Help live inside More so the main navigation stays clean. Open More when you need market context, trader discussions, or tutorials and support.',
      placement: 'bottom',
      route: '/trade',
      focusLabel: 'More navigation',
    },
    {
      targetId: 'nav-news',
      title: 'Go To News And AI Insights',
      content:
        'Use News when you want a broader feed beyond the terminal panel. It helps you understand market-moving stories before they become visible on the chart.',
      placement: 'bottom',
      route: '/trade',
      focusLabel: 'News path',
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
      targetId: 'nav-more',
      title: 'Open More Again For Community',
      content:
        'Community is also in More. This teaches you the real navigation path so you are not guessing where discussions and support areas live later.',
      placement: 'bottom',
      route: '/news',
      focusLabel: 'More navigation',
    },
    {
      targetId: 'nav-community',
      title: 'Go To Community',
      content:
        'Community is where you ask questions, compare setups, and learn how other traders reason. Use it after forming your own view, not before.',
      placement: 'bottom',
      route: '/news',
      focusLabel: 'Community path',
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
      targetId: 'nav-more',
      title: 'Open More For Help',
      content:
        'Help is in More too. When you want to replay a tutorial, contact support, or give feedback, open More and choose Help & Support.',
      placement: 'bottom',
      route: '/community',
      focusLabel: 'Help path',
    },
    {
      targetId: 'nav-help',
      title: 'Go To Help And Support',
      content:
        'Help is your reset button. You can restart this guide, replay a page tour, send feedback, or contact support whenever something feels unclear.',
      placement: 'bottom',
      route: '/community',
      focusLabel: 'Help path',
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
      targetId: 'global-symbol-search',
      title: 'Start By Searching The Instrument',
      content:
        'Search the index or stock you want to train on. Selecting it loads the Trading Terminal for that symbol, so your workflow starts with intent instead of browsing randomly.',
      placement: 'bottom',
      route: '/trade',
      focusLabel: 'Search to trade',
    },
    {
      targetId: 'global-ticker',
      title: 'Use The Ticker As The Market Weather',
      content:
        'The ticker tells you if the broader market is supportive or hostile. In replay mode these values sync with the selected historical date and time, so practice stays realistic.',
      placement: 'bottom',
      route: '/trade',
      focusLabel: 'Market sync',
    },
    {
      targetId: 'trade-symbol-picker',
      title: 'Active Symbol Control',
      content:
        'This button confirms the active chart symbol. Change it here when you want a different stock without leaving the terminal.',
      placement: 'bottom',
      route: '/trade',
    },
    {
      targetId: 'trade-timeframe',
      title: 'Timeframe Is Your Lens',
      content:
        '1m shows detail, 5m filters noise, 15m gives structure, and 1H gives context. Pick one primary timeframe for the trade and one higher timeframe for confirmation.',
      placement: 'bottom',
      route: '/trade',
    },
    {
      targetId: 'chart',
      title: 'Chart Workspace',
      content:
        'Use this area to observe price action, replay sessions, draw levels, and test orders without risking real money.',
      placement: 'left',
      route: '/trade',
    },
    {
      targetId: 'trade-ohlc-readout',
      title: 'Read The Current Candle',
      content:
        'OHLC tells you what the active candle is doing. A strong candle, rejection wick, or failed breakout should change your confidence before you trade.',
      placement: 'right',
      route: '/trade',
    },
    {
      targetId: 'trade-buy-sell',
      title: 'Open The Order Panel From Price',
      content:
        'Use Buy or Sell to practice orders. Set quantity, order type, stop loss, take profit, and optional price alert. This is where theory becomes controlled execution.',
      placement: 'right',
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
    {
      targetId: 'trade-drawing-tools',
      title: 'Drawing Tools Build Your Plan',
      content:
        'Mark support, resistance, trendlines, channels, and measured moves. Your drawing should answer: where is entry, where is invalidation, and where is target?',
      placement: 'right',
      route: '/trade',
    },
    {
      targetId: 'trade-split-layout',
      title: 'Split Screen Training',
      content:
        'Use split screens to compare NIFTY with a stock, or the same stock on 1m and 15m. This teaches alignment: strong trades usually agree across market, stock, and timeframe.',
      placement: 'bottom',
      route: '/trade',
    },
    {
      targetId: 'trade-replay-button',
      title: 'Replay Mode For Deliberate Practice',
      content:
        'Replay lets you choose a historical date and experience the session as if it were live. Pause before entries, write your reason mentally, then play forward and compare your decision with the result.',
      placement: 'bottom',
      route: '/trade',
    },
    {
      targetId: 'trade-alert-button',
      title: 'Alerts For Planned Levels',
      content:
        'Use alerts for breakout levels, stop zones, retests, and invalidation points. Alerts keep you disciplined because the platform waits for your level instead of you chasing candles.',
      placement: 'bottom',
      route: '/trade',
    },
    {
      targetId: 'trade-news-panel',
      title: 'News Pulse Inside Replay',
      content:
        'Open the news panel while replaying. TradeShift can show news from the same historical timeframe, letting you study how sentiment, headlines, and price action interacted on that date.',
      placement: 'left',
      route: '/trade',
    },
    {
      targetId: 'trade-research-button',
      title: 'Go From Chart To Screener-Style Research',
      content:
        'Use research when you want the active stock explained beyond price. This is the bridge from terminal practice to stock quality, fundamentals, and the deeper screener card logic.',
      placement: 'left',
      route: '/trade',
    },
    {
      targetId: 'portfolio-metrics',
      title: 'Finish By Reviewing Portfolio',
      content:
        'After practice, review portfolio metrics. The full loop is: search symbol, check ticker, study chart, use indicators and drawings, replay/news check, place paper trade, then review results.',
      placement: 'bottom',
      route: '/portfolio',
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
