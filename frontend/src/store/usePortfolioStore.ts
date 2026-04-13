import axios from 'axios';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { API_BASE } from '../utils/api';

const api = axios.create({ baseURL: API_BASE, withCredentials: true });

const DEFAULT_SUMMARY = {
  current_value: 0,
  total_invested: 0,
  total_pnl: 0,
  pnl_percent: 0,
  xirr_percent: 0,
  is_positive: true,
  equity_curve: [],
  cash_balance: 100000.0,
  pending_order_count: 0,
  pending_buy_value: 0,
  pending_sell_value: 0,
  effective_available_cash: 100000.0,
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
  activeOrders: any[];
  history: any[];
  monthlySummary: any[];
  sectors: any;
  research: any;
  isLoading: boolean;
  isRefreshing: boolean;
  lastFetchedAt: number | null;
  refreshPortfolio: (options?: PortfolioRefreshOptions) => Promise<void>;
  applyOrderUpdate: (order: any) => void;
  setGuestFallback: () => void;
}

let inflightRequest: Promise<void> | null = null;

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      summary: null,
      holdings: [],
      positions: [],
      activeOrders: [],
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
          state.activeOrders.length > 0 ||
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
            api.get('/api/trade/orders', { params }),
            api.get('/api/portfolio/sectors', { params }),
            api.get('/api/portfolio/research', { params }),
            api.get('/api/history/trades', { params: { ...params, limit: 100, sort_by: 'id', sort_order: 'desc' } }),
            api.get('/api/history/monthly-summary', { params }),
          ]);

          const [sumR, holdR, posR, ordR, secR, resR, histR, monthR] = results;
          const successCount = results.filter((r) => r.status === 'fulfilled').length;

          set((prev) => ({
            summary:
              sumR.status === 'fulfilled' ? sumR.value.data : prev.summary || DEFAULT_SUMMARY,
            holdings:
              holdR.status === 'fulfilled' ? holdR.value.data.holdings || [] : prev.holdings,
            positions:
              posR.status === 'fulfilled' ? posR.value.data.positions || [] : prev.positions,
            activeOrders:
              ordR.status === 'fulfilled' ? ordR.value.data || [] : prev.activeOrders,
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

      applyOrderUpdate: (order: any) => {
        set((state) => {
          // 1. Update activeOrders
          let nextOrders = [...state.activeOrders];
          const orderIndex = nextOrders.findIndex(o => o.trade_id === order.trade_id);
          if (['PENDING', 'OPEN', 'TRIGGERED'].includes(order.status)) {
            if (orderIndex !== -1) nextOrders[orderIndex] = order;
            else nextOrders = [order, ...nextOrders];
          } else {
            // Remove cancelled/closed/filled if they shouldn't be in 'active' anymore
            if (orderIndex !== -1) nextOrders.splice(orderIndex, 1);
          }

          // 2. Update positions
          let nextPositions = [...state.positions];
          if (order.status === 'OPEN' || order.status === 'TRIGGERED') {
            const posIndex = nextPositions.findIndex(p => p.symbol === order.symbol);
            if (posIndex !== -1) nextPositions[posIndex] = { ...nextPositions[posIndex], ...order };
            else nextPositions = [{ ...order, avg_price: order.entry_price }, ...nextPositions];
          } else if (order.status === 'CLOSED') {
            nextPositions = nextPositions.filter(p => {
               // If closing a specific trade, we'd need more complex logic for partials,
               // but for now let's just assume we want to refresh positions from API 
               // eventually. Local removal is fine for single-lot trading.
               return p.symbol !== order.symbol; 
            });
          }

          // 3. Update Summary (Cash Balance estimation)
          let nextSummary = state.summary ? { ...state.summary } : { ...DEFAULT_SUMMARY };
          if (order.status === 'CLOSED' && order.pnl !== undefined) {
             nextSummary.cash_balance += (order.pnl || 0);
          }

          return {
            activeOrders: nextOrders,
            positions: nextPositions,
            summary: nextSummary,
            lastFetchedAt: Date.now() // Treat local update as fresh-ish
          };
        });
      },

      setGuestFallback: () => {
        set({
          summary: DEFAULT_SUMMARY,
          holdings: [],
          positions: [],
          activeOrders: [],
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
        activeOrders: state.activeOrders,
        history: state.history,
        monthlySummary: state.monthlySummary,
        sectors: state.sectors,
        research: state.research,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
);
