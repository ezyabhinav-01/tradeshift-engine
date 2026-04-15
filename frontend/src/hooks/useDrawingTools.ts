import { useRef, useCallback, useState, useEffect } from 'react';
import {
  DrawingToolsManager,
  createInteractiveLineManager,
  createHorizontalLineTool,
  createVerticalLineTool,
  createFibonacciExtensionTool,
  createFibonacciTool,
  createTrendLineTool,
  createRectangleTool,
  createCircleTool,
  createArrowTool,
  createPositionTool,
  createBrushTool,
  // @ts-ignore: Custom ruler tool injected at runtime
  createRulerTool,
} from '@pipsend/charts';
import type { IChartApi, ISeriesApi } from '@pipsend/charts';
import { useDrawingHistory } from './useDrawingHistory';
import { useDrawingSettings } from '../store/useDrawingSettings';

// All tool IDs the sidebar can activate
export type DrawingToolId =
  | 'cursor'
  | 'dot'
  | 'arrow_cursor'
  | 'eraser'
  | 'trendline'
  | 'hline'
  | 'vline'
  | 'ray'
  | 'fibonacci'
  | 'fib_fan'
  | 'fib_ext'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'brush'
  | 'text'
  | 'note'
  | 'ruler'
  | 'long_pos'
  | 'short_pos'
  | 'cross'
  | 'hray'
  | 'extended'
  | 'zoom_in'
  | 'zoom_out'
  | null;

const COLOR_PALETTE = [
  '#2962FF', // Blue
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#F44336', // Red
];

const SELECTION_COLORS = new Set([
  '#2962ff', // configured selection blue
  '#ff6b00', // library selection orange
]);

export const useDrawingTools = (
  chart: IChartApi | null, 
  series: ISeriesApi<any> | null,
  containerRef: React.RefObject<HTMLDivElement | null>
) => {
  const [activeTool, setActiveTool] = useState<DrawingToolId>(null);
  const activeToolRef = useRef<DrawingToolId>(null);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  // Persistent ref that remembers the last selected tool ID even after
  // the library deselects it. This prevents the "double-click to delete" bug
  // caused by the 50ms polling interval clearing the React state before the
  // click event fires.
  const lastSelectedIdRef = useRef<string | null>(null);
  const colorIndexRef = useRef(0);
  const selectionNullStreakRef = useRef(0);
  const emittedSelectedIdRef = useRef<string | null>(null);

  const setActiveToolSync = useCallback((tool: DrawingToolId) => {
    activeToolRef.current = tool;
    setActiveTool(tool);
  }, []);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  const getNextColor = useCallback(() => {
    const color = COLOR_PALETTE[colorIndexRef.current % COLOR_PALETTE.length];
    colorIndexRef.current++;
    return color;
  }, []);

  const readToolColor = useCallback((tool: any): string | null => {
    if (!tool) return null;

    if (typeof tool._userLineColor === 'string') {
      return tool._userLineColor;
    }

    const candidates: any[] = [
      tool.options,
      tool._options,
      tool._private__lineOptions,
      tool._private__trendLineOptions,
      tool._private__horizontalLineOptions,
      tool._private__verticalLineOptions,
    ];

    for (const obj of candidates) {
      if (!obj || typeof obj !== 'object') continue;
      const color = obj.lineColor || obj.color;
      if (typeof color === 'string' && color.startsWith('#')) return color;
    }

    return null;
  }, []);

  const managerRef = useRef<DrawingToolsManager | null>(null);
  const hLineManagerRef = useRef<any>(null);  // Ref for fib_ext 3-click workflow
  const fibExtPointsRef = useRef<{ time: any; price: number }[]>([]);
  const fibExtToolIdRef = useRef<string | null>(null);

  // Ref for ruler 3-click workflow
  const rulerPointsRef = useRef<{ time: any; price: number }[]>([]);
  const rulerToolIdRef = useRef<string | null>(null);

  // Ref for zoom 2-click workflow
  const zoomPointsRef = useRef<{ time: any; price: number; logical: number }[]>([]);
  const zoomToolIdRef = useRef<string | null>(null);

  const { pushSnapshot, undo, redo, canUndo, canRedo } = useDrawingHistory();
  const { magnetMode, lockMode, hiddenLayers } = useDrawingSettings();

  // Initialize managers
  useEffect(() => {
    if (!chart || !series) return;

    try {
      managerRef.current = new DrawingToolsManager(chart, series, {
        enableKeyboardShortcuts: false,
        selectionColor: '#2962FF',
        selectionLineWidth: 2,
      });
    } catch (e) {
      console.warn('DrawingToolsManager init failed:', e);
    }

    try {
      hLineManagerRef.current = createInteractiveLineManager(chart, series);
    } catch (e) {
      console.warn('InteractiveLineManager init failed:', e);
    }

    return () => {
      try { managerRef.current?.destroy(); } catch (_) {}
      managerRef.current = null;
      hLineManagerRef.current = null;
    };
  }, [chart, series]);

  // Handle Magnet, Lock, and Visibility
  useEffect(() => {
    if (!managerRef.current) return;
    try {
      if (typeof (managerRef.current as any).setMagnet === 'function') {
        (managerRef.current as any).setMagnet(magnetMode);
      }
      if (typeof (managerRef.current as any).setLocked === 'function') {
        (managerRef.current as any).setLocked(lockMode);
      }
      const tools = managerRef.current.getAllTools(); // Get tools here for fallback
      if (typeof (managerRef.current as any).setVisible === 'function') {
        (managerRef.current as any).setVisible(!hiddenLayers.drawings);
      } else {
        // Fallback for tools individually if manager doesn't support global visibility
        tools.forEach((tool: any) => {
          if (typeof (tool as any).applyOptions === 'function') {
            (tool as any).applyOptions({ visible: !hiddenLayers.drawings });
          }
        });
      }
    } catch (e) {
      console.warn('Failed to update manager settings:', e);
    }
  }, [magnetMode, lockMode, hiddenLayers]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  // Load snapshot when chart and series are ready
  const rafRef = useRef<number | null>(null);

  const handleMouseMoveThrottled = useCallback((_e: MouseEvent) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
      if (!managerRef.current) return;
      // Throttling logic here
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMoveThrottled);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (container) {
        container.removeEventListener('mousemove', handleMouseMoveThrottled);
      }
    };
  }, [handleMouseMoveThrottled]);

  const snapshotCurrentState = useCallback(() => {
    if (!managerRef.current) return;
    const tools = managerRef.current.getAllTools();
    const ids = Array.from(tools.keys()) as string[];
    pushSnapshot(ids);
  }, [pushSnapshot]);

  const selectTool = useCallback((toolId: DrawingToolId) => {
    // First, stop any ongoing drawing
    try { managerRef.current?.stopDrawing(); } catch (_) {}
    try { hLineManagerRef.current?.disableClickToCreate(); } catch (_) {}

    if (!toolId || toolId === 'cursor') {
      setActiveToolSync(null);
      return;
    }

    setActiveToolSync(toolId);

    // Eraser mode handled by effect below
    if (toolId === 'eraser') {
      managerRef.current?.stopDrawing();
      setActiveToolSync('eraser');
      return;
    }

    // Handle special cursor/pointer tools
    if (['cursor', 'dot', 'arrow_cursor'].includes(toolId as string)) {
      managerRef.current?.stopDrawing();
      return;
    }

    if (toolId === 'hline' || toolId === 'hray') {
      // These are handled via the click-to-create listener effect
      return;
    }

    // Manual tool creation via DrawingContext
    if (!chart || !series) return;
    const ctx = { chart, series };
    
    try {
      let tool: any = null;
      const color = getNextColor();
      
      if (toolId === 'ray' || toolId === 'extended' || toolId === 'trendline') {
        tool = createTrendLineTool(ctx, { 
          interactive: true, color, lineColor: color, lineWidth: 2, 
          extendRight: toolId === 'ray' || toolId === 'extended',
          extendLeft: toolId === 'extended',
          textColor: '#2962FF', textOrientation: 'parallel', textPosition: 'top',
        });
      }
      else if (toolId === 'fibonacci') {
        tool = createFibonacciTool(ctx, { 
          interactive: true, lineColor: '#787b86', lineWidth: 1, showLabels: true, labelPosition: 'right',
          levelColors: {
            '0': '#787b86', '0.236': '#f23645', '0.382': '#ff9800',
            '0.5': '#4caf50', '0.618': '#089981', '0.786': '#00bcd4', '1': '#787b86',
          },
        });
      }
      else if (toolId === 'fib_ext') {
        // Fib Extension is handled entirely via the click handler effect
        console.log('[DrawingTools] Hand-off to 3-click handler for fib_ext.');
        return;
      }
      else if (toolId === 'rectangle') {
        tool = createRectangleTool(ctx, { interactive: true, color, fillColor: color + '33' });
      }
      if (toolId === 'long_pos' || toolId === 'short_pos') {
        // Position tools are handled via the click-to-create listener effect
        return;
      }

      if (toolId === 'circle') {
        tool = createCircleTool(ctx, { interactive: true, color, lineWidth: 2, fillColor: color + '1A' });
      }
      else if (toolId === 'arrow') {
        tool = createArrowTool(ctx, { interactive: true, color, lineWidth: 2, showArrowHead: true });
      }
      else if (toolId === 'brush') {
        tool = createBrushTool(ctx, { interactive: true, color, lineWidth: 3 });
      }

      if (tool && managerRef.current) {
        (tool as any)._userLineColor = color;
        const id = managerRef.current.addTool(tool);
        if (id) managerRef.current.selectTool(id);
        snapshotCurrentState();
      }
    } catch (e) {
      console.error(`[DrawingTools] Failed to create ${toolId} tool:`, e);
    }
  }, [chart, series, getNextColor, setActiveToolSync, snapshotCurrentState]);

  const disableDrawingMode = useCallback(() => {
    try { managerRef.current?.stopDrawing(); } catch (_) {}
    try { hLineManagerRef.current?.disableClickToCreate(); } catch (_) {}
    setActiveToolSync(null);
  }, [setActiveToolSync]);

  const clearAllDrawings = useCallback(() => {
    managerRef.current?.clearAll();
    setActiveToolSync(null);
    setSelectedToolId(null);
    lastSelectedIdRef.current = null;
    selectionNullStreakRef.current = 0;
    emittedSelectedIdRef.current = null;
  }, [setActiveToolSync]);

  const deleteSelected = useCallback(() => {
    if (!managerRef.current) return false;

    const getToolById = (toolId: string) => {
      const allTools: any = managerRef.current?.getAllTools();
      if (!allTools) return null;
      if (allTools instanceof Map) return allTools.get(toolId) ?? null;
      if (Array.isArray(allTools)) return allTools.find((t: any) => t?.id === toolId) ?? null;
      if (typeof allTools === 'object') return (allTools as Record<string, any>)[toolId] ?? null;
      return null;
    };

    const idsToTry = Array.from(
      new Set(
        [managerRef.current.getSelectedToolId(), selectedToolId, lastSelectedIdRef.current].filter(Boolean) as string[]
      )
    );

    let removed = false;
    for (const toolId of idsToTry) {
      try {
        const tool = getToolById(toolId);
        if (tool && typeof (tool as any).remove === 'function') {
          (tool as any).remove();
        }
      } catch (e) {
        console.warn(`[DrawingTools] Primitive remove failed for ${toolId}:`, e);
      }

      try {
        managerRef.current.removeTool(toolId);
      } catch (e) {
        console.warn(`[DrawingTools] removeTool failed for ${toolId}:`, e);
      }

      if (!getToolById(toolId)) {
        removed = true;
        break;
      }
    }

    if (!removed) {
      try {
        removed = !!(managerRef.current.deleteSelected?.() ?? false);
      } catch (_) {
        removed = false;
      }
    }

    if (removed) {
      setSelectedToolId(null);
      lastSelectedIdRef.current = null;
      selectionNullStreakRef.current = 0;
      emittedSelectedIdRef.current = null;
      snapshotCurrentState();
    }

    return removed;
  }, [selectedToolId, snapshotCurrentState]);

  const handleUndo = useCallback(() => {
    const snapshot = undo();
    if (!snapshot || !managerRef.current) return;
    // Remove tools not in the snapshot
    const currentTools = managerRef.current.getAllTools();
    currentTools.forEach((_: any, id: string) => {
      if (!snapshot.includes(id)) {
        managerRef.current?.removeTool(id);
      }
    });
  }, [undo]);

  const handleRedo = useCallback(() => {
    const snapshot = redo();
    if (!snapshot) return;
    // Redo is limited — we can't re-create tools from IDs alone.
    // For now, redo just logs. Full serialization would require tool-state persistence.
  }, [redo]);

  // Custom interactive click placement for horizontal line, cross, fib extension, and position tools
  useEffect(() => {
    if (!chart || !series || !['hline', 'hray', 'vline', 'cross', 'fib_ext', 'long_pos', 'short_pos', 'ruler', 'zoom_in'].includes(activeTool as string)) {
      // Reset fib ext points when switching away
      fibExtPointsRef.current = [];
      rulerPointsRef.current = [];
      rulerToolIdRef.current = null;
      
      // Clean up zombie zoom boxes if they exist
      if (zoomToolIdRef.current && managerRef.current) {
        managerRef.current.removeTool(zoomToolIdRef.current);
      }
      zoomPointsRef.current = [];
      zoomToolIdRef.current = null;
      return;
    }

    const clickHandler = (param: any) => {
      if (!param || !param.point) return;
      const currentActiveTool = activeToolRef.current;
      if (!currentActiveTool) return;
      
      const price = series.coordinateToPrice(param.point.y);
      let time = param.time || (chart.timeScale().coordinateToTime(param.point.x) as any);

      if (time === null) {
        const logical = chart.timeScale().coordinateToLogical(param.point.x);
        if (logical !== null) {
          time = { _internal_logical: logical };
        }
      }

      if (price === null || time === null) return;
      if (!managerRef.current) return;

      if (currentActiveTool === 'hray') {
        const color = getNextColor();
        const tool = createHorizontalLineTool({ chart, series } as any, {
           price, time, interactive: true, color, lineColor: color, lineWidth: 2, lineStyle: 0,
           extendLeft: false, extendRight: true
        });
        (tool as any)._userLineColor = color;
        const id = managerRef.current.addTool(tool);
        managerRef.current.selectTool(id);
        snapshotCurrentState();
        selectTool(null);
      }
      else if (currentActiveTool === 'vline') {
        const color = getNextColor();
        const tool = createVerticalLineTool({ chart, series } as any, {
           time, interactive: true, color, lineColor: color, lineWidth: 2, lineStyle: 0
        });
        (tool as any)._userLineColor = color;
        const id = managerRef.current.addTool(tool);
        managerRef.current.selectTool(id);
        snapshotCurrentState();
        selectTool(null);
      }
      else if (currentActiveTool === 'hline') {
        const color = getNextColor();
        const tool = createHorizontalLineTool({ chart, series } as any, {
           price, interactive: true, color, lineColor: color, lineWidth: 2, lineStyle: 0,
           extendLeft: true, extendRight: true
        });
        (tool as any)._userLineColor = color;
        const id = managerRef.current.addTool(tool);
        managerRef.current.selectTool(id);
        snapshotCurrentState();
        selectTool(null);
      }
      else if (currentActiveTool === 'cross') {
        const color = getNextColor();
        const hTool = createHorizontalLineTool({ chart, series } as any, {
           price, interactive: true, color, lineColor: color, lineWidth: 2, lineStyle: 0
        });
        const vTool = createVerticalLineTool({ chart, series } as any, {
           time, interactive: true, color, lineColor: color, lineWidth: 2, lineStyle: 0
        });
        (hTool as any)._userLineColor = color;
        (vTool as any)._userLineColor = color;

        const hId = managerRef.current.addTool(hTool);
        managerRef.current.addTool(vTool);
        managerRef.current.selectTool(hId);
        snapshotCurrentState();
        selectTool(null);
      }
      else if (currentActiveTool === 'long_pos' || currentActiveTool === 'short_pos') {
        const isLong = currentActiveTool === 'long_pos';
        
        // Calculate dynamic offsets based on visible price range to ensure both ends are visible
        const priceScale = series.priceScale();
        const visibleRange = (priceScale as any).getVisibleRange ? (priceScale as any).getVisibleRange() : null;
        let tpPrice = price * (isLong ? 1.02 : 0.98);
        let slPrice = price * (isLong ? 0.99 : 1.01);

        if (visibleRange) {
          const visibleHeight = Math.abs(visibleRange.to - visibleRange.from);
          const initialOffset = visibleHeight * 0.15; // 15% of visible screen height
          tpPrice = isLong ? price + initialOffset : price - initialOffset;
          slPrice = isLong ? price - (initialOffset / 2) : price + (initialOffset / 2);
        }

        // Calculate a reasonable initial width (e.g., 150 pixels ahead)
        const timeScale = chart.timeScale();
        const entryCoord = timeScale.timeToCoordinate(time);
        const endCoord = (entryCoord ?? 0) + 150;
        const endTime = timeScale.coordinateToTime(endCoord) || time;

        const tool = createPositionTool({ chart, series } as any, {
          interactive: true,
          entryPrice: price,
          entryTime: time,
          endTime: endTime,
          takeProfit: tpPrice,
          stopLoss: slPrice,
          profitColor: '#089981',
          lossColor: '#f23645',
          opacity: 0.2,
          quantity: 1,
        });

        const id = managerRef.current.addTool(tool);
        managerRef.current.selectTool(id);
        snapshotCurrentState();
        selectTool(null);
      }
      else if (currentActiveTool === 'ruler') {
        const point = { time, price: price as number };
        rulerPointsRef.current.push(point);
        const count = rulerPointsRef.current.length;

        if (count === 1) {
          // 1st click: Create tool
          const tool = createRulerTool({ chart, series } as any, {
            interactive: false,
            point1Time: time,
            point1Price: price,
            point2Time: time,
            point2Price: price,
            lineColor: '#2962FF',
            showLabel: false,
          });
          const id = managerRef.current.addTool(tool);
          rulerToolIdRef.current = id;
          managerRef.current.selectTool(id);
        }
        else if (count === 2) {
          // 2nd click: Lock (done via point 2)
          const toolId = rulerToolIdRef.current;
          if (toolId) {
            const tool = managerRef.current.getAllTools().get(toolId);
            if (tool) {
              if (typeof (tool as any).updatePoints === 'function') {
                const p1 = rulerPointsRef.current[0];
                (tool as any).updatePoints(p1.time, p1.price, point.time, point.price);
              } else if (typeof (tool as any).applyOptions === 'function') {
                (tool as any).applyOptions({ point2Time: point.time, point2Price: point.price });
              }
              (tool as any)._custom_preview = undefined;
              
              if (typeof (tool as any)._requestUpdate === 'function') (tool as any)._requestUpdate();
              if (typeof (tool as any)._private__requestUpdate === 'function') (tool as any)._private__requestUpdate();
            }
          }
        }
        else if (count === 3) {
          // 3rd click: Destroy tool entirely and exit ruler mode
          if (rulerToolIdRef.current) {
            managerRef.current.removeTool(rulerToolIdRef.current);
          }
          rulerPointsRef.current = [];
          rulerToolIdRef.current = null;
          selectTool(null);
        }
      }
      // zoom_in is now handled as an immediate command in useEffect below
      // (no chart click needed)
      // --- Fib Extension: 3-click interactive (Progressive version) ---
      else if (currentActiveTool === 'fib_ext') {
        const point = { time, price: price as number };
        fibExtPointsRef.current.push(point);
        const count = fibExtPointsRef.current.length;
        console.info(`%c[FibExt] Click #${count} registered at price ${point.price}`, 'color: #2962FF; font-weight: bold;');

        try {
          if (count === 1) {
            // 1st click: Create tool immediately with all points at start
            console.log('[FibExt] Creating tool on first click...');
            const tool = createFibonacciExtensionTool({ chart, series }, {
              lineColor: '#787b86',
              lineWidth: 1,
              showLabels: true,
              extendLines: true,
              point1: point,
              point2: point,
              point3: point,
              levels: [
                { level: 0, color: '#787b86', label: '0%' },
                { level: 0.236, color: '#f23645', label: '23.6%' },
                { level: 0.382, color: '#ff9800', label: '38.2%' },
                { level: 0.5, color: '#4caf50', label: '50.0%' },
                { level: 0.618, color: '#089981', label: '61.8%' },
                { level: 0.786, color: '#00bcd4', label: '78.6%' },
                { level: 1.0, color: '#787b86', label: '100%' },
                { level: 1.618, color: '#f23645', label: '161.8%' },
                { level: 2.618, color: '#9c27b0', label: '261.8%' },
              ],
            });

            if (managerRef.current) {
              const id = managerRef.current.addTool(tool);
              fibExtToolIdRef.current = id;
              managerRef.current.selectTool(id); // Select immediately to show anchors
              console.log('[FibExt] Tool successfully added and selected:', id);
            }
          } 
          else if (count === 2) {
            // 2nd click: Update point 2 and 3
            const toolId = fibExtToolIdRef.current;
            if (toolId && managerRef.current) {
              const tool = managerRef.current.getAllTools().get(toolId);
              if (tool) {
                tool.setPoint2(point);
                tool.setPoint3(point);
                console.log('[FibExt] Updated swing high (point 2).');
              }
            }
          } 
          else if (count === 3) {
            // 3rd click: Final point
            const toolId = fibExtToolIdRef.current;
            if (toolId && managerRef.current) {
              const tool = managerRef.current.getAllTools().get(toolId);
              if (tool) {
                tool.setPoint3(point);
                console.log('[FibExt] Updated retracement/extension base (point 3). Done.');
                managerRef.current.selectTool(toolId);
              }
            }

            // Complete and cleanup
            fibExtPointsRef.current = [];
            fibExtToolIdRef.current = null;
            snapshotCurrentState();
            selectTool(null);
          }
        } catch (err) {
          console.error('[FibExt] Error during interaction:', err);
          fibExtPointsRef.current = [];
          fibExtToolIdRef.current = null;
          selectTool(null);
        }
      }
    };
      
    chart.subscribeClick(clickHandler);
    return () => {
      chart.unsubscribeClick(clickHandler);
    };
  }, [chart, series, activeTool, getNextColor, snapshotCurrentState, selectTool]);

  // Fast sync of selection after pointer interactions, so one-click delete is reliable.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncSelectionSoon = () => {
      requestAnimationFrame(() => {
        const id = managerRef.current?.getSelectedToolId() ?? null;
        if (id) {
          lastSelectedIdRef.current = id;
          selectionNullStreakRef.current = 0;
          emittedSelectedIdRef.current = id;
          setSelectedToolId(id);
        }
      });
    };

    container.addEventListener('mouseup', syncSelectionSoon);
    container.addEventListener('click', syncSelectionSoon);

    return () => {
      container.removeEventListener('mouseup', syncSelectionSoon);
      container.removeEventListener('click', syncSelectionSoon);
    };
  }, [containerRef]);

  // Mouse-move preview for Fib Extension and Ruler
  useEffect(() => {
    if (!chart || !series || !['fib_ext', 'ruler', 'zoom_in'].includes(activeTool as string)) return;

    const moveHandler = (param: any) => {
      if (!param || !param.point) return;
      
      const price = series.coordinateToPrice(param.point.y);
      let time = param.time || (chart.timeScale().coordinateToTime(param.point.x) as any);
      
      if (time === null) {
        // Fallback to logical index for future space (empty space on the right)
        const logical = chart.timeScale().coordinateToLogical(param.point.x);
        if (logical !== null) {
          time = { _internal_logical: logical };
        }
      }

      if (price === null || time === null) return;
      if (!managerRef.current) return;

      if (activeTool === 'fib_ext' && fibExtToolIdRef.current) {
        const tool = managerRef.current.getAllTools().get(fibExtToolIdRef.current);
        if (tool) {
          const count = fibExtPointsRef.current.length;
          const point = { time, price };
          if (count === 1) {
            tool.setPoint2(point);
            tool.setPoint3(point);
          } else if (count === 2) {
            tool.setPoint3(point);
          }
        }
      } else if (activeTool === 'ruler' && rulerToolIdRef.current) {
        const tool = managerRef.current.getAllTools().get(rulerToolIdRef.current);
        if (tool && rulerPointsRef.current.length === 1) {
          const p1 = rulerPointsRef.current[0];
          if (typeof (tool as any).updatePoints === 'function') {
            (tool as any).updatePoints(p1.time, p1.price, time, price);
          }
          const logical = chart.timeScale().coordinateToLogical(param.point.x);
          (tool as any)._custom_preview = { 
            time: param.time || param.point.x, // fallback structure 
            price: price, 
            _internal_price: price, 
            _custom_logical: logical !== null ? logical : undefined
          };
          if (typeof (tool as any)._requestUpdate === 'function') (tool as any)._requestUpdate();
          if (typeof (tool as any)._private__requestUpdate === 'function') (tool as any)._private__requestUpdate();
        }
      } else if (activeTool === 'zoom_in' && zoomToolIdRef.current) {
        const tool = managerRef.current.getAllTools().get(zoomToolIdRef.current);
        if (tool && zoomPointsRef.current.length === 1) {
            const p1 = zoomPointsRef.current[0];
            // Update temporary rectangle preview
            if (typeof (tool as any).updatePoints === 'function') {
               (tool as any).updatePoints(p1.time, p1.price, time, price);
            } else {
               (tool as any).options.point2Time = time;
               (tool as any).options.point2Price = price;
               if (typeof (tool as any)._private__requestUpdate === 'function') {
                 (tool as any)._private__requestUpdate();
               }
            }
        }
      }
    };

    chart.subscribeCrosshairMove(moveHandler);
    return () => {
      chart.unsubscribeCrosshairMove(moveHandler);
    };
  }, [chart, series, activeTool]);

  // Special Eraser logic: auto-delete selected objects when in Eraser mode
  useEffect(() => {
    if (activeTool !== 'eraser' || !selectedToolId || !managerRef.current) return;
    
    console.log('[Eraser] Deleting selected object:', selectedToolId);
    managerRef.current.removeTool(selectedToolId);
    setSelectedToolId(null);
    snapshotCurrentState();
    
    // Brief haptic-like feedback via console (or we could flash the screen/etc)
  }, [activeTool, selectedToolId, snapshotCurrentState]);

  // Poll for selection changes and patch hover
  useEffect(() => {
    if (!managerRef.current) return;
    const interval = setInterval(() => {
	    if (!managerRef.current) return;
      const id = managerRef.current.getSelectedToolId() ?? null;
      if (id) {
        selectionNullStreakRef.current = 0;
        lastSelectedIdRef.current = id;
        if (emittedSelectedIdRef.current !== id) {
          emittedSelectedIdRef.current = id;
          setSelectedToolId(id);
        }
      } else {
        const tools = managerRef.current?.getAllTools();
        const hasAnyTools = tools instanceof Map
          ? tools.size > 0
          : Array.isArray(tools)
            ? tools.length > 0
            : !!tools && Object.keys(tools as any).length > 0;

        if (hasAnyTools) {
          selectionNullStreakRef.current += 1;
          if (selectionNullStreakRef.current < 3) {
            return;
          }
        } else {
          selectionNullStreakRef.current = 0;
        }

        if (emittedSelectedIdRef.current !== null) {
          emittedSelectedIdRef.current = null;
          setSelectedToolId(null);
        }
      }

      // Patch tools to be resilient against @pipsend/charts internal bugs
      const tools = managerRef.current?.getAllTools();
      if (tools) {
          const toolsList = tools instanceof Map ? Array.from(tools.values()) : Array.isArray(tools) ? tools : [];
          toolsList.forEach((tool: any) => {
            if (!tool) return;

          // 1. Patch hover to avoid the default black line styling
          if (typeof tool.setHovered === 'function' && !tool._hoverPatched) {
            tool.setHovered = function() { /* do nothing */ };
            tool._hoverPatched = true;

            // DYNAMIC TOOL CUSTOMIZATION based on actively selected tool
            // When tool is first created by DrawingToolsManager, it lacks our custom options
            if (activeTool) {
               if (activeTool === 'ray') tool.applyOptions({ extendRight: true });
               else if (activeTool === 'extended') tool.applyOptions({ extendLeft: true, extendRight: true });
               // For position, there is no short_pos option natively, but we can fake it later or use a different library later
            }
          }

          // 2. Patch _update and applyOptions to prevent the updatePrimitive crash
          if (!tool._updatePatched) {
             const origUpdate = tool._update;
             if (typeof origUpdate === 'function') {
                tool._update = function(...args: any[]) {
                   try { return origUpdate.apply(this, args); } catch (e) {
                      // If it crashes, fall back to the safe update trigger
                      if (typeof (this as any)._private__requestUpdate === 'function') {
                        (this as any)._private__requestUpdate();
                      }
                   }
                };
             }
             tool._updatePatched = true; // This flag covers both _update and the original applyOptions patch
          }
          
          // Separate patch for applyOptions to handle color mapping and crash resilience
          if (!tool._applyOptionsPatched) {
             const origApply = tool.applyOptions;
             if (typeof origApply === 'function') {
                tool.applyOptions = function(options: any) {
                   const opts = options && typeof options === 'object' ? { ...options } : {};
                   const incomingColor = (opts.lineColor || opts.color) as string | undefined;
                   const normalizedIncoming = typeof incomingColor === 'string' ? incomingColor.toLowerCase() : '';
                   const isSelectionColor = normalizedIncoming ? SELECTION_COLORS.has(normalizedIncoming) : false;
                   const allowColorMutation = !!(this as any)._allowNextColorMutation;

                   if (options && options.selectionColor) {
                      delete opts.selectionColor; // Prevent library override
                   }
                   // Ensure lines and points both get the color
                   if (opts && opts.color && opts.lineColor === undefined) {
                      opts.lineColor = opts.color;
                   }
                   if (opts && opts.lineColor && opts.color === undefined) {
                      opts.color = opts.lineColor;
                   }

                   // Prevent selection/highlight colors from mutating the actual drawing color.
                   if (isSelectionColor && !allowColorMutation) {
                      delete opts.color;
                      delete opts.lineColor;
                   }

                   if (allowColorMutation && incomingColor) {
                      (this as any)._userLineColor = incomingColor;
                   } else if (!(this as any)._userLineColor) {
                      const existing = readToolColor(this);
                      if (existing) (this as any)._userLineColor = existing;
                   }
                   (this as any)._allowNextColorMutation = false;
                   
                   try { return origApply.call(this, opts); } catch (e) {
                      // fallback manually update properties if it crashes
                      if (opts.color) (this as any)._color = opts.color;
                      if (opts.lineColor) (this as any)._lineColor = opts.lineColor;
                      if (opts.lineWidth) (this as any)._lineWidth = opts.lineWidth;
                      if (opts.lineStyle) (this as any)._lineStyle = opts.lineStyle;
                      
                      // Also update any inner options objects
                      if ((this as any).options) {
                         if (opts.color) (this as any).options.color = opts.color;
                         if (opts.lineColor) (this as any).options.lineColor = opts.lineColor;
                         if (opts.lineWidth) (this as any).options.lineWidth = opts.lineWidth;
                         if (opts.lineStyle) (this as any).options.lineStyle = opts.lineStyle;
                      }
                      
                      if (typeof (this as any)._private__requestUpdate === 'function') {
                        (this as any)._private__requestUpdate();
                      }
                   }
                };
                tool._applyOptionsPatched = true;
             }
          }

          // 3. Patch drawToCanvas to prevent orange selection override AND add Fibonacci fills
          if (typeof tool.drawToCanvas === 'function' && !tool._drawPatched) {
            const originalDraw = tool.drawToCanvas;
            
            // Define Fibonacci fill zone colors (keyed by lower ratio boundary)
            const fibFillColors: Record<string, string> = {
              '0': '#f2364540',      // Red zone (0 → 0.236)
              '0.236': '#ff980035',  // Orange zone (0.236 → 0.382)
              '0.382': '#4caf5030',  // Green zone (0.382 → 0.5)
              '0.5': '#08998130',    // Teal zone (0.5 → 0.618)
              '0.618': '#00bcd435',  // Cyan zone (0.618 → 0.786)
              '0.786': '#787b8620',  // Grey zone (0.786 → 1)
              '1': '#2962ff30',      // Blue zone (1 → 1.618)
              '1.618': '#9c27b025',  // Purple zone (1.618 → 2.618)
            };

            tool.drawToCanvas = function(ctx: CanvasRenderingContext2D, hRatio: number, vRatio: number) {
              const chartApi = chart;
              const seriesApi = series;
              const toolType = (this as any).type;
              const toNumber = (v: any, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
              const ratioToColor = (ratioInput: any): string => {
                const ratio = Math.abs(toNumber(ratioInput, 0));
                if (ratio < 0.236) return '#f23645';
                if (ratio < 0.382) return '#ff9800';
                if (ratio < 0.5) return '#8bc34a';
                if (ratio < 0.618) return '#089981';
                if (ratio < 0.786) return '#00bcd4';
                if (ratio < 1) return '#90a4ae';
                if (ratio < 1.618) return '#2962ff';
                if (ratio < 2.618) return '#9c27b0';
                return '#f23645';
              };
              const applyBandFill = (xStart: number, xEnd: number, yA: number, yB: number, ratioInput: any) => {
                const base = ratioToColor(ratioInput);
                const top = `${base}44`;
                const bottom = `${base}22`;
                const yTop = Math.min(yA, yB);
                const yBottom = Math.max(yA, yB);
                const w = Math.max(0, xEnd - xStart);
                const h = Math.max(0, yBottom - yTop);
                if (w <= 0 || h <= 0) return;
                const grad = ctx.createLinearGradient(0, yTop, 0, yBottom);
                grad.addColorStop(0, top);
                grad.addColorStop(1, bottom);
                ctx.fillStyle = grad;
                ctx.fillRect(xStart, yTop, w, h);
              };

              // --- Fibonacci Fill Zones (use public API; avoid private internals) ---
              if (
                (
                  toolType === 'fibonacci' ||
                  toolType === 'fib' ||
                  toolType === 'fibonacci-tool' ||
                  (typeof (this as any).getLevels === 'function' && typeof (this as any).getMetrics === 'function')
                ) &&
                chartApi &&
                seriesApi &&
                typeof (this as any).getMetrics === 'function'
              ) {
                const metrics = (this as any).getMetrics();
                if (metrics?.point1?.time !== undefined && metrics?.point2?.time !== undefined && Array.isArray(metrics?.levels)) {
                  const timeScale = chartApi.timeScale();
                  const x1 = toNumber(timeScale.timeToCoordinate(metrics.point1.time), 0) * hRatio;
                  const x2 = toNumber(timeScale.timeToCoordinate(metrics.point2.time), 0) * hRatio;
                  const xMin = Math.min(x1, x2);
                  const xMax = Math.max(x1, x2);
                  const sortedLevels = [...metrics.levels].sort((a: any, b: any) => toNumber(a.price) - toNumber(b.price));

                  for (let i = 0; i < sortedLevels.length - 1; i++) {
                    const lower = sortedLevels[i];
                    const upper = sortedLevels[i + 1];
                    const y1 = toNumber(seriesApi.priceToCoordinate(lower.price), 0) * vRatio;
                    const y2 = toNumber(seriesApi.priceToCoordinate(upper.price), 0) * vRatio;
                    const ratioKey = (lower.ratio ?? '').toString();
                    applyBandFill(xMin, xMax, y1, y2, lower.ratio);

                    // fallback flat fill path in case gradient is unsupported in specific browsers
                    if (!ctx.fillStyle) {
                      const fillColor = fibFillColors[ratioKey] || 'rgba(255,255,255,0.08)';
                      ctx.fillStyle = fillColor;
                      ctx.fillRect(xMin, Math.min(y1, y2), Math.max(0, xMax - xMin), Math.abs(y2 - y1));
                    }
                  }
                }
              }

              // --- Fibonacci Extension Fill Zones (public methods) ---
              if (
                (toolType === 'fib_ext' || toolType === 'fibonacci_extension' || toolType === 'fibonacci-extension') &&
                chartApi &&
                seriesApi &&
                typeof (this as any).getExtensionLevels === 'function'
              ) {
                const extLevels = (this as any).getExtensionLevels();
                if (Array.isArray(extLevels) && extLevels.length > 1) {
                  const chartWidth = chartApi.chartElement().clientWidth * hRatio;
                  const sorted = [...extLevels].sort((a: any, b: any) => toNumber(a.price) - toNumber(b.price));
                  for (let i = 0; i < sorted.length - 1; i++) {
                    const lower = sorted[i];
                    const upper = sorted[i + 1];
                    const y1 = toNumber(seriesApi.priceToCoordinate(lower.price), 0) * vRatio;
                    const y2 = toNumber(seriesApi.priceToCoordinate(upper.price), 0) * vRatio;
                    applyBandFill(0, chartWidth, y1, y2, lower.level);
                  }
                }
              }

              // --- Position Tool Visuals (Long/Short) ---
              const posOptions = (this as any)._private__positionOptions;
              const posMetrics = (this as any)._private__metrics;
              if (posOptions && posOptions.entryPrice && posMetrics) {
                const timeScale = (this as any)._chart.timeScale();
                const series = (this as any)._series;
                const entryX = (timeScale.timeToCoordinate(posOptions.entryTime) ?? 0) * hRatio;
                const entryY = (series.priceToCoordinate(posOptions.entryPrice) ?? 0) * vRatio;
                const chartWidth = (this as any)._chart.chartElement().clientWidth * hRatio;
                const endX = posOptions.endTime ? (timeScale.timeToCoordinate(posOptions.endTime) ?? 0) * hRatio : chartWidth;
                const midX = (entryX + endX) / 2;

                const drawPillLabel = (text: string, x: number, y: number, color: string) => {
                  ctx.save();
                  ctx.font = `bold ${10 * hRatio}px Inter, -apple-system, sans-serif`;
                  const metrics = ctx.measureText(text);
                  const pX = 6 * hRatio;
                  const pY = 3 * vRatio;
                  const w = metrics.width + pX * 2;
                  const h = (12 * hRatio) + pY * 2; // Dynamic height based on font and padding
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  const r = 4 * hRatio;
                  ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
                  ctx.fill();
                  ctx.fillStyle = '#ffffff';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(text, x, y);
                  ctx.restore();
                };

                if (posOptions.takeProfit) {
                  const targetY = (series.priceToCoordinate(posOptions.takeProfit) ?? 0) * vRatio;
                  const label = `Target: ${posOptions.takeProfit.toFixed(1)} (${posMetrics.takeProfitPercent.toFixed(2)}%) ${posMetrics.takeProfitPips.toFixed(0)}`;
                  drawPillLabel(label, midX, targetY, '#089981');
                }
                if (posOptions.stopLoss) {
                  const stopY = (series.priceToCoordinate(posOptions.stopLoss) ?? 0) * vRatio;
                  const label = `Stop: ${posOptions.stopLoss.toFixed(1)} (${Math.abs(posMetrics.stopLossPercent).toFixed(2)}%) ${posMetrics.stopLossPips.toFixed(0)}`;
                  drawPillLabel(label, midX, stopY, '#f23645');
                }
                drawPillLabel(`R:R Ratio: ${posMetrics.riskRewardRatio.toFixed(2)}`, midX, entryY, '#1e222d');
              }

              // --- Ruler Tool Visuals ---
              if ((toolType === 'ruler' || toolType === 'ruler-tool') && chartApi && seriesApi && typeof (this as any).getMetrics === 'function') {
                const timeScale = chartApi.timeScale();
                const metrics = (this as any).getMetrics?.();
                const point1 = metrics?.point1;
                if (!point1 || point1.time === undefined || point1.price === undefined) {
                  originalDraw.call(this, ctx, hRatio, vRatio);
                  return;
                }

                let point1X = null;
                let logical1 = null;
                const targetTime1 = point1.time;
                
                if (targetTime1 && typeof targetTime1 === 'object' && '_internal_logical' in targetTime1) {
                  logical1 = (targetTime1 as any)._internal_logical;
                  point1X = timeScale.logicalToCoordinate(logical1);
                } else if (targetTime1 || targetTime1 === 0) {
                  try {
                    point1X = timeScale.timeToCoordinate(targetTime1);
                    logical1 = timeScale.coordinateToLogical(point1X || 0); // reverse lookup
                  } catch (e) {
                    point1X = null;
                  }
                }
                
                const x1 = (point1X ?? 0) * hRatio;
                const y1 = (seriesApi.priceToCoordinate(point1.price) ?? 0) * vRatio;
                
                // Allow our Custom React hook to inject _custom_preview object
                const p2 = (this as any)._custom_preview || (metrics?.point2 ? { time: metrics.point2.time, price: metrics.point2.price } : undefined);
                
                if (p2 && point1X !== null) {
                  let point2X = null;
                  let logical2 = null;
                  const targetTime = p2.time || p2._internal_time;
                  
                  if (targetTime && typeof targetTime === 'object' && '_internal_logical' in targetTime) {
                    logical2 = (targetTime as any)._internal_logical;
                    point2X = timeScale.logicalToCoordinate(logical2);
                  } else if (p2._custom_logical !== undefined) {
                    logical2 = p2._custom_logical;
                    point2X = timeScale.logicalToCoordinate(logical2);
                  } else if (targetTime || targetTime === 0) {
                    try {
                      point2X = timeScale.timeToCoordinate(targetTime);
                      logical2 = timeScale.coordinateToLogical(point2X || 0);
                    } catch (e) {
                      point2X = null;
                    }
                  }
                  
                  const x2 = (point2X ?? 0) * hRatio;
                  const rawP2Price = p2.price !== undefined ? p2.price : (p2._internal_price !== undefined ? p2._internal_price : point1.price);
                  const y2 = (seriesApi.priceToCoordinate(rawP2Price) ?? 0) * vRatio;
                  
                  const isUp = rawP2Price >= point1.price;
                  const solidColor = isUp ? '#2962FF' : '#f23645';
                  const bgColor = isUp ? 'rgba(41, 98, 255, 0.15)' : 'rgba(242, 54, 69, 0.15)';

                  // 1. Draw Rectangle
                  ctx.fillStyle = bgColor;
                  ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
                  
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;

                  // 2. Draw Crosshair inside
                  ctx.strokeStyle = solidColor;
                  ctx.lineWidth = 1 * hRatio;
                  ctx.beginPath();
                  ctx.moveTo(x1, midY);
                  ctx.lineTo(x2, midY);
                  ctx.moveTo(midX, y1);
                  ctx.lineTo(midX, y2);
                  ctx.stroke();

                  // Draw Arrow Heads
                  const drawArrowHead = (tx: number, ty: number, angle: number) => {
                    const size = 6 * hRatio;
                    ctx.beginPath();
                    ctx.moveTo(tx, ty);
                    ctx.lineTo(tx - size * Math.cos(angle - Math.PI / 6), ty - size * Math.sin(angle - Math.PI / 6));
                    ctx.lineTo(tx - size * Math.cos(angle + Math.PI / 6), ty - size * Math.sin(angle + Math.PI / 6));
                    ctx.closePath();
                    ctx.fillStyle = solidColor;
                    ctx.fill();
                  };
                  
                  const angleH = Math.atan2(0, x2 - x1);
                  drawArrowHead(x2, midY, angleH);

                  const angleV = Math.atan2(y2 - y1, 0);
                  drawArrowHead(midX, y2, angleV);

                  // 3. Draw High-Fidelity Label (Calculated Natively)
                  const priceDiffNum = rawP2Price - point1.price;
                  const priceText = `${priceDiffNum.toFixed(2)}`;
                  const safePercent = typeof metrics?.pricePercent === 'number'
                    ? metrics.pricePercent
                    : (point1.price ? (priceDiffNum / point1.price) * 100 : 0);
                  const pctText = `(${safePercent.toFixed(2)}%)`;
                  
                  const pipsVal = typeof metrics?.pips === 'number'
                    ? metrics.pips
                    : Math.abs(priceDiffNum * 10000) * (priceDiffNum >= 0 ? 1 : -1);
                  
                  const line1 = `${priceText} ${pctText} ${pipsVal.toFixed(0)}`;
                  
                  const safeBars = typeof metrics?.barCount === 'number'
                    ? metrics.barCount
                    : ((logical1 !== null && logical2 !== null) ? Math.max(0, Math.abs(Math.round(logical2 - logical1))) : 0);
                  const barsText = `${safeBars} bars`;
                  
                  const text = `${line1}\n${barsText}`;
                  
                  ctx.save();
                  ctx.font = `${12 * hRatio}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;
                  const lines = text.split('\n');
                  let maxWidth = 0;
                  lines.forEach(l => maxWidth = Math.max(maxWidth, ctx.measureText(l).width));
                  
                  const pX = 8 * hRatio;
                  const pY = 6 * vRatio;
                  const lineH = 18 * vRatio;
                  const w = maxWidth + pX * 2;
                  const h = (lines.length * lineH) + pY * 2 - 4 * vRatio;
                  
                  const labelX = midX;
                  const labelY = isUp ? Math.min(y1, y2) - h - 8 * vRatio : Math.max(y1, y2) + 8 * vRatio;

                  ctx.fillStyle = solidColor;
                  ctx.beginPath();
                  const rx = labelX - w / 2;
                  const ry = labelY;
                  const rr = 4 * hRatio;
                  ctx.moveTo(rx + rr, ry);
                  ctx.lineTo(rx + w - rr, ry);
                  ctx.quadraticCurveTo(rx + w, ry, rx + w, ry + rr);
                  ctx.lineTo(rx + w, ry + h - rr);
                  ctx.quadraticCurveTo(rx + w, ry + h, rx + w - rr, ry + h);
                  ctx.lineTo(rx + rr, ry + h);
                  ctx.quadraticCurveTo(rx, ry + h, rx, ry + h - rr);
                  ctx.lineTo(rx, ry + rr);
                  ctx.quadraticCurveTo(rx, ry, rx + rr, ry);
                  ctx.fill();
                  
                  ctx.fillStyle = '#ffffff';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'top';
                  lines.forEach((line, i) => {
                    ctx.fillText(line, labelX, labelY + pY + i * lineH);
                  });
                  ctx.restore();
                }
                
                return;
              }

              // --- Standard orange override fix ---
              const stableColor = (this as any)._userLineColor || readToolColor(this);
              let realColor = stableColor || '#2196F3';

              const proxyCtx = new Proxy(ctx, {
                set(target, prop, value) {
                  if ((prop === 'strokeStyle' || prop === 'fillStyle') && typeof value === 'string' && value.toLowerCase() === '#ff6b00') {
                    return Reflect.set(target, prop, realColor);
                  }
                  return Reflect.set(target, prop, value);
                },
                get(target, prop) {
                  const val = Reflect.get(target, prop);
                  if (typeof val === 'function') return val.bind(target);
                  return val;
                }
              });

              originalDraw.call(this, proxyCtx, hRatio, vRatio);
            };
            tool._drawPatched = true;
          }
        });
      }
    }, 80);
    return () => clearInterval(interval);
  }, [chart, series]);

  // Direct zoom functions — called from toolbar buttons, no state management needed
  const zoomIn = useCallback(() => {
    if (!chart || !series) return;
    const timeScale = chart.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (range) {
      const span = range.to - range.from;
      const shrink = span * 0.1; // 10% from each side = 20% zoom in
      timeScale.setVisibleLogicalRange({
        from: range.from + shrink,
        to: range.to - shrink,
      });
    }
    series.priceScale().applyOptions({ autoScale: true });
  }, [chart, series]);

  const zoomOut = useCallback(() => {
    if (!chart || !series) return;
    const timeScale = chart.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (range) {
      const span = range.to - range.from;
      const expand = span * 0.1; // 10% from each side = 20% zoom out
      timeScale.setVisibleLogicalRange({
        from: range.from - expand,
        to: range.to + expand,
      });
    }
    series.priceScale().applyOptions({ autoScale: true });
  }, [chart, series]);

  const cloneTool = (id: string) => {
    if (!managerRef.current) return;
    try {
      const tools = managerRef.current.getAllTools() as any;
      const tool = tools instanceof Map ? tools.get(id) : (Array.isArray(tools) ? tools.find((t: any) => t.id === id) : null);
      if (tool) {
        // Find internal options
        let options: any = {};
        const allProps = [...Object.keys(tool), ...Object.getOwnPropertyNames(tool)];
        for (const k of allProps) {
          const obj = tool[k];
          if (typeof obj === 'object' && obj !== null && (k.toLowerCase().includes('options') || 'lineColor' in obj)) {
            options = { ...obj };
            break;
          }
        }
        
        // Offset the clone slightly if it's a price-based tool
        if (options.price !== undefined) options.price *= 1.001; 
        
        // Start drawing the same type but with these options
        // Since startDrawing doesn't take options, we might need to apply them after creation
        managerRef.current.startDrawing(tool.type);
        // Note: Full cloning would ideally happen via a dedicated manager method if available
      }
    } catch (e) { console.error('Clone failed:', e); }
  };

  const hideTool = (id: string) => {
    if (!managerRef.current) return;
    try {
      const tools = managerRef.current.getAllTools() as any;
      const tool = tools instanceof Map ? tools.get(id) : (Array.isArray(tools) ? tools.find((t: any) => t.id === id) : null);
      if (tool) {
        if (typeof tool.hide === 'function') {
          tool.hide();
        } else {
          tool._visible = false;
          if (typeof tool._private__requestUpdate === 'function') tool._private__requestUpdate();
        }
        setSelectedToolId(null); // Deselect when hidden
      }
    } catch (e) { console.error('Hide failed:', e); }
  };

  if (managerRef.current) (window as any).debugDrawingManager = managerRef.current;
  
  return {
    activeTool,
    selectedToolId,
    selectTool,
    cloneTool,
    hideTool,
    disableDrawingMode,
    clearAllDrawings,
    deleteSelected,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    managerRef,
    zoomIn,
    zoomOut,
  };
};
