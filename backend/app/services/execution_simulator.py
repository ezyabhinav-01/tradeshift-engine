import os
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass
class ExecutionResult:
    fill_price: float
    fill_quantity: int
    requested_quantity: int
    latency_ms: int
    slippage_bps: float
    fill_ratio: float
    execution_time: datetime


class ExecutionSimulator:
    """
    Lightweight realism model for non-HFT simulation:
    - Variable order/network latency
    - Adverse slippage
    - Finite order-book depth with partial fills
    """

    def __init__(self) -> None:
        self.enabled = os.getenv("EXEC_SIM_ENABLED", "true").lower() not in {"0", "false", "no"}
        self.base_latency_ms = int(os.getenv("EXEC_SIM_BASE_LATENCY_MS", 45))
        self.latency_jitter_ms = int(os.getenv("EXEC_SIM_LATENCY_JITTER_MS", 35))
        self.min_latency_ms = int(os.getenv("EXEC_SIM_MIN_LATENCY_MS", 10))
        self.max_latency_ms = int(os.getenv("EXEC_SIM_MAX_LATENCY_MS", 220))
        self.base_slippage_bps = float(os.getenv("EXEC_SIM_BASE_SLIPPAGE_BPS", 1.5))
        self.impact_bps_per_depth = float(os.getenv("EXEC_SIM_IMPACT_BPS_PER_DEPTH", 8.0))
        self.max_slippage_bps = float(os.getenv("EXEC_SIM_MAX_SLIPPAGE_BPS", 70.0))
        self.top_level_qty = int(os.getenv("EXEC_SIM_TOP_LEVEL_QTY", 120))
        self.book_levels = max(1, int(os.getenv("EXEC_SIM_BOOK_LEVELS", 5)))

    @staticmethod
    def _normalize_time(ts: datetime | None) -> datetime:
        if ts is None:
            return datetime.utcnow()
        if ts.tzinfo is not None:
            return ts.astimezone(timezone.utc).replace(tzinfo=None)
        return ts

    def _sample_latency_ms(self) -> int:
        sampled = random.gauss(self.base_latency_ms, self.latency_jitter_ms)
        return int(max(self.min_latency_ms, min(self.max_latency_ms, round(sampled))))

    def _simulate_depth(self, quantity: int) -> tuple[int, float, float]:
        total_liquidity = max(1, self.top_level_qty * self.book_levels)
        fill_qty = min(quantity, total_liquidity)
        fill_ratio = fill_qty / max(1, quantity)
        depth_consumption = quantity / total_liquidity
        return fill_qty, fill_ratio, depth_consumption

    def _simulate_slippage_bps(self, depth_consumption: float, latency_ms: int) -> float:
        # Adverse slippage that increases with depth consumed and latency regime.
        stochastic = abs(random.gauss(self.base_slippage_bps, self.base_slippage_bps * 0.5))
        latency_factor = 1.0 + ((latency_ms - self.base_latency_ms) / max(1.0, self.base_latency_ms)) * 0.25
        depth_impact = max(0.0, depth_consumption - 0.25) * self.impact_bps_per_depth
        slippage = (stochastic + depth_impact) * max(0.6, latency_factor)
        return max(0.0, min(self.max_slippage_bps, slippage))

    def simulate_fill(
        self,
        *,
        side: str,
        quantity: int,
        reference_price: float,
        limit_price: float | None = None,
        simulated_time: datetime | None = None,
    ) -> ExecutionResult:
        base_price = max(0.01, float(reference_price))
        requested_qty = max(1, int(quantity))
        base_time = self._normalize_time(simulated_time)

        if not self.enabled:
            return ExecutionResult(
                fill_price=base_price,
                fill_quantity=requested_qty,
                requested_quantity=requested_qty,
                latency_ms=0,
                slippage_bps=0.0,
                fill_ratio=1.0,
                execution_time=base_time,
            )

        latency_ms = self._sample_latency_ms()
        fill_qty, fill_ratio, depth_consumption = self._simulate_depth(requested_qty)
        slippage_bps = self._simulate_slippage_bps(depth_consumption, latency_ms)

        # Marketable flow uses adverse price movement by side.
        if side.upper() == "BUY":
            fill_price = base_price * (1.0 + slippage_bps / 10_000.0)
            if limit_price is not None:
                fill_price = min(fill_price, float(limit_price))
        else:
            fill_price = base_price * (1.0 - slippage_bps / 10_000.0)
            if limit_price is not None:
                fill_price = max(fill_price, float(limit_price))

        execution_time = base_time + timedelta(milliseconds=latency_ms)
        return ExecutionResult(
            fill_price=round(fill_price, 4),
            fill_quantity=fill_qty,
            requested_quantity=requested_qty,
            latency_ms=latency_ms,
            slippage_bps=round(slippage_bps, 3),
            fill_ratio=round(fill_ratio, 4),
            execution_time=execution_time,
        )


execution_simulator = ExecutionSimulator()
