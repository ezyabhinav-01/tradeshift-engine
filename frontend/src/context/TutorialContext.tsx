import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { useLocation } from 'react-router-dom';

export interface TutorialStep {
  targetId?: string; // If undefined, center screen
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export type TourId = 'global' | 'markets' | 'portfolio' | 'learn';

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
      title: "Welcome to TradeShift!",
      content: "Welcome to your new trading headquarters. This guide will help you navigate the platform's core areas so you can start trading with confidence and precision. Ready to see how it works?",
      placement: "center"
    },
    {
      targetId: "tutorial-nav-home",
      title: "Dashboard & Navigation",
      content: "This sidebar is your control center. Use it to quickly switch between the simulated market, your personal portfolio, and the learning academy. It's designed to keep your most important tools just one click away at all times.",
      placement: "right"
    },
    {
      targetId: "tutorial-nav-trade",
      title: "The Trading Terminal",
      content: "This is where the action happens. Use the Trading Terminal to analyze real-time market data, view professional charts, and execute buy/sell orders. Use this when you're ready to test a strategy in the live market simulation.",
      placement: "right"
    },
    {
      targetId: "tutorial-nav-portfolio",
      title: "Portfolio Management",
      content: "Your Portfolio tracks every trade you've ever made. Review this daily to see your total equity, active holdings, and long-term performance. It helps you see 'the big picture' of your wealth growth and risk management success.",
      placement: "right"
    },
    {
      targetId: "tutorial-nav-learn",
      title: "Learning Academy",
      content: "Trading is a skill, and the Academy is where you master it. Complete interactive tracks, earn XP for correct answers, and climb the global leaderboard. Use this daily to refine your edge and learn new professional strategies.",
      placement: "right"
    },
    {
      targetId: "tutorial-nav-community",
      title: "Trader Community",
      content: "You're not trading alone. Join discussions, share your chart setups, and see what other pros are watching. The community is best used for cross-verifying signals and staying updated on market sentiment in real-time.",
      placement: "right"
    }
  ],
  markets: [
    {
      targetId: "tutorial-chart",
      title: "Professional Charting",
      content: "These charts use the same data engines as world-class hedge funds. You can draw trends, identify support/resistance, and visualize price action across different timeframes to time your entries perfectly.",
      placement: "left"
    },
    {
      targetId: "tutorial-indicators",
      title: "Technical Indicators",
      content: "Indicators help you confirm your trades. Add tools like RSI or Moving Averages to cut through market noise. Use these when you need objective data to support your subjective chart analysis.",
      placement: "bottom"
    }
  ],
  portfolio: [
    {
      targetId: "tutorial-portfolio-metrics",
      title: "Vital Stats",
      content: "These metrics (ROI, Win Rate, Max Drawdown) are the pulse of your trading business. High numbers here mean your strategy is working; use these to identify when you need to pivot or scale up your position sizes.",
      placement: "bottom"
    }
  ],
  learn: [
    {
      targetId: "tutorial-track-list",
      title: "Structured Curriculum",
      content: "Start with the 'Markets 101' tracks and move up. Each module is designed to give you 'the why' behind every concept, ensuring you don't just memorize patterns, but truly understand market mechanics.",
      placement: "top"
    }
  ]
};

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const [isActive, setIsActive] = useState(false);
  const [currentTour, setCurrentTour] = useState<TourId | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const currentStep = currentTour ? TOUR_CONFIG[currentTour]?.[currentStepIndex] || null : null;
  const totalSteps = currentTour ? TOUR_CONFIG[currentTour]?.length || 0 : 0;

  // Track completed tours to avoid repeated api calls
  const [completedTours, setCompletedTours] = useState<Set<string>>(new Set());

  useEffect(() => {
    const localCompleted = new Set<string>();
    try {
      const localStr = localStorage.getItem('tutorial:completed');
      if (localStr) {
        JSON.parse(localStr).forEach((t: string) => localCompleted.add(t));
      }
    } catch {}

    const completed = new Set(localCompleted);

    if (user && (user as any)?.onboarding_status) {
      const status = (user as any).onboarding_status;
      if (status?.global_tour_completed) completed.add('global');
      if (Array.isArray(status?.page_tours_completed)) {
        status.page_tours_completed.forEach((t: string) => completed.add(t));
      }
    }
    setCompletedTours(completed);
  }, [user]);

  // Check if we should trigger a tour on route change
  useEffect(() => {
    if (isActive) return;

    // Check Global Tour first
    if (!completedTours.has('global')) {
      const isNewUser = user ? (user.created_at ? new Date(user.created_at).getTime() >= TUTORIAL_RELEASE_DATE : false) : true;

      if (isNewUser) {
        // Automatic start for truly new users or guests
        const t = setTimeout(() => startTour('global'), 1500);
        return () => clearTimeout(t);
      } else {
        // Silently mark as completed for existing users
        void syncOnboardingStatus('global');
      }
      return;
    }

    // Check Context Tours
    const path = location.pathname;
    if (path.startsWith('/markets') && !completedTours.has('markets')) {
      const t = setTimeout(() => startTour('markets'), 1500);
      return () => clearTimeout(t);
    } else if (path.startsWith('/portfolio') && !completedTours.has('portfolio')) {
      const t = setTimeout(() => startTour('portfolio'), 1500);
      return () => clearTimeout(t);
    } else if (path.startsWith('/learn') && !completedTours.has('learn')) {
      const t = setTimeout(() => startTour('learn'), 1500);
      return () => clearTimeout(t);
    }
  }, [location.pathname, user, completedTours, isActive]);

  const hasCompletedTour = (tourId: TourId) => {
    return completedTours.has(tourId);
  };

  const startTour = (tourId: TourId) => {
    if (!TOUR_CONFIG[tourId]) return;
    setCurrentTour(tourId);
    setCurrentStepIndex(0);
    setIsActive(true);
  };

  const syncOnboardingStatus = async (tourId: TourId) => {
    // Optimistic update locally
    setCompletedTours(prev => {
      const next = new Set(prev);
      next.add(tourId);
      try {
        localStorage.setItem('tutorial:completed', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    if (!user) return;

    try {
      const currentStatus = ((user as any).onboarding_status) || {};
      const newStatus = { ...currentStatus };
      
      if (tourId === 'global') {
        newStatus.global_tour_completed = true;
      } else {
        const pageTours = newStatus.page_tours_completed || [];
        if (!pageTours.includes(tourId)) {
          pageTours.push(tourId);
        }
        newStatus.page_tours_completed = pageTours;
      }

      await axios.patch('/auth/update-profile', {
        onboarding_status: newStatus
      });
    } catch (err) {
      console.error("Failed to sync onboarding status", err);
    }
  };

  const nextStep = () => {
    if (!currentTour) return;
    const steps = TOUR_CONFIG[currentTour];
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      endTour();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const endTour = () => {
    if (currentTour) {
      syncOnboardingStatus(currentTour);
    }
    setIsActive(false);
    setCurrentTour(null);
    setCurrentStepIndex(0);
  };

  const skipTour = () => {
    endTour();
  };

  return (
    <TutorialContext.Provider value={{
      isActive, currentTour, currentStepIndex, totalSteps, currentStep,
      startTour, nextStep, prevStep, endTour, skipTour,
      hasCompletedTour
    }}>
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
