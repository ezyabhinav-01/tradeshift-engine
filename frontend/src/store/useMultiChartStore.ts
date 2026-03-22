import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OHLCV {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartInstance {
  id: string;
  symbol: string;
  timeframe: string;
  candleData: OHLCV[];
  indicators: string[];
  drawings: any[];
}

export type LayoutType = 1 | 2 | 3 | 4;

interface MultiChartState {
  charts: ChartInstance[];
  layoutType: LayoutType;
  activeChartId: string;

  // Layout
  setLayoutType: (type: LayoutType) => void;
  setActiveChart: (id: string) => void;

  // Chart CRUD
  addChart: (symbol?: string) => void;
  removeChart: (id: string) => void;
  updateChart: (id: string, updates: Partial<ChartInstance>) => void;
  setChartData: (id: string, data: OHLCV[]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MAX_CHARTS = 4;

function createChartInstance(index: number): ChartInstance {
  return {
    id: `chart-${index}`,
    symbol: index === 0 ? 'RELIANCE' : 'NIFTY',
    timeframe: '1D',
    candleData: [],
    indicators: [],
    drawings: [],
  };
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useMultiChartStore = create<MultiChartState>()((set, get) => ({
  charts: [createChartInstance(0)],
  layoutType: 1,
  activeChartId: 'chart-0',

  setLayoutType: (type: LayoutType) => {
    const state = get();
    const currentCount = state.charts.length;

    // Auto-add charts if the layout needs more than we have
    if (type > currentCount) {
      const newCharts = [...state.charts];
      for (let i = currentCount; i < type; i++) {
        newCharts.push(createChartInstance(i));
      }
      set({ layoutType: type, charts: newCharts });
    } else {
      // For fewer slots, keep all charts in memory but change the layout
      set({ layoutType: type });
    }
  },

  setActiveChart: (id: string) => set({ activeChartId: id }),

  addChart: (symbol?: string) => {
    const state = get();
    if (state.charts.length >= MAX_CHARTS) return;

    const nextIndex = state.charts.length;
    const newChart = createChartInstance(nextIndex);
    if (symbol) newChart.symbol = symbol;
    
    const newCharts = [...state.charts, newChart];
    
    // Auto-adjust layout to accommodate
    const newLayout = Math.min(newCharts.length, 4) as LayoutType;
    set({ 
      charts: newCharts, 
      layoutType: newLayout,
      activeChartId: newChart.id 
    });
  },

  removeChart: (id: string) => {
    const state = get();
    // Don't remove the last chart
    if (state.charts.length <= 1) return;

    const filtered = state.charts.filter((c) => c.id !== id);
    const newLayout = Math.min(filtered.length, 4) as LayoutType;
    const newActive = state.activeChartId === id
      ? filtered[0].id
      : state.activeChartId;

    set({
      charts: filtered,
      layoutType: newLayout,
      activeChartId: newActive,
    });
  },

  updateChart: (id: string, updates: Partial<ChartInstance>) =>
    set((state) => ({
      charts: state.charts.map((c) => {
        if (c.id === id) {
          const hasSymbolChange = updates.symbol && updates.symbol !== c.symbol;
          return {
            ...c,
            ...updates,
            candleData: hasSymbolChange ? [] : (updates.candleData || c.candleData),
          };
        }
        return c;
      }),
    })),

  setChartData: (id: string, data: OHLCV[]) =>
    set((state) => ({
      charts: state.charts.map((c) =>
        c.id === id ? { ...c, candleData: data } : c
      ),
    })),
}));
