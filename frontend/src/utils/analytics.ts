import mixpanel from 'mixpanel-browser';
import ReactGA from 'react-ga4';
import posthog from 'posthog-js';

/**
 * Initializes Google Analytics 4, Mixpanel, and PostHog.
 * Call this once at the root of the application (e.g. main.tsx).
 */
export const initAnalytics = () => {
  const MIXPANEL_TOKEN     = import.meta.env.VITE_MIXPANEL_TOKEN;
  const GA4_MEASUREMENT_ID = import.meta.env.VITE_GA_ID;
  const POSTHOG_KEY        = import.meta.env.VITE_POSTHOG_KEY;
  const POSTHOG_HOST       = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com';

  // ── PostHog ────────────────────────────────────────────────────────────
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host:                POSTHOG_HOST,
      capture_pageview:        false,  // We handle this manually for SPA routing
      capture_pageleave:       true,
      session_recording: {
        maskAllInputs:         false,  // Set to true if you want to mask sensitive text fields
        maskInputOptions:      { password: true },
      },
      autocapture:             true,   // Auto-captures clicks, inputs, form submits
      loaded: (ph) => {
        if (import.meta.env.DEV) {
          ph.debug(); // Verbose PostHog logs in local development
        }
      },
    });
    console.log('[Analytics] PostHog initialized.');
  } else {
    console.warn('[Analytics] PostHog key (VITE_POSTHOG_KEY) not found.');
  }

  // ── Mixpanel ───────────────────────────────────────────────────────────
  if (MIXPANEL_TOKEN) {
    mixpanel.init(MIXPANEL_TOKEN, {
      debug:           import.meta.env.DEV,
      track_pageview:  false,
    });
  } else {
    console.warn('[Analytics] Mixpanel token (VITE_MIXPANEL_TOKEN) not found.');
  }

  // ── Google Analytics 4 ─────────────────────────────────────────────────
  if (GA4_MEASUREMENT_ID) {
    ReactGA.initialize(GA4_MEASUREMENT_ID);
  } else {
    console.warn('[Analytics] GA4 ID (VITE_GA_ID) not found.');
  }
};

/**
 * Identify a user across sessions.
 * Call this after a successful Login / Signup.
 */
export const identifyUser = (userId: number | string, email: string, fullName?: string) => {
  const uid = String(userId);

  // PostHog
  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.identify(uid, {
      email,
      name:    fullName,
      user_id: userId,
    });
  }

  // Mixpanel
  if (import.meta.env.VITE_MIXPANEL_TOKEN) {
    mixpanel.identify(uid);
    mixpanel.people.set({
      $email: email,
      $name:  fullName,
      'User ID': userId,
    });
  }
};

/**
 * Reset identity tracking on Logout.
 */
export const resetUserIdentity = () => {
  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.reset();
  }

  if (import.meta.env.VITE_MIXPANEL_TOKEN) {
    mixpanel.reset();
  }
};

/**
 * Track SPA route changes / standard page views.
 */
export const trackPageView = (path: string, search?: string) => {
  const fullPath = search ? `${path}${search}` : path;

  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.capture('$pageview', { $current_url: fullPath });
  }

  if (import.meta.env.VITE_GA_ID) {
    ReactGA.send({ hitType: 'pageview', page: fullPath });
  }

  if (import.meta.env.VITE_MIXPANEL_TOKEN) {
    mixpanel.track('Page Viewed', {
      path:      fullPath,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Log specific user interaction events.
 * e.g. trackEvent('Trade Executed', { symbol: 'NIFTY', quantity: 10 })
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.capture(eventName, properties);
  }

  if (import.meta.env.VITE_GA_ID) {
    ReactGA.event({
      category: 'User Interaction',
      action:   eventName,
      label:    properties ? JSON.stringify(properties) : undefined,
    });
  }

  if (import.meta.env.VITE_MIXPANEL_TOKEN) {
    mixpanel.track(eventName, properties);
  }
};
