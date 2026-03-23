import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, ColorType, CandlestickSeries } from '@pipsend/charts';
import type { IChartApi, ISeriesApi } from '@pipsend/charts';
import { useChartIndicators } from '../../hooks/useChartIndicators';
import { useDrawingTools } from '../../hooks/useDrawingTools';
import type { DrawingToolId } from '../../hooks/useDrawingTools';
import { useIndicatorSettings } from '../../store/useIndicatorSettings';
import { useMultiChartStore } from '../../store/useMultiChartStore';
import type { ChartInstance } from '../../store/useMultiChartStore';
import { useDrawingSettings } from '../../store/useDrawingSettings';
import IndicatorLegend from './IndicatorLegend';
import { IndicatorDialog } from './IndicatorDialog';
import { DrawingPropertiesPanel } from './DrawingPropertiesPanel';
import { DrawingToolbar } from './DrawingToolbar';
import { FavoritesToolbar } from './FavoritesToolbar';
import { useDrawingSerialization } from '../../hooks/useDrawingSerialization';
import { useTemplatePersistence } from '../../hooks/useTemplatePersistence';
import { TemplateLibrary } from './TemplateLibrary';
import { SaveTemplateModal } from './SaveTemplateModal';
import { ErrorBoundary } from './ErrorBoundary';
import { useChartObjects } from '../../store/useChartObjects';
import type { DrawingTemplate, IndicatorTemplate } from '../../store/useChartObjects';
import { useGame } from '../../context/GameContext';
import type { IndexData } from '../../context/GameContext';
import { useAlerts } from '../../store/useAlerts';
import { AlertDialog } from './AlertDialog';
import { toast } from 'sonner';

interface OHLCV {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface GameData {
  currentPrice: number;
  currentCandle: any;
  isPlaying: boolean;
  selectedSymbol: string;
  togglePlay: () => void;
  isReplayActive: boolean;
  toggleReplay: () => void;
  selectedDate: string;
  availableDates: string[];
  setDate: (d: string) => void;
  speed: number;
  setSpeed: (s: number) => void;
  trades: any[];
  modifyOrder: (id: any, updates: any) => void;
  currentTime: Date | null;
  simulatedIndices: any[];
  /** Per-symbol latest candle for multi-chart independent tick updates */
  replayTicks?: Record<string, any>;
}

interface ProChartProps {
  data: OHLCV[];
  width?: number;
  height?: number;
  theme?: 'dark' | 'light';
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
  /** Unique chart ID for multi-chart support */
  chartId?: string;
  /** Is this the primary chart (shows trading UI, replay controls) */
  isPrimary?: boolean;
  /** Game data from parent — if provided, skips internal useGame() */
  gameData?: GameData;
}

export const ProChart: React.FC<ProChartProps> = ({ 
  data, width, height, theme = 'dark', activeDrawingTool, onDrawingToolChange,
  isLibraryOpen, onToggleLibrary,
  onPriceClick, onEntryLineClick, previewPrice, isIndicatorsOpen, onToggleIndicators,
  isAlertsOpen: externalAlertsOpen, onToggleAlerts, onIndicatorStateChange,
  chartId = 'chart-0', isPrimary = true, gameData,
}) => {
  const { magnetMode } = useDrawingSettings();
  const internalGame = useGame();
  const {
    currentPrice, currentCandle, isPlaying, 
    selectedSymbol, isReplayActive,
    trades, modifyOrder,
    currentTime, simulatedIndices,
    replayTicks
  } = (gameData || internalGame) as any;

  const { charts } = useMultiChartStore();
  const myChart = charts.find((c: ChartInstance) => c.id === chartId);
  const mySymbol = myChart?.symbol || selectedSymbol;

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [chartInstance, setChartInstance] = useState<IChartApi | null>(null);
  const [seriesInstance, setSeriesInstance] = useState<ISeriesApi<'Candlestick'> | null>(null);
  
  const previewLineRef = useRef<any>(null);
  const positionLinesRef = useRef<{ id: string | number, type: 'ENTRY' | 'SL' | 'TP', line: any }[]>([]);
  const draggingRef = useRef<{ id: string | number, type: 'SL' | 'TP', line: any } | null>(null);
  const activeToolRef = useRef(activeDrawingTool);

  useEffect(() => {
    activeToolRef.current = activeDrawingTool;
  }, [activeDrawingTool]);

  const [positionsWithPnL, setPositionsWithPnL] = useState<any[]>([]);
  const [isLocalAlertsOpen, setIsLocalAlertsOpen] = useState(false);
  const lastPriceRef = useRef<number>(currentPrice);

  // Combine external (from TopToolbar) and internal (from DrawingToolbar) alert triggers
  const isAlertsDialogOpen = externalAlertsOpen || isLocalAlertsOpen;
  const closeAlertsDialog = () => {
    setIsLocalAlertsOpen(false);
    onToggleAlerts?.();
  };

  // Sync non-primary charts (indices) with simulatedTicks
  const myIndexData = useMemo(() => {
    if (!isReplayActive || !simulatedIndices.length) return null;
    return simulatedIndices.find((idx: IndexData) => 
      idx.name === mySymbol || 
      (mySymbol === 'NIFTY' && idx.name === 'NIFTY 50') ||
      (mySymbol === 'BANKNIFTY' && idx.name === 'BANKNIFTY')
    );
  }, [simulatedIndices, mySymbol, isReplayActive]);

  // OHLC legend fallback: use last candle from data prop when currentCandle is null
  // OHLC legend fallback: use last candle from data prop when currentCandle is null
  const displayCandle = currentCandle || 
    (myIndexData ? { 
        time: Math.floor(currentTime?.getTime() || 0 / 1000),
        open: myIndexData.price, 
        high: myIndexData.price, 
        low: myIndexData.price, 
        close: myIndexData.price,
        symbol: mySymbol
    } : null) || 
    (data.length > 0 ? data[data.length - 1] : null);

  const { activeIndicators, currentValues, hoverValues, updateHoverValues,
    addSMA, addEMA, addVWAP, addBB, addRSI, addMACD, 
    removeIndicator, setIndicatorVisibility,
    applyTemplate
  } = useChartIndicators(chartInstance, seriesInstance);

  const { alerts, updateAlert } = useAlerts();

  const {
    activeTool,
    selectedToolId,
    selectTool,
    cloneTool,
    hideTool,
    clearAllDrawings,
    deleteSelected,
    managerRef,
    zoomIn,
    zoomOut,
  } = useDrawingTools(chartInstance, seriesInstance, chartContainerRef);

  useEffect(() => {
    if (onDrawingToolChange) {
      onDrawingToolChange(activeTool as DrawingToolId);
    }
  }, [activeTool, onDrawingToolChange]);

  const { serialize, deserialize } = useDrawingSerialization(chartRef.current, seriesRef.current, managerRef.current);
  const { saveTemplate, syncIndicators, syncDrawings, deleteTemplate: deleteLocalTemplate } = useChartObjects();
  const { 
    saveDrawingTemplate, deleteDrawingTemplate, 
  } = useTemplatePersistence();
  const { settings: indicatorSettings, setSettings: setIndicatorSettings } = useIndicatorSettings();

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);

  const handleOpenSaveModal = () => {
    if (chartRef.current) {
      const canvas = chartRef.current.takeScreenshot();
      setCurrentScreenshot(canvas.toDataURL());
      setIsSaveModalOpen(true);
    }
  };

  const handleSaveTemplate = (name: string, category: string, tags: string[]) => {
    const drawings = serialize();
    const template: DrawingTemplate = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      category,
      tags,
      data: drawings,
      thumbnail: currentScreenshot || '',
      timestamp: Date.now(),
    };
    saveTemplate(template);
    saveDrawingTemplate(template);
  };

  const handleApplyTemplate = (template: DrawingTemplate) => {
    deserialize(template.data);
    // Explicitly sync drawings to store after applying template
    const drawings = serialize();
    syncDrawings(drawings.map(d => d.id || ''));
    if (onToggleLibrary) onToggleLibrary();
  };

  const handleDeleteTemplate = (id: string) => {
    deleteLocalTemplate(id);
    deleteDrawingTemplate(id);
  };

  const handleApplyIndicatorTemplate = (template: IndicatorTemplate) => {
    // 1. Update settings first
    setIndicatorSettings(template.settings);
    
    // 2. Use the hook's applyTemplate which handles the sequence correctly
    applyTemplate(template);
    
    toast.success(`Applied template: ${template.name}`);
  };

  useEffect(() => {
    if (activeDrawingTool !== undefined) {
      selectTool(activeDrawingTool);
    }
  }, [activeDrawingTool, selectTool]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleOpenSaveModal();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          deleteSelected();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected]);

  useEffect(() => {
    const ids = Object.keys(activeIndicators);
    const colorMap: Record<string, string> = {
      SMA: indicatorSettings.SMA.color,
      EMA: indicatorSettings.EMA.color,
      VWAP: indicatorSettings.VWAP.color,
      BB: indicatorSettings.BB.basisColor,
      RSI: indicatorSettings.RSI.color,
      MACD: indicatorSettings.MACD.macdColor,
    };
    syncIndicators(ids, colorMap);
    if (onIndicatorStateChange) {
      onIndicatorStateChange(ids, handleApplyIndicatorTemplate);
    }
  }, [activeIndicators, indicatorSettings, syncIndicators, onIndicatorStateChange]);

  useEffect(() => {
    if (!managerRef.current) return;
    const interval = setInterval(() => {
      const tools = managerRef.current?.getAllTools();
      if (tools) {
        syncDrawings(Array.from(tools.keys()));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [managerRef, syncDrawings]);

  const handleToggleIndicator = (id: string, forceRecreate = false) => {
    if (!chartRef.current || !seriesRef.current) return;
    const isActive = !!activeIndicators[id];

    if (isActive) {
      removeIndicator(id);
    }
    
    if (!isActive || forceRecreate) {
      setTimeout(() => {
        if (!chartRef.current || !seriesRef.current) return;
        if (id === 'SMA') addSMA();
        if (id === 'EMA') addEMA();
        if (id === 'VWAP') addVWAP();
        if (id === 'BB') addBB();
        if (id === 'RSI') addRSI();
        if (id === 'MACD') addMACD();
      }, forceRecreate ? 50 : 0);
    }
  };


  // Drag Logic
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (!seriesRef.current || !chartRef.current) return;
      const rect = container.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      
      const clickedLine = positionLinesRef.current.find(item => {
        const priceY = seriesRef.current!.priceToCoordinate(item.line.options().price);
        if (priceY === null) return false;
        return Math.abs(priceY - mouseY) < 12;
      });

      if (clickedLine) {
        if (clickedLine.type === 'ENTRY') {
          onEntryLineClick?.(clickedLine.id);
          return;
        }
        draggingRef.current = { id: clickedLine.id, type: clickedLine.type as 'SL' | 'TP', line: clickedLine.line };
        clickedLine.line.applyOptions({ lineWidth: 3, lineStyle: 0 });
        container.style.cursor = 'ns-resize';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !seriesRef.current) return;
      const rect = container.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      const newPrice = seriesRef.current.coordinateToPrice(mouseY);
      if (newPrice !== null) {
        const snappedPrice = Math.round(newPrice * 20) / 20;
        draggingRef.current.line.applyOptions({ 
          price: snappedPrice,
          title: `${draggingRef.current.type}: ₹${snappedPrice.toFixed(2)} (Updating...)`
        });
      }
    };

    const handleMouseUp = () => {
      if (!draggingRef.current) return;
      const finalPrice = draggingRef.current.line.options().price;
      const { id, type } = draggingRef.current;
      modifyOrder(id, { [type === 'SL' ? 'stop_loss' : 'take_profit']: finalPrice });
      draggingRef.current.line.applyOptions({ lineWidth: 1, lineStyle: 2, title: `${type}: ₹${finalPrice.toFixed(2)}` });
      draggingRef.current = null;
      container.style.cursor = 'default';
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectedSymbol, modifyOrder, onEntryLineClick]);

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const isDark = theme === 'dark';
    
    const chart = createChart(chartContainerRef.current, {
      layout: { 
        background: { type: ColorType.Solid, color: isDark ? '#121212' : '#ffffff' }, 
        textColor: isDark ? '#D1D4DC' : '#131722',
        fontSize: 12,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      },
      grid: { 
        vertLines: { color: isDark ? 'rgba(42, 46, 57, 0.3)' : 'rgba(240, 243, 250, 0.5)', style: 1 }, 
        horzLines: { color: isDark ? 'rgba(42, 46, 57, 0.3)' : 'rgba(240, 243, 250, 0.5)', style: 1 } 
      },
      width: width || chartContainerRef.current.clientWidth,
      height: height || chartContainerRef.current.clientHeight,
      timeScale: { 
        timeVisible: true, 
        secondsVisible: false, 
        borderColor: isDark ? 'rgba(42, 46, 57, 0.5)' : '#E0E3EB',
      },
      crosshair: {
        mode: magnetMode ? 1 : 0,
        vertLine: { color: 'rgba(120, 123, 134, 0.5)', width: 1, style: 2, labelBackgroundColor: '#2962FF' },
        horzLine: { color: 'rgba(120, 123, 134, 0.5)', width: 1, style: 2, labelBackgroundColor: '#2962FF' },
      }
    });
    chartRef.current = chart;
    setChartInstance(chart);

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#089981', downColor: '#f23645', borderVisible: true,
      wickUpColor: '#089981', wickDownColor: '#f23645',
      borderUpColor: '#089981', borderDownColor: '#f23645',
      title: '',
      statusLineVisible: false,
    } as any);
    seriesRef.current = series as any;
    setSeriesInstance(series as any);

    chart.priceScale('right').applyOptions({ 
      scaleMargins: { top: 0.1, bottom: 0.1 },
      borderColor: isDark ? 'rgba(42, 46, 57, 0.5)' : '#E0E3EB',
    });

    chart.subscribeClick((param: any) => {
      if (activeToolRef.current) return;
      if (!param || !param.point || !seriesRef.current) return;

      // Wrap in a small timeout to allow DrawingToolsManager to update selection state
      setTimeout(() => {
        // If a tool was just selected (or is already selected), suppress the buy/sell menu
        if (managerRef.current?.getSelectedToolId()) {
          return;
        }

        try {
          const price = seriesRef.current?.coordinateToPrice(param.point.y);
          if (price !== null && price && price > 0 && onPriceClick) {
            onPriceClick(Math.round(price * 100) / 100);
          }
        } catch (e) {}
      }, 100);
    });


    const currentData = dataRef.current;
    if (currentData.length > 0) {
      const uniqueData = Array.from(new Map(currentData.map((d) => [d.time, d])).values()).sort((a, b) => (a.time as number) - (b.time as number));
      series.setData(uniqueData as any);
      chart.timeScale().fitContent();
    }

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].target) return;
      const { width: newWidth, height: newHeight } = entries[0].contentRect;
      chart.applyOptions({ width: newWidth, height: newHeight });
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      setChartInstance(null);
      setSeriesInstance(null);
    };
  // Only re-create chart on theme change. Resize is handled by ResizeObserver.
  // Removing width/height prevents destroying indicators & drawings during replay.
  }, [theme]);

  useEffect(() => {
    if (chartInstance) {
      chartInstance.applyOptions({ crosshair: { mode: magnetMode ? 1 : 0 } });
    }
  }, [magnetMode, chartInstance]);

  useEffect(() => {
    if (!chartInstance) return;

    const handleCrosshairMove = (param: any) => {
      if (param.time) {
        updateHoverValues(param.time);
      } else {
        updateHoverValues(null);
      }
    };

    chartInstance.subscribeCrosshairMove(handleCrosshairMove);
    return () => {
      chartInstance.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [chartInstance, updateHoverValues]);

  const lastDataSetTimeRef = useRef<number>(0);
  // Track whether we were playing in the previous render to detect play-start
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    if (!seriesRef.current) return;
    
    if (data.length === 0) {
      // Clear chart if data is empty
      try { seriesRef.current.setData([]); volumeSeriesRef.current?.setData([]); } catch {}
      lastDataSetTimeRef.current = 0;
      
      // If NOT replaying, we can return early as there's no live data incoming
      if (!isReplayActive) return;
    }

    try {
      // When play starts fresh, reset so Phase 2 (tick updates) accepts incoming ticks
      if (isPlaying && !wasPlayingRef.current) {
        lastDataSetTimeRef.current = 0;
      }
      wasPlayingRef.current = isPlaying;

      // ═══════════════════════════════════════════════════════════════════
      // PHASE 1: Historical Data Load (setData)
      // We run this if the chart needs a full reset (initial load or scrubbing).
      // When in Replay mode, we FILTER this data to only show candles BEFORE
      // the current replay time. This prevents "future" candles from blocking
      // incoming ticks in Phase 2.
      // ═══════════════════════════════════════════════════════════════════
      const isActivelyPlaying = isReplayActive && isPlaying;
      
      // Detect if we need a full reload (e.g. initial load or scrubbing backwards)
      const currentTickTime = currentTime ? Math.floor(currentTime.getTime() / 1000) : 0;
      const needsFullReset = lastDataSetTimeRef.current === 0 || 
                            (isReplayActive && currentTickTime < lastDataSetTimeRef.current);

      if (needsFullReset || !isActivelyPlaying) {
        const uniqueData = Array.from(
          data
            .filter(d => {
              if (!d || typeof d.time !== 'number' || d.open === undefined) return false;
              // Cutoff logic: don't show candles at or after the current replay time
              if (isReplayActive && currentTickTime > 0) {
                return (d.time as number) < currentTickTime;
              }
              return true;
            })
            .reduce((map, d) => map.set(Math.floor(d.time as number), d), new Map())
            .values()
        ).sort((a: any, b: any) => a.time - b.time);

        seriesRef.current.setData(uniqueData as any);
        if (volumeSeriesRef.current) {
          const volData = uniqueData.map((d: any) => ({
            time: d.time,
            value: d.volume || 0,
            color: d.close >= d.open ? '#089981' : '#f23645'
          }));
          volumeSeriesRef.current.setData(volData as any);
        }
        lastDataSetTimeRef.current = uniqueData.length > 0
          ? Math.floor((uniqueData[uniqueData.length - 1] as any).time)
          : currentTickTime; // If no history, set to current so ticks can advance
      }

      // ═══════════════════════════════════════════════════════════════════
      // PHASE 2: Live Tick Progression (update)
      // Only run if we are in replay mode and actively playing.
      // Each tick call to update() appends/modifies the latest candle.
      // ═══════════════════════════════════════════════════════════════════
      if (isReplayActive && isPlaying && seriesRef.current) {
        // Determine the best candle for this chart:
        // 1. Multi-chart: use replayTicks[mySymbol] for independent updates
        // 2. Primary symbol fallback: use currentCandle
        const myTick = (replayTicks && replayTicks[mySymbol])
          ? replayTicks[mySymbol]
          : (currentCandle && currentCandle.symbol === mySymbol ? currentCandle : null);

        if (myTick && typeof myTick.time === 'number') {
          const candleTime = Math.floor(myTick.time);
          // Only accept ticks that are >= the last processed time (prevent backwards-time errors)
          if (candleTime >= lastDataSetTimeRef.current) {
            try {
              seriesRef.current.update({
                ...myTick,
                time: candleTime,
                open: Number(myTick.open) || 0,
                high: Number(myTick.high) || 0,
                low: Number(myTick.low) || 0,
                close: Number(myTick.close) || 0,
              } as any);
              // Track the latest tick time so we never go backwards
              lastDataSetTimeRef.current = candleTime;
            } catch (e) {
              // lightweight-charts will throw if time goes backwards; safe to ignore
            }
          }
        } else if (myIndexData && typeof myIndexData.price === 'number' && currentTime) {
          // Index chart fallback: synthesize candle from index price
          const rawTime = currentTime.getTime() / 1000;
          const candleTime = Math.floor(rawTime / 60) * 60;
          if (candleTime >= lastDataSetTimeRef.current) {
            try {
              seriesRef.current.update({
                time: candleTime,
                open: myIndexData.price,
                high: myIndexData.price,
                low: myIndexData.price,
                close: myIndexData.price,
              } as any);
              lastDataSetTimeRef.current = candleTime;
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      console.error("ProChart Master Effect Failure:", e);
      // Force a full reset on next tick if possible
      lastDataSetTimeRef.current = 0;
    }
  }, [data, isReplayActive, isPlaying, currentTime, currentCandle, mySymbol, myIndexData, replayTicks]);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (previewLineRef.current) {
      try { seriesRef.current.removePriceLine(previewLineRef.current); } catch {}
      previewLineRef.current = null;
    }
    if (previewPrice && previewPrice > 0) {
      previewLineRef.current = seriesRef.current.createPriceLine({
        price: previewPrice, color: '#f59e0b', lineWidth: 2, lineStyle: 2,
        axisLabelVisible: true, title: `► ₹${previewPrice.toFixed(2)}`,
      });
    }
  }, [previewPrice]);

  useEffect(() => {
    if (!seriesRef.current || !data.length) return;
    positionLinesRef.current.forEach(item => {
      try { seriesRef.current?.removePriceLine(item.line); } catch (e) {}
    });
    positionLinesRef.current = [];
    const activeTrades = trades.filter((t: any) => t.symbol === selectedSymbol && ['OPEN', 'PENDING', 'TRIGGERED'].includes(t.status));
    activeTrades.forEach((trade: any) => {
      const isBuy = (trade.direction || trade.type) === 'BUY';
      const entryColor = isBuy ? '#26a69a' : '#ef5350';
      if (trade.entryPrice > 0) {
        const entryLine = seriesRef.current!.createPriceLine({
          price: trade.entryPrice, color: entryColor, lineWidth: 2, lineStyle: 0,
          axisLabelVisible: true, title: `${trade.status === 'PENDING' ? 'LMT' : 'ENTRY'}: ₹${trade.entryPrice.toFixed(2)}`,
        });
        positionLinesRef.current.push({ id: trade.id, type: 'ENTRY', line: entryLine });
      }
      if (trade.stopLoss && trade.stopLoss > 0) {
        const slLine = seriesRef.current!.createPriceLine({
          price: trade.stopLoss, color: '#ef5350', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: `SL: ₹${trade.stopLoss.toFixed(2)}`,
        });
        positionLinesRef.current.push({ id: trade.id, type: 'SL', line: slLine });
      }
      if (trade.takeProfit && trade.takeProfit > 0) {
        const tpLine = seriesRef.current!.createPriceLine({
          price: trade.takeProfit, color: '#26a69a', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: `TP: ₹${trade.takeProfit.toFixed(2)}`,
        });
        positionLinesRef.current.push({ id: trade.id, type: 'TP', line: tpLine });
      }
    });
  }, [trades, selectedSymbol, data]);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || !isPrimary) {
      setPositionsWithPnL([]);
      return;
    }

    const updatePnLPositions = () => {
      if (!seriesRef.current || !chartRef.current) return;
      const validPrice = typeof currentPrice === 'number' ? currentPrice : 0;
      
      const activeTrades = trades.filter((t: any) => t.symbol === selectedSymbol && ['OPEN', 'TRIGGERED'].includes(t.status));
      const positions = activeTrades.map((trade: any) => {
        const isBuy = (trade.direction || trade.type) === 'BUY';
        const pnlValue = (validPrice - trade.entryPrice) * trade.quantity * (isBuy ? 1 : -1);
        const yCoord = seriesRef.current!.priceToCoordinate(trade.entryPrice);
        return {
          id: trade.id, price: trade.entryPrice, pnl: pnlValue,
          y: (yCoord as number) ?? -100, color: pnlValue >= 0 ? '#089981' : '#f23645',
          direction: String(trade.direction || trade.type || 'TRADE')
        };
      });
      setPositionsWithPnL(positions);
    };

    updatePnLPositions();
    const timeScale = chartRef.current.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(updatePnLPositions);
    return () => { 
      if (chartRef.current) {
        try { chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(updatePnLPositions); } catch (e) {}
      }
    };
  }, [trades, currentPrice, selectedSymbol, isPrimary]);

  // Alert Checking Logic
  useEffect(() => {
    if (!currentPrice || alerts.length === 0) {
      lastPriceRef.current = currentPrice;
      return;
    }

    const previousPrice = lastPriceRef.current;
    
    alerts.filter(a => a.active && a.symbol === selectedSymbol).forEach(alert => {
      let triggered = false;
      const { condition, value } = alert;

      if (condition === 'crossing') {
        triggered = (previousPrice <= value && currentPrice >= value) || 
                    (previousPrice >= value && currentPrice <= value);
      } else if (condition === 'crossing_up') {
        triggered = previousPrice < value && currentPrice >= value;
      } else if (condition === 'crossing_down') {
        triggered = previousPrice > value && currentPrice <= value;
      } else if (condition === 'greater_than') {
        triggered = currentPrice > value;
      } else if (condition === 'less_than') {
        triggered = currentPrice < value;
      }

      if (triggered) {
        console.log(`🔔 ALERT TRIGGERED: ${alert.condition} on ${alert.symbol} at ${currentPrice} (Threshold: ${alert.value})`);
        toast.info(alert.message, {
          description: `Price reached ${value.toFixed(2)}`,
          duration: 10000,
          action: {
            label: 'Close',
            onClick: () => console.log('Alert closed')
          }
        });

        // Update alert state
        if (alert.trigger === 'once') {
          updateAlert(alert.id, { active: false, lastTriggered: Date.now() });
        } else {
          updateAlert(alert.id, { lastTriggered: Date.now() });
        }
      }
    });

    lastPriceRef.current = currentPrice;
  }, [currentPrice, alerts, selectedSymbol, updateAlert]);

  return (
    <div 
      className={`relative w-full h-full bg-transparent overflow-hidden ${isPrimary ? 'pl-12' : 'pl-0'} flex flex-col`}
      data-chart-id={chartId}
    >
      <div className="absolute top-4 left-16 z-40 flex flex-col gap-0.5 pointer-events-none select-none min-w-[300px]">
        {/* Symbol and OHLC Row */}
        <div className="flex items-center gap-2 px-1 py-0.5 rounded-sm">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#d1d4dc] text-[13px] hover:text-white cursor-pointer pointer-events-auto">
              {mySymbol || 'Indian Rupee'}
            </span>
            <span className="text-[#d1d4dc]/40 text-[11px]">1m · NSE</span>
            <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-[#089981] animate-pulse' : 'bg-[#5d606b]'}`} />
          </div>
          
          <div className="flex items-center gap-2.5 text-[11px] font-medium ml-2">
            <div className="flex gap-0.5">
              <span className="text-[#d1d4dc]/40">O</span>
              <span className={(displayCandle?.open ?? 0) >= (displayCandle?.close ?? 0) ? 'text-[#089981]' : 'text-[#f23645]'}>{displayCandle?.open?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex gap-0.5">
              <span className="text-[#d1d4dc]/40">H</span>
              <span className={(displayCandle?.high ?? 0) >= (displayCandle?.close ?? 0) ? 'text-[#089981]' : 'text-[#f23645]'}>{displayCandle?.high?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex gap-0.5">
              <span className="text-[#d1d4dc]/40">L</span>
              <span className={(displayCandle?.low ?? 0) >= (displayCandle?.close ?? 0) ? 'text-[#089981]' : 'text-[#f23645]'}>{displayCandle?.low?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex gap-0.5">
              <span className="text-[#d1d4dc]/40">C</span>
              <span className={(displayCandle?.close ?? 0) >= (displayCandle?.open ?? 0) ? 'text-[#089981]' : 'text-[#f23645]'}>{displayCandle?.close?.toFixed(2) || '0.00'}</span>
            </div>
            {displayCandle && (
              <div className={`flex gap-1 ${(displayCandle.close - displayCandle.open) >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                <span>{(displayCandle.close - displayCandle.open).toFixed(2)}</span>
                <span>({(((displayCandle.close - displayCandle.open) / displayCandle.open) * 100).toFixed(2)}%)</span>
              </div>
            )}
          </div>
        </div>

        {/* Trade Buttons Row - Primary only */}
        {isPrimary && (
        <div className="flex items-center gap-1 pointer-events-auto ml-1">
          <div 
            className="flex flex-col items-center justify-center border border-[#f23645] bg-[#f23645]/5 rounded-[3px] px-2.5 py-0.5 cursor-pointer hover:bg-[#f23645]/15 group transition-colors min-w-[65px]" 
            onClick={() => onPriceClick?.(currentPrice)}
          >
            <span className="text-[#f23645] font-bold text-[11px] leading-tight">{currentPrice.toFixed(1)}</span>
            <span className="text-[#f23645]/60 text-[8px] font-bold uppercase leading-none mt-0.5">Sell</span>
          </div>
          <div className="text-[9px] font-medium text-[#d1d4dc]/20 px-0.5">0.1</div>
          <div 
            className="flex flex-col items-center justify-center border border-[#2962FF] bg-[#2962FF]/5 rounded-[3px] px-2.5 py-0.5 cursor-pointer hover:bg-[#2962FF]/15 group transition-colors min-w-[65px]" 
            onClick={() => onPriceClick?.(currentPrice + 0.1)}
          >
            <span className="text-[#2962FF] font-bold text-[11px] leading-tight">{(currentPrice + 0.1).toFixed(1)}</span>
            <span className="text-[#2962FF]/60 text-[8px] font-bold uppercase leading-none mt-0.5">Buy</span>
          </div>
        </div>
        )}

        <div className="mt-0.5">
          <IndicatorLegend 
            activeIds={Object.keys(activeIndicators)} 
            currentValues={hoverValues || currentValues}
            onToggle={handleToggleIndicator} 
            onVisibilityToggle={setIndicatorVisibility}
          />
        </div>
      </div>

      <DrawingPropertiesPanel
        selectedToolId={selectedToolId}
        managerRef={managerRef}
        onDeleteSelected={deleteSelected}
        onClone={cloneTool}
        onHide={hideTool}
      />

      {isPrimary && (
      <ErrorBoundary name="DrawingToolbar">
        <DrawingToolbar 
          activeTool={activeTool}
          onSelectTool={selectTool as any}
          onClearAll={() => {
            if (window.confirm("Are you sure you want to clear all drawings?")) {
              clearAllDrawings();
            }
          }}
          onToggleLibrary={onToggleLibrary}
          onOpenAlerts={() => setIsLocalAlertsOpen(true)}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
        />
      </ErrorBoundary>
      )}

      {isPrimary && (
      <ErrorBoundary name="FavoritesToolbar">
        <FavoritesToolbar 
          activeTool={activeTool}
          onSelectTool={selectTool as any}
        />
      </ErrorBoundary>
      )}

      <AlertDialog 
        isOpen={isAlertsDialogOpen}
        onClose={closeAlertsDialog}
        symbol={mySymbol || 'Symbol'}
        currentPrice={currentPrice}
      />

      {/* PnL Overlay - Primary only */}
      {isPrimary && (
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {positionsWithPnL.map((pos) => (
          pos.y > 0 && (
            <div key={pos.id} className="absolute left-[80px] flex items-center gap-2 transform -translate-y-1/2 transition-all duration-100 ease-linear" style={{ top: `${pos.y}px` }}>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md shadow-lg border backdrop-blur-md ${pos.pnl >= 0 ? 'bg-[#089981]/20 border-[#089981]/40 text-[#089981]' : 'bg-[#f23645]/20 border-[#f23645]/40 text-[#f23645]'}`}>
                <span className="text-[10px] font-black tracking-tighter uppercase opacity-60">{pos.direction}</span>
                <span className="text-xs font-mono font-black">{pos.pnl >= 0 ? '+' : ''}₹{Math.abs(pos.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${pos.pnl >= 0 ? 'bg-[#089981]' : 'bg-[#f23645]'}`} />
              </div>
              <div className={`h-[1px] w-[2000px] opacity-20 border-t border-dashed ${pos.pnl >= 0 ? 'border-[#089981]' : 'border-[#f23645]'}`} />
            </div>
          )
        ))}
      </div>
      )}

      {/* Replay Toolbar moved to TopToolbar */}

      {isLibraryOpen && onToggleLibrary && (
        <TemplateLibrary 
          isOpen={isLibraryOpen} 
          onClose={onToggleLibrary} 
          onApply={handleApplyTemplate} 
          onDelete={handleDeleteTemplate}
          onSaveNew={handleOpenSaveModal} 
        />
      )}

      <SaveTemplateModal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} onSave={handleSaveTemplate} thumbnail={currentScreenshot} />

      {isIndicatorsOpen && onToggleIndicators && (
        <IndicatorDialog isOpen={isIndicatorsOpen} onClose={onToggleIndicators} activeIds={Object.keys(activeIndicators)} onToggle={handleToggleIndicator} />
      )}

      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};

export default React.memo(ProChart);
