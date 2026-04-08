import axios from 'axios';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const api = axios.create({ baseURL: '', withCredentials: true });

const DEFAULT_SUMMARY = {
  current_value: 0,
  total_invested: 0,
  total_pnl: 0,
  pnl_percent: 0,
  xirr_percent: 0,
  is_positive: true,
  equity_curve: [],
  cash_balance: 100000.0,
  total_value: 100000.0,
};

type PortfolioRefreshOptions = {
  sessionType?: 'REPLAY';
  force?: boolean;
};

interface PortfolioState {
  summary: any;
  holdings: any[];
  positions: any[];
  history: any[];
  monthlySummary: any[];
  sectors: any;
  research: any;
  isLoading: boolean;
  isRefreshing: boolean;
  lastFetchedAt: number | null;
  refreshPortfolio: (options?: PortfolioRefreshOptions) => Promise<void>;
  setGuestFallback: () => void;
}

let inflightRequest: Promise<void> | null = null;

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      summary: null,
      holdings: [],
      positions: [],
      history: [],
      monthlySummary: [],
      sectors: null,
      research: null,
      isLoading: false,
      isRefreshing: false,
      lastFetchedAt: null,

      refreshPortfolio: async (options = {}) => {
        const { sessionType = 'REPLAY', force = false } = options;
        const state = get();
        const hasCachedData =
          !!state.summary ||
          state.holdings.length > 0 ||
          state.positions.length > 0 ||
          state.history.length > 0 ||
          !!state.sectors ||
          !!state.research;

        const lastFetchedAt = state.lastFetchedAt || 0;
        const now = Date.now();
        const freshEnough = now - lastFetchedAt < 3000;
        if (!force && freshEnough) return;

        if (inflightRequest) return inflightRequest;

        set({
          isLoading: !hasCachedData,
          isRefreshing: hasCachedData,
        });

        inflightRequest = (async () => {
          const params = { session_type: sessionType };
          const results = await Promise.allSettled([
            api.get('/api/portfolio/summary', { params }),
            api.get('/api/portfolio/holdings', { params }),
            api.get('/api/portfolio/positions', { params }),
            api.get('/api/portfolio/sectors', { params }),
            api.get('/api/portfolio/research', { params }),
            api.get('/api/history/trades', { params: { ...params, limit: 100 } }),
            api.get('/api/history/monthly-summary', { params }),
          ]);

          const [sumR, holdR, posR, secR, resR, histR, monthR] = results;
          const successCount = results.filter((r) => r.status === 'fulfilled').length;

          set((prev) => ({
            summary:
              sumR.status === 'fulfilled' ? sumR.value.data : prev.summary || DEFAULT_SUMMARY,
            holdings:
              holdR.status === 'fulfilled' ? holdR.value.data.holdings || [] : prev.holdings,
            positions:
              posR.status === 'fulfilled' ? posR.value.data.positions || [] : prev.positions,
            sectors: secR.status === 'fulfilled' ? secR.value.data : prev.sectors,
            research: resR.status === 'fulfilled' ? resR.value.data : prev.research,
            history: histR.status === 'fulfilled' ? histR.value.data.trades || [] : prev.history,
            monthlySummary:
              monthR.status === 'fulfilled'
                ? monthR.value.data.months || []
                : prev.monthlySummary,
            lastFetchedAt: successCount > 0 ? Date.now() : prev.lastFetchedAt,
            isLoading: false,
            isRefreshing: false,
          }));
        })()
          .catch((err) => {
            console.error('Portfolio refresh failed:', err);
            set({ isLoading: false, isRefreshing: false });
          })
          .finally(() => {
            inflightRequest = null;
          });

        return inflightRequest;
      },

      setGuestFallback: () => {
        set({
          summary: DEFAULT_SUMMARY,
          holdings: [],
          positions: [],
          history: [],
          monthlySummary: [],
          sectors: null,
          research: null,
          isLoading: false,
          isRefreshing: false,
          lastFetchedAt: null,
        });
      },
    }),
    {
      name: 'tradeshift-portfolio-cache',
      partialize: (state) => ({
        summary: state.summary,
        holdings: state.holdings,
        positions: state.positions,
        history: state.history,
        monthlySummary: state.monthlySummary,
        sectors: state.sectors,
        research: state.research,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
);
