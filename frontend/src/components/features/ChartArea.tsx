import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import type { ISeriesApi, IChartApi, UTCTimestamp } from 'lightweight-charts';
import { useGame } from '../../hooks/useGame';
import { useThemeStore } from '../../store/themeStore';
import { Play, Pause, SkipForward, Calendar as CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ChartArea = () => {
  const {
    currentPrice, currentCandle, isPlaying, historicalCandles,
    selectedSymbol, togglePlay, isReplayActive, toggleReplay,
    selectedDate, availableDates, setDate, speed, setSpeed,
  } = useGame();
  const { theme } = useThemeStore();
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // ── Initialize Chart ────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = theme === 'dark';
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#D1D4DC' : '#131722',
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { width: 1, color: isDark ? '#9a3412' : '#8e96a5', style: 0 },
        horzLine: { width: 1, color: isDark ? '#9a3412' : '#8e96a5', style: 0 },
      },
      grid: {
        vertLines: { color: isDark ? '#1e293b' : '#E0E3EB' },
        horzLines: { color: isDark ? '#1e293b' : '#E0E3EB' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: isDark ? '#1e293b' : '#E0E3EB',
        rightOffset: 5,
        barSpacing: 6,
        tickMarkFormatter: (time: number) => {
          const d = new Date(time * 1000);
          const hh = d.getUTCHours().toString().padStart(2, '0');
          const mm = d.getUTCMinutes().toString().padStart(2, '0');
          return `${hh}:${mm}`;
        },
      },
      rightPriceScale: {
        borderColor: isDark ? '#1e293b' : '#E0E3EB',
        autoScale: true,
      },
      localization: {
        timeFormatter: (time: number) => {
          const d = new Date(time * 1000);
          const hh = d.getUTCHours().toString().padStart(2, '0');
          const mm = d.getUTCMinutes().toString().padStart(2, '0');
          const ss = d.getUTCSeconds().toString().padStart(2, '0');
          return `${hh}:${mm}:${ss}`;
        },
      },
    });

    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: '#089981',
      downColor: '#f23645',
      borderVisible: true,
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
      borderUpColor: '#089981',
      borderDownColor: '#f23645',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    chart.priceScale('').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.25 },
    });

    seriesRef.current = series;
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].target) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0 && chartRef.current) {
        chartRef.current.applyOptions({ width, height });
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // ── Update Theme ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    const isDark = theme === 'dark';
    chartRef.current.applyOptions({
      layout: { textColor: isDark ? '#D1D4DC' : '#131722' },
      grid: {
        vertLines: { color: isDark ? '#1e293b' : '#E0E3EB' },
        horzLines: { color: isDark ? '#1e293b' : '#E0E3EB' },
      },
    });
  }, [theme]);

  // ── Historical Candles ──────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !volumeSeriesRef.current) return;

    // When historicalCandles is cleared (replay starts or loading), clear chart
    if (historicalCandles.length === 0) {
      seriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      return;
    }
    try {
      const ohlcData = historicalCandles
        .filter((c) => 'open' in c && c.open !== undefined)
        .map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

      const volData = historicalCandles
        .filter((c) => 'open' in c && c.open !== undefined)
        .map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume || 0,
          color: c.close >= c.open ? '#089981' : '#f23645',
        }));

      // Deduplicate + sort ascending
      const uniqueOhlc = Array.from(new Map(ohlcData.map((d) => [d.time, d])).values())
        .sort((a, b) => (a.time as number) - (b.time as number));
      const uniqueVol = Array.from(new Map(volData.map((d) => [d.time, d])).values())
        .sort((a, b) => (a.time as number) - (b.time as number));

      seriesRef.current.setData(uniqueOhlc as any);
      volumeSeriesRef.current.setData(uniqueVol as any);

      // Fit the visible range to show all data
      chartRef.current?.timeScale().fitContent();
    } catch (err) {
      console.error('Chart setData error:', err);
    }
  }, [historicalCandles]);

  // ── Live Candles (from WebSocket replay) ─────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !volumeSeriesRef.current || !currentCandle) return;
    try {
      seriesRef.current.update({
        time: currentCandle.time as UTCTimestamp,
        open: currentCandle.open,
        high: currentCandle.high,
        low: currentCandle.low,
        close: currentCandle.close,
      });
      volumeSeriesRef.current.update({
        time: currentCandle.time as UTCTimestamp,
        value: currentCandle.volume || 0,
        color: currentCandle.close >= currentCandle.open ? '#089981' : '#f23645',
      });
    } catch { /* silently skip bad updates */ }
  }, [currentCandle]);

  return (
    <div className="relative flex-1 w-full h-full bg-tv-bg-base overflow-hidden font-sans">

      {/* Chart Canvas — leave 26px at bottom for the timescale labels */}
      <div ref={chartContainerRef} className="absolute inset-0 bottom-0" />

      {/* TOP LEFT OVERLAY - Info Block */}
      <div className="absolute top-2 left-2 z-10 select-none flex flex-col gap-1 w-[350px]">
        <div className="flex items-center text-xs px-2 py-1 bg-tv-bg-base/80 rounded">
          <div className="flex gap-2 items-center">
            <span className="font-bold text-tv-text-primary">
              {selectedSymbol ? `${selectedSymbol} / Indian Rupee` : 'Indian Rupee'}
            </span>
            <span className="text-tv-text-secondary">· 1m · NSE</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1" />
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono px-2 text-tv-text-secondary">
          <span>O<span className={(currentCandle?.open ?? 0) >= currentPrice ? 'text-[#089981]' : 'text-[#f23645]'}>{currentCandle?.open?.toFixed(2) || '0.00'}</span></span>
          <span>H<span className={(currentCandle?.high ?? 0) >= currentPrice ? 'text-[#089981]' : 'text-[#f23645]'}>{currentCandle?.high?.toFixed(2) || '0.00'}</span></span>
          <span>L<span className={(currentCandle?.low ?? 0) >= currentPrice ? 'text-[#089981]' : 'text-[#f23645]'}>{currentCandle?.low?.toFixed(2) || '0.00'}</span></span>
          <span>C<span className={(currentCandle?.close ?? 0) >= currentPrice ? 'text-[#089981]' : 'text-[#f23645]'}>{currentCandle?.close?.toFixed(2) || '0.00'}</span></span>
        </div>

        <div className="flex items-center bg-tv-bg-base/80 p-2 rounded shadow-sm border border-tv-border w-max mt-1 gap-2">
          <div className="flex flex-col items-center justify-center border border-[#f23645] bg-[#f23645]/10 rounded px-3 py-1 cursor-pointer hover:bg-[#f23645]/20">
            <span className="text-[#f23645] font-mono font-bold">₹{currentPrice.toFixed(2)}</span>
            <span className="text-[#f23645] text-[10px] font-bold">SELL</span>
          </div>
          <div className="text-xs font-mono text-tv-text-secondary px-1">10.2</div>
          <div className="flex flex-col items-center justify-center border border-blue-500 bg-blue-500/10 rounded px-3 py-1 cursor-pointer hover:bg-blue-500/20">
            <span className="text-blue-500 font-mono font-bold">₹{(currentPrice + 0.1).toFixed(2)}</span>
            <span className="text-blue-500 text-[10px] font-bold">BUY</span>
          </div>
        </div>

        <div className="text-[11px] font-mono text-tv-text-secondary px-2 mt-1">
          Vol <span className="text-[#f23645]">{currentCandle?.volume ? (currentCandle.volume / 1000).toFixed(2) + ' K' : '0 K'}</span>
        </div>
      </div>

      {/* BOTTOM CENTER OVERLAY - Replay Toolbar */}
      {isReplayActive && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex items-center bg-tv-bg-pane border border-tv-border rounded shadow-lg p-1.5 gap-2 select-none">

          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 text-tv-text-primary hover:bg-tv-bg-pane/50"
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
            >
              <CalendarIcon size={14} />
              <span className="text-xs">{selectedDate || 'Select date'}</span>
              <span className="text-[10px] ml-1">▼</span>
            </Button>

            {isDateDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-36 bg-tv-bg-pane border border-tv-border rounded shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
                {availableDates.length > 0 ? (
                  availableDates.map(day => (
                    <div
                      key={day}
                      className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-600/20 hover:text-blue-500
                        ${day === selectedDate ? 'text-blue-500 bg-blue-600/10 font-bold' : 'text-tv-text-primary'}`}
                      onClick={() => {
                        setIsDateDropdownOpen(false);
                        setDate(day);
                      }}
                    >
                      {day}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-1.5 text-xs text-tv-text-secondary italic">
                    No dates available
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-[1px] h-5 bg-tv-border mx-1" />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-tv-text-primary hover:bg-tv-bg-pane/50"
            onClick={() => togglePlay()}
          >
            {isPlaying ? (
              <Pause size={14} className="text-blue-500 fill-blue-500" />
            ) : (
              <Play size={14} />
            )}
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8 text-tv-text-primary hover:bg-tv-bg-pane/50">
            <SkipForward size={14} />
          </Button>

          <div className="flex items-center gap-2 px-2 border-l border-tv-border pl-3">
            <span className="text-xs text-tv-text-secondary font-bold mr-1">Speed</span>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer range-sm dark:bg-gray-700"
            />
            <span className="text-xs font-mono w-20 text-tv-text-primary text-center" title="Updates per second">{speed}x</span>
          </div>

          <div className="w-[1px] h-5 bg-tv-border mx-1" />

          <Button variant="ghost" size="icon" className="h-8 w-8 text-tv-text-secondary hover:bg-tv-bg-pane/50" onClick={toggleReplay}>
            <X size={14} />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ChartArea;