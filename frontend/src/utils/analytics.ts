import mixpanel from 'mixpanel-browser';
import ReactGA from 'react-ga4';

/**
 * Initializes Google Analytics 4 and Mixpanel with optional environment variables.
 * Call this once at the root of the application (e.g. main.tsx or App.tsx).
 */
export const initAnalytics = () => {
  const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;
  const GA4_MEASUREMENT_ID = import.meta.env.VITE_GA_ID;

  if (MIXPANEL_TOKEN) {
    mixpanel.init(MIXPANEL_TOKEN, {
      debug: import.meta.env.DEV, // Shows Mixpanel logs in local development
      track_pageview: false,      // We will handle this manually for SPA routing
    });
  } else {
    console.warn("Mixpanel Token not found in environment variables.");
  }

  if (GA4_MEASUREMENT_ID) {
    ReactGA.initialize(GA4_MEASUREMENT_ID);
  } else {
    console.warn("GA4 Measurement ID not found in environment variables.");
  }
};

/**
 * Identify a user across sessions. Call this after a successful Login/Signup.
 */
export const identifyUser = (userId: number | string, email: string, fullName?: string) => {
  if (import.meta.env.VITE_MIXPANEL_TOKEN) {
    // Treat the database absolute ID as the unique alias across devices
    mixpanel.identify(String(userId));
    mixpanel.people.set({
      $email: email,
      $name: fullName,
      "User ID": userId,
    });
  }
};

/**
 * Reset identity tracking. Call this on Logout.
 */
export const resetUserIdentity = () => {
  if (import.meta.env.VITE_MIXPANEL_TOKEN) {
    mixpanel.reset();
  }
};

/**
 * Track route changes and standard page views.
 */
export const trackPageView = (path: string, search?: string) => {
  const fullPath = search ? `${path}${search}` : path;
  
  if (import.meta.env.VITE_GA_ID) {
    ReactGA.send({ hitType: 'pageview', page: fullPath });
  }
  
  if (import.meta.env.VITE_MIXPANEL_TOKEN) {
    mixpanel.track('Page Viewed', {
      path: fullPath,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Log specific user interaction events (e.g., Trade Execution, Learn Module complete)
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (import.meta.env.VITE_GA_ID) {
    ReactGA.event({
      category: 'User Interaction',
      action: eventName,
      label: properties ? JSON.stringify(properties) : undefined,
    });
  }

  if (import.meta.env.VITE_MIXPANEL_TOKEN) {
    mixpanel.track(eventName, properties);
  }
};
