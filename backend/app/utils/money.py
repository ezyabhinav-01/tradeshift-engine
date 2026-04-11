from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any

PAISE = Decimal("0.01")


def to_decimal(value: Any, default: str = "0") -> Decimal:
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def money(value: Any) -> Decimal:
    return to_decimal(value).quantize(PAISE, rounding=ROUND_HALF_UP)


def money_float(value: Any) -> float:
    return float(money(value))


def pnl(entry_price: Any, exit_price: Any, quantity: Any, multiplier: int) -> float:
    total = (to_decimal(exit_price) - to_decimal(entry_price)) * to_decimal(quantity) * Decimal(multiplier)
    return money_float(total)
