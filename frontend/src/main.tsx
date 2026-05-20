import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import './index.css';
import App from './App.tsx';
import { initAnalytics } from './utils/analytics';

// Initialize Mixpanel and GA4
initAnalytics();

// ─── Global API Routing ────────────────────────────────────────────────────
// In production, all /api/* calls must go to the Azure VM backend.
// Setting axios baseURL and monkey-patching fetch here means EVERY file
// in the app automatically talks to the right server without changes.
const VM_API_BASE = 'https://20.40.42.232.nip.io';
const configuredApiBase = import.meta.env.VITE_API_URL?.trim();
const API_BASE =
  !configuredApiBase || configuredApiBase.includes('tradeshift-api.onrender.com')
    ? VM_API_BASE
    : configuredApiBase.startsWith('ttps://')
      ? `h${configuredApiBase}`
      : configuredApiBase;

if (API_BASE) {
  // 1. Axios: set global base URL
  axios.defaults.baseURL = API_BASE;
  axios.defaults.withCredentials = true;

  // 2. Fetch: intercept relative /api/ paths and prepend base URL
  const _originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && (input.startsWith('/api') || input.startsWith('/auth'))) {
      return _originalFetch(`${API_BASE}${input}`, {
        credentials: 'include',
        ...init,
      });
    }
    return _originalFetch(input, init);
  };
}
// ──────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
