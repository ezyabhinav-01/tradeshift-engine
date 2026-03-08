"""
Advanced Tick Synthesizer — Brownian Bridge with Geometric scaling,
momentum clustering, and soft high/low touches.

Produces smooth, realistic intra-candle tick paths that:
  1. Start exactly at Open, end exactly at Close
  2. Touch (or nearly touch) the High and Low at natural-looking points
  3. Have volatility scaled proportional to the candle's range
  4. Show momentum clustering (trends persist for short bursts)
  5. Avoid the "flat wall" effect of hard clamping
"""

import numpy as np


class TickSynthesizer:
    """Generate realistic intra-candle tick data using an enhanced Brownian Bridge."""

    def __init__(self, seed=None):
        self.rng = np.random.default_rng(seed)

    def generate_ticks(self, open_price: float, high: float, low: float,
                       close: float, num_ticks: int = 60) -> list[float]:
        """
        Generate a smooth price path from Open → Close that respects High/Low.

        The algorithm:
          1. Build a Brownian bridge (Open→Close) with variance scaled to candle range
          2. Inject directional pivots so the path reaches High and Low naturally
          3. Apply an AR(1) momentum filter for autocorrelated movement
          4. Use soft sigmoid clamping instead of hard min/max
          5. Guarantee exact Open, High-touch, Low-touch, and Close values

        Returns:
            List of `num_ticks` prices rounded to 2 decimal places.
        """
        o, h, l, c = float(open_price), float(high), float(low), float(close)
        n = max(num_ticks, 4)

        # Edge case: doji candle (no range)
        candle_range = h - l
        if candle_range < 1e-6:
            return [round(o, 2)] * n

        # ── Step 1: Decide where High and Low are touched ──────────────
        #   Bullish candles tend to dip first (touch low early) then rally
        #   Bearish candles rally first (touch high early) then drop
        is_bullish = c >= o

        if is_bullish:
            low_idx = self.rng.integers(max(1, n // 6), max(2, n // 3))
            high_idx = self.rng.integers(max(low_idx + 2, n * 2 // 3), max(low_idx + 3, n - 1))
        else:
            high_idx = self.rng.integers(max(1, n // 6), max(2, n // 3))
            low_idx = self.rng.integers(max(high_idx + 2, n * 2 // 3), max(high_idx + 3, n - 1))

        # ── Step 2: Build piecewise Brownian bridges ───────────────────
        #   Open → pivot1 → pivot2 → Close
        #   Each segment is an independent bridge connecting its endpoints

        waypoints = sorted([
            (0, o),
            (low_idx, l),
            (high_idx, h),
            (n - 1, c),
        ], key=lambda x: x[0])

        path = np.empty(n, dtype=np.float64)

        for seg_i in range(len(waypoints) - 1):
            i_start, p_start = waypoints[seg_i]
            i_end, p_end = waypoints[seg_i + 1]
            seg_len = i_end - i_start

            if seg_len <= 0:
                continue
            if seg_len == 1:
                path[i_start] = p_start
                continue

            # Brownian bridge for this segment
            seg_path = self._brownian_bridge(p_start, p_end, seg_len + 1,
                                             volatility=candle_range * 0.15)
            path[i_start:i_end + 1] = seg_path

        # ── Step 3: AR(1) momentum filter for autocorrelation ──────────
        #   Real tick data has short-term momentum (price trends persist
        #   for a few ticks before reversing). Apply a light smoothing pass.
        smoothed = np.copy(path)
        phi = 0.3  # momentum persistence (0 = none, 1 = full)
        for i in range(2, n):
            delta_prev = smoothed[i - 1] - smoothed[i - 2]
            delta_curr = smoothed[i] - smoothed[i - 1]
            # Blend current movement with previous momentum
            blended = (1 - phi) * delta_curr + phi * delta_prev
            smoothed[i] = smoothed[i - 1] + blended

        # ── Step 4: Soft clamping with sigmoid squeeze ─────────────────
        #   Instead of hard clamping (which creates flat walls at H/L),
        #   use a sigmoid-like function that gently pushes back
        margin = candle_range * 0.02  # 2% soft buffer
        for i in range(n):
            if smoothed[i] > h + margin:
                overshoot = smoothed[i] - h
                smoothed[i] = h + margin * np.tanh(overshoot / margin)
            elif smoothed[i] < l - margin:
                undershoot = l - smoothed[i]
                smoothed[i] = l - margin * np.tanh(undershoot / margin)

        # ── Step 5: Re-anchor exact values ─────────────────────────────
        smoothed[0] = o
        smoothed[-1] = c
        # Ensure the path actually touches (or very nearly touches) H and L
        smoothed[waypoints[1][0]] = waypoints[1][1]  # first pivot
        smoothed[waypoints[2][0]] = waypoints[2][1]  # second pivot

        return [round(float(p), 2) for p in smoothed]

    def _brownian_bridge(self, start: float, end: float, length: int,
                         volatility: float = 1.0) -> np.ndarray:
        """
        Generate a Brownian Bridge of given length from `start` to `end`.

        The bridge has zero drift and variance that peaks at the midpoint,
        naturally producing smooth S-curves.

        B(t) = start + (t/T)*(end-start) + σ * W_bridge(t)
        where W_bridge(t) = W(t) - (t/T)*W(T)  (standard bridge of Wiener process)
        """
        if length <= 1:
            return np.array([start])

        T = length - 1
        t = np.arange(length, dtype=np.float64)

        # Wiener process increments scaled by volatility / sqrt(length)
        sigma = volatility / np.sqrt(max(T, 1))
        dW = self.rng.normal(0, sigma, length)
        dW[0] = 0.0
        W = np.cumsum(dW)

        # Brownian bridge: subtract the linear trend of W to pin endpoints
        W_bridge = W - (t / T) * W[-1]

        # Linear interpolation from start to end + bridge fluctuation
        linear = start + (t / T) * (end - start)
        bridge = linear + W_bridge

        # Ensure exact endpoints
        bridge[0] = start
        bridge[-1] = end

        return bridge
