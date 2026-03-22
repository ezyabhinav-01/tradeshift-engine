import React, { useState, useCallback } from 'react';
import { X, Search } from 'lucide-react';
import { useMultiChartStore } from '../../store/useMultiChartStore';
import type { ChartInstance } from '../../store/useMultiChartStore';
import type { GameData } from './ProChart';
import type { DrawingToolId } from '../../hooks/useDrawingTools';
import type { IndicatorTemplate } from '../../store/useChartObjects';
import { SymbolSearch } from '../features/SymbolSearch';
import './MultiChartGrid.css';

// ─── Layout Icons ──────────────────────────────────────────────────────────

const Layout1Icon = () => (
  <svg viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const Layout2Icon = () => (
  <svg viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <rect x="8" y="1" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const Layout3Icon = () => (
  <svg viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="12" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const Layout4Icon = () => (
  <svg viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const LAYOUT_ICONS = [
  { type: 1 as const, icon: Layout1Icon, label: '1 Chart' },
  { type: 2 as const, icon: Layout2Icon, label: '2 Charts' },
  { type: 3 as const, icon: Layout3Icon, label: '1+2 Charts' },
  { type: 4 as const, icon: Layout4Icon, label: '4 Charts' },
];

// ─── Layout Switcher ───────────────────────────────────────────────────────

export const LayoutSwitcher: React.FC = () => {
  const { layoutType, setLayoutType } = useMultiChartStore();

  return (
    <div className="layout-switcher">
      {LAYOUT_ICONS.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          className={`layout-btn ${layoutType === type ? 'active' : ''}`}
          onClick={() => setLayoutType(type)}
          title={label}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
};

// ─── OHLCV type ────────────────────────────────────────────────────────────

interface OHLCV {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// ─── Chart Slot ────────────────────────────────────────────────────────────

interface ChartSlotProps {
  chart: ChartInstance;
  index: number;
  isActive: boolean;
  canClose: boolean;
  onActivate: () => void;
  onClose: () => void;
  onSymbolChange: (symbol: string) => void;
  children: React.ReactNode;
}

const ChartSlot: React.FC<ChartSlotProps> = React.memo(({
  chart,
  index,
  isActive,
  canClose,
  onActivate,
  onClose,
  onSymbolChange,
  children,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleSearchSelect = useCallback((symbol: string, _token: string) => {
    onSymbolChange(symbol);
  }, [onSymbolChange]);

  return (
    <div
      className={`chart-slot ${isActive ? 'active' : ''}`}
      onClick={onActivate}
    >
      {/* Per-chart symbol search */}
      <SymbolSearch
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelect={handleSearchSelect}
        activeChartId={chart.id}
      />

      {/* Header */}
      <div className="chart-slot-header">
        <div className="chart-slot-header-left">
          <span className="chart-slot-index">{index + 1}</span>
          <button
            className="chart-slot-search-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsSearchOpen(true);
            }}
            title="Change symbol"
          >
            <Search size={10} />
          </button>
          <span className="chart-slot-symbol">{chart.symbol}</span>
          <span className="chart-slot-timeframe">· {chart.timeframe}</span>
          {isActive && (
            <span className="chart-slot-active-badge">ACTIVE</span>
          )}
        </div>
        <div className="chart-slot-header-right">
          {canClose && (
            <button
              className="chart-slot-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Remove chart"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="chart-slot-body">
        {children}
      </div>
    </div>
  );
});

// ─── Multi-Chart Grid Props ────────────────────────────────────────────────

export interface ChartInteractionProps {
  data: OHLCV[];
  gameData: GameData;
  activeDrawingTool?: DrawingToolId;
  onDrawingToolChange?: (tool: DrawingToolId) => void;
  isLibraryOpen?: boolean;
  onToggleLibrary?: () => void;
  onPriceClick?: (price: number) => void;
  onEntryLineClick?: (tradeId: string | number) => void;
  previewPrice?: number | null;
  isIndicatorsOpen?: boolean;
  onToggleIndicators?: () => void;
  isAlertsOpen?: boolean;
  onToggleAlerts?: () => void;
  onIndicatorStateChange?: (ids: string[], applyFn: (template: IndicatorTemplate) => void) => void;
}

interface MultiChartGridProps {
  /** Chart interaction props passed to each ProChart instance */
  chartProps: ChartInteractionProps;
  /** The ProChart component to render (avoids import cycle) */
  ProChartComponent: React.ComponentType<any>;
}

// ─── Multi-Chart Grid ──────────────────────────────────────────────────────

export const MultiChartGrid: React.FC<MultiChartGridProps> = ({
  chartProps,
  ProChartComponent,
}) => {
  const { charts, layoutType, activeChartId, setActiveChart, removeChart, updateChart } =
    useMultiChartStore();

  // Only show charts up to the layout count
  const visibleCharts = charts.slice(0, layoutType);

  const handleSymbolChange = useCallback((chartId: string, symbol: string) => {
    updateChart(chartId, { symbol });
    // Auto-activate the chart being changed so the global sync picks it up
    setActiveChart(chartId);
  }, [updateChart, setActiveChart]);

  return (
    <div className="multi-chart-grid" data-layout={layoutType}>
      {visibleCharts.map((chart, i) => {
        // isPrimary = active chart gets replay controls, drawing tools, etc.
        const isPrimary = activeChartId === chart.id;
        return (
          <ChartSlot
            key={chart.id}
            chart={chart}
            index={i}
            isActive={activeChartId === chart.id}
            canClose={visibleCharts.length > 1}
            onActivate={() => setActiveChart(chart.id)}
            onClose={() => removeChart(chart.id)}
            onSymbolChange={(symbol) => handleSymbolChange(chart.id, symbol)}
          >
            <ProChartComponent
              chartId={chart.id}
              isPrimary={isPrimary}
              gameData={chartProps.gameData}
              data={chart.candleData}
              activeDrawingTool={isPrimary ? chartProps.activeDrawingTool : undefined}
              onDrawingToolChange={isPrimary ? chartProps.onDrawingToolChange : undefined}
              isLibraryOpen={isPrimary ? chartProps.isLibraryOpen : false}
              onToggleLibrary={isPrimary ? chartProps.onToggleLibrary : undefined}
              onPriceClick={isPrimary ? chartProps.onPriceClick : undefined}
              onEntryLineClick={isPrimary ? chartProps.onEntryLineClick : undefined}
              previewPrice={isPrimary ? chartProps.previewPrice : null}
              isIndicatorsOpen={isPrimary ? chartProps.isIndicatorsOpen : false}
              onToggleIndicators={isPrimary ? chartProps.onToggleIndicators : undefined}
              isAlertsOpen={isPrimary ? chartProps.isAlertsOpen : false}
              onToggleAlerts={isPrimary ? chartProps.onToggleAlerts : undefined}
              onIndicatorStateChange={isPrimary ? chartProps.onIndicatorStateChange : undefined}
            />
          </ChartSlot>
        );
      })}
    </div>
  );
};

export default MultiChartGrid;
