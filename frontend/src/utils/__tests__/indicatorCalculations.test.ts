import { describe, it, expect } from 'vitest';
import {
  calculateSMA,
  calculateEMA,
  calculateWMA,
  calculateRMA,
  calculateVWMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  type OHLCV,
} from '../indicatorCalculations';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal OHLCV array from a flat array of close prices. */
const makeOHLCV = (closes: number[]): OHLCV[] =>
  closes.map((close, i) => ({ time: i + 1, close }));

const round = (n: number, dp = 6) => parseFloat(n.toFixed(dp));

// ─── SMA ─────────────────────────────────────────────────────────────────────

describe('calculateSMA', () => {
  it('returns empty array when data is shorter than period', () => {
    expect(calculateSMA(makeOHLCV([1, 2]), 5)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(calculateSMA([], 3)).toEqual([]);
  });

  it('calculates a 3-period SMA correctly', () => {
    const data = makeOHLCV([1, 2, 3, 4, 5]);
    const result = calculateSMA(data, 3);

    // First SMA at index 2: (1+2+3)/3 = 2
    expect(result[0].value).toBeCloseTo(2);
    // Second SMA at index 3: (2+3+4)/3 = 3
    expect(result[1].value).toBeCloseTo(3);
    // Third SMA at index 4: (3+4+5)/3 = 4
    expect(result[2].value).toBeCloseTo(4);
  });

  it('uses the "open" source field when specified', () => {
    const data: OHLCV[] = [
      { time: 1, open: 10, close: 1 },
      { time: 2, open: 20, close: 2 },
      { time: 3, open: 30, close: 3 },
    ];
    const result = calculateSMA(data, 3, 'open');
    expect(result[0].value).toBeCloseTo(20); // (10+20+30)/3
  });

  it('uses the "high" source field when specified', () => {
    const data: OHLCV[] = [
      { time: 1, high: 5, close: 1 },
      { time: 2, high: 10, close: 2 },
      { time: 3, high: 15, close: 3 },
    ];
    const result = calculateSMA(data, 3, 'high');
    expect(result[0].value).toBeCloseTo(10);
  });

  it('preserves the correct time value on each result point', () => {
    const data = makeOHLCV([10, 20, 30, 40]);
    const result = calculateSMA(data, 2);
    expect(result[0].time).toBe(2);
    expect(result[1].time).toBe(3);
    expect(result[2].time).toBe(4);
  });
});

// ─── EMA ─────────────────────────────────────────────────────────────────────

describe('calculateEMA', () => {
  it('returns empty array when data is shorter than period', () => {
    expect(calculateEMA(makeOHLCV([1, 2]), 5)).toEqual([]);
  });

  it('seeds the first EMA value with a simple average', () => {
    const data = makeOHLCV([10, 20, 30]); // period = 3
    const result = calculateEMA(data, 3);
    // Seed = (10+20+30)/3 = 20
    expect(result[0].value).toBeCloseTo(20);
  });

  it('applies the EMA multiplier correctly for subsequent points', () => {
    // period = 3, multiplier = 2/(3+1) = 0.5
    const data = makeOHLCV([10, 20, 30, 40]);
    const result = calculateEMA(data, 3);
    // Seed EMA = 20
    // EMA[1] = (40 - 20) * 0.5 + 20 = 30
    expect(result[1].value).toBeCloseTo(30);
  });

  it('produces the correct number of output points', () => {
    const data = makeOHLCV([1, 2, 3, 4, 5, 6]);
    const result = calculateEMA(data, 3);
    // Expect 4 points (indices 2–5)
    expect(result).toHaveLength(4);
  });
});

// ─── WMA ─────────────────────────────────────────────────────────────────────

describe('calculateWMA', () => {
  it('returns empty array when data is shorter than period', () => {
    expect(calculateWMA(makeOHLCV([1]), 3)).toEqual([]);
  });

  it('calculates a 3-period WMA using linear weights', () => {
    // weights: 1, 2, 3 → weightSum = 6
    // prices = [1, 2, 3] → WMA = (1*1 + 2*2 + 3*3) / 6 = 14/6 ≈ 2.333
    const data = makeOHLCV([1, 2, 3]);
    const result = calculateWMA(data, 3);
    expect(result[0].value).toBeCloseTo(14 / 6);
  });

  it('slides the window correctly', () => {
    const data = makeOHLCV([1, 2, 3, 4]);
    const result = calculateWMA(data, 3);
    // Second window [2,3,4]: (2*1 + 3*2 + 4*3)/6 = 20/6 ≈ 3.333
    expect(result[1].value).toBeCloseTo(20 / 6);
  });
});

// ─── RMA ─────────────────────────────────────────────────────────────────────

describe('calculateRMA', () => {
  it('returns empty array when data is shorter than period', () => {
    expect(calculateRMA(makeOHLCV([1, 2]), 5)).toEqual([]);
  });

  it('seeds with a simple average of the first N prices', () => {
    const data = makeOHLCV([10, 20, 30]);
    const result = calculateRMA(data, 3);
    expect(result[0].value).toBeCloseTo(20);
  });

  it('applies alpha = 1/period smoothing', () => {
    // period=2, alpha=0.5, seed=(10+20)/2=15
    // RMA[1] = (30 - 15)*0.5 + 15 = 22.5
    const data = makeOHLCV([10, 20, 30]);
    const result = calculateRMA(data, 2);
    expect(result[0].value).toBeCloseTo(15);
    expect(result[1].value).toBeCloseTo(22.5);
  });
});

// ─── VWMA ────────────────────────────────────────────────────────────────────

describe('calculateVWMA', () => {
  it('returns empty array when data is shorter than period', () => {
    expect(calculateVWMA(makeOHLCV([1]), 3)).toEqual([]);
  });

  it('falls back to volume=1 when value field is absent', () => {
    // All volumes are 1 → VWMA degrades to SMA
    const data = makeOHLCV([2, 4, 6]);
    const smaResult = calculateSMA(data, 3);
    const vwmaResult = calculateVWMA(data, 3);
    expect(vwmaResult[0].value).toBeCloseTo(smaResult[0].value);
  });

  it('weights prices by the value (volume) field correctly', () => {
    const data: OHLCV[] = [
      { time: 1, close: 10, value: 1 },
      { time: 2, close: 20, value: 2 },
      { time: 3, close: 30, value: 3 },
    ];
    // VWMA = (10*1 + 20*2 + 30*3) / (1+2+3) = (10+40+90)/6 = 140/6 ≈ 23.333
    const result = calculateVWMA(data, 3);
    expect(result[0].value).toBeCloseTo(140 / 6);
  });
});

// ─── Bollinger Bands ─────────────────────────────────────────────────────────

describe('calculateBollingerBands', () => {
  it('returns empty bands when data is shorter than period', () => {
    const result = calculateBollingerBands(makeOHLCV([1, 2]), 5, 2);
    expect(result.upper).toHaveLength(0);
    expect(result.lower).toHaveLength(0);
    expect(result.middle).toHaveLength(0);
  });

  it('upper band is above middle and lower band is below middle', () => {
    const prices = [44, 46, 48, 50, 52, 54, 56];
    const result = calculateBollingerBands(makeOHLCV(prices), 3, 2);
    result.upper.forEach((u, i) => {
      expect(u.value).toBeGreaterThan(result.middle[i].value);
    });
    result.lower.forEach((l, i) => {
      expect(l.value).toBeLessThan(result.middle[i].value);
    });
  });

  it('returns equal upper/lower bands for constant price series (std=0)', () => {
    const prices = [100, 100, 100, 100];
    const result = calculateBollingerBands(makeOHLCV(prices), 3, 2);
    result.upper.forEach(u => expect(u.value).toBeCloseTo(100));
    result.lower.forEach(l => expect(l.value).toBeCloseTo(100));
  });

  it('supports EMA as the middle band MA type', () => {
    // Non-linear series: the first EMA result is the seed (avg of first 3) = 30,
    // but the second EMA point diverges from the SMA rolling average.
    const prices = [10, 50, 30, 60, 20, 80];
    const bbSMA = calculateBollingerBands(makeOHLCV(prices), 3, 2, 'SMA');
    const bbEMA = calculateBollingerBands(makeOHLCV(prices), 3, 2, 'EMA');
    // Both must produce results
    expect(bbSMA.middle.length).toBeGreaterThan(1);
    expect(bbEMA.middle.length).toBeGreaterThan(1);
    // At index 1 the two MA types should diverge
    // SMA[1] = (50+30+60)/3 = 46.67, EMA[1] = (60 - 30)*0.5 + 30 = 45
    expect(bbSMA.middle[1].value).not.toBeCloseTo(bbEMA.middle[1].value, 0);
  });
});

// ─── RSI ─────────────────────────────────────────────────────────────────────

describe('calculateRSI', () => {
  it('returns empty arrays when data is too short', () => {
    const result = calculateRSI(makeOHLCV([1, 2, 3]), { period: 14 });
    expect(result.rsi).toHaveLength(0);
  });

  it('RSI values are bounded between 0 and 100', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 50 + Math.sin(i) * 10);
    const result = calculateRSI(makeOHLCV(prices), { period: 14 });
    result.rsi.forEach(r => {
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(100);
    });
  });

  it('returns RSI = 100 for a strictly increasing series', () => {
    // All gains, no losses → RS = Inf → RSI = 100
    const prices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const result = calculateRSI(makeOHLCV(prices), { period: 14 });
    expect(result.rsi[0].value).toBeCloseTo(100);
  });

  it('returns RSI = 0 for a strictly decreasing series', () => {
    const prices = [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const result = calculateRSI(makeOHLCV(prices), { period: 14 });
    expect(result.rsi[0].value).toBeCloseTo(0);
  });

  it('returns no MA series when maType is None', () => {
    const prices = Array.from({ length: 30 }, (_, i) => i + 1);
    const result = calculateRSI(makeOHLCV(prices), { period: 14, maType: 'None' });
    expect(result.ma).toHaveLength(0);
    expect(result.upper).toHaveLength(0);
    expect(result.lower).toHaveLength(0);
  });
});

// ─── MACD ────────────────────────────────────────────────────────────────────

describe('calculateMACD', () => {
  it('returns empty arrays when data is too short', () => {
    const result = calculateMACD(makeOHLCV([1, 2, 3]), {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    });
    expect(result.macd).toHaveLength(0);
    expect(result.signal).toHaveLength(0);
    expect(result.histogram).toHaveLength(0);
  });

  it('produces macd, signal, and histogram of equal length', () => {
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5);
    const result = calculateMACD(makeOHLCV(prices), {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    });
    expect(result.macd.length).toBeGreaterThan(0);
    expect(result.signal.length).toBe(result.macd.length);
    expect(result.histogram.length).toBe(result.macd.length);
  });

  it('histogram = MACD line − signal line at every point', () => {
    const prices = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i) * 5);
    const result = calculateMACD(makeOHLCV(prices), {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    });
    result.macd.forEach((m, i) => {
      const expected = round(m.value - result.signal[i].value);
      expect(round(result.histogram[i].value)).toBeCloseTo(expected, 5);
    });
  });

  it('assigns a color string to every histogram bar', () => {
    const prices = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i) * 5);
    const result = calculateMACD(makeOHLCV(prices), {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    });
    result.histogram.forEach(h => {
      expect(typeof (h as { color: string }).color).toBe('string');
    });
  });

  it('uses custom color params when provided', () => {
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i);
    const result = calculateMACD(makeOHLCV(prices), {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      posGrowing: '#aaaaaa',
      posFading: '#bbbbbb',
      negFading: '#cccccc',
      negGrowing: '#dddddd',
    });
    const colors = new Set(result.histogram.map(h => (h as { color: string }).color));
    // At least one bar should use one of our custom colors
    const customColors = new Set(['#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd']);
    expect([...colors].some(c => customColors.has(c))).toBe(true);
  });
});
