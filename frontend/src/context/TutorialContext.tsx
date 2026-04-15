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
  currentStep: TutorialStep | null;
  startTour: (tourId: TourId) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
  skipTour: () => void;
  hasCompletedTour: (tourId: TourId) => boolean;
}

const TOUR_CONFIG: Record<TourId, TutorialStep[]> = {
  global: [
    {
      title: "Welcome to TradeShift!",
      content: "Let's take a quick tour to help you get started with the platform.",
      placement: "center"
    },
    {
      targetId: "tutorial-nav-home",
      title: "Navigation",
      content: "Here is your navigation bar. Access all your tools from here.",
      placement: "bottom"
    },
    {
      targetId: "tutorial-nav-trade",
      title: "Trading Terminal",
      content: "This is your main dashboard where you can analyze charts and execute trades.",
      placement: "bottom"
    },
    {
      targetId: "tutorial-nav-portfolio",
      title: "Portfolio",
      content: "Track your active positions, history, and overall account performance here.",
      placement: "bottom"
    },
    {
      targetId: "tutorial-nav-learn",
      title: "Academy",
      content: "Level up your skills by completing interactive lessons and earning XP.",
      placement: "bottom"
    },
    {
      targetId: "tutorial-nav-community",
      title: "Community",
      content: "Connect with other traders, share setups, and discuss market trends.",
      placement: "bottom"
    }
  ],
  markets: [
    {
      targetId: "tutorial-chart",
      title: "Pro Charts",
      content: "Use professional charting tools with indicators and drawing capabilities.",
      placement: "left"
    },
    {
      targetId: "tutorial-indicators",
      title: "Indicators",
      content: "Add technical indicators to help analyze the market.",
      placement: "bottom"
    }
  ],
  portfolio: [
    {
      targetId: "tutorial-portfolio-metrics",
      title: "Performance Metrics",
      content: "View your total balance, P&L, and Win Rate at a glance.",
      placement: "bottom"
    }
  ],
  learn: [
    {
      targetId: "tutorial-track-list",
      title: "Learning Tracks",
      content: "Follow structured tracks to build your trading knowledge from basics to advanced.",
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

  // Track completed tours to avoid repeated api calls
  const [completedTours, setCompletedTours] = useState<Set<string>>(new Set());

  useEffect(() => {
    if ((user as any)?.onboarding_status) {
      const status = (user as any).onboarding_status;
      const completed = new Set<string>();
      if (status?.global_tour_completed) completed.add('global');
      if (Array.isArray(status?.page_tours_completed)) {
        status.page_tours_completed.forEach((t: string) => completed.add(t));
      }
      setCompletedTours(completed);
    }
  }, [user]);

  // Check if we should trigger a tour on route change
  useEffect(() => {
    if (!user) return;
    if (isActive) return;

    // Check Global Tour first on login
    if (!completedTours.has('global') && !isActive) {
      // Delay slightly so UI loads
      const t = setTimeout(() => startTour('global'), 1000);
      return () => clearTimeout(t);
    }

    // Check Context Tours
    const path = location.pathname;
    if (path.startsWith('/markets') && !completedTours.has('markets')) {
      const t = setTimeout(() => startTour('markets'), 1000);
      return () => clearTimeout(t);
    } else if (path.startsWith('/portfolio') && !completedTours.has('portfolio')) {
      const t = setTimeout(() => startTour('portfolio'), 1000);
      return () => clearTimeout(t);
    } else if (path.startsWith('/learn') && !completedTours.has('learn')) {
      const t = setTimeout(() => startTour('learn'), 1000);
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
    if (!user) return;
    
    // Optimistic update locally
    setCompletedTours(prev => {
      const next = new Set(prev);
      next.add(tourId);
      return next;
    });

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
      // checkAuth(); // Optionally refresh, but we did optimistic update.
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
      isActive, currentTour, currentStepIndex, currentStep,
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
