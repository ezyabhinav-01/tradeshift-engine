"""
Tests for the trade execution endpoint and WebSocket order_update events.

Run with:
    cd backend
    python -m pytest test_trading.py -v
"""

import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime


# ─── Schema Validation Tests ────────────────────────────────────

class TestTradeSchemas:
    """Test Pydantic schema validation for trade requests."""

    def test_valid_market_order(self):
        from app.schemas import TradeExecuteRequest
        req = TradeExecuteRequest(
            symbol="NIFTY",
            direction="BUY",
            quantity=50,
            price=22150.0,
            order_type="MARKET",
        )
        assert req.symbol == "NIFTY"
        assert req.direction.value == "BUY"
        assert req.quantity == 50
        assert req.price == 22150.0
        assert req.order_type.value == "MARKET"
        assert req.stop_loss is None
        assert req.take_profit is None
        assert req.alert is False

    def test_valid_limit_order_with_all_fields(self):
        from app.schemas import TradeExecuteRequest
        req = TradeExecuteRequest(
            symbol="NIFTY",
            direction="BUY",
            quantity=50,
            price=22150.0,
            order_type="LIMIT",
            limit_price=22150.0,
            stop_loss=22130.0,
            take_profit=22190.0,
            alert=True,
        )
        assert req.order_type.value == "LIMIT"
        assert req.limit_price == 22150.0
        assert req.stop_loss == 22130.0
        assert req.take_profit == 22190.0
        assert req.alert is True

    def test_valid_stop_order(self):
        from app.schemas import TradeExecuteRequest
        req = TradeExecuteRequest(
            symbol="BANKNIFTY",
            direction="SELL",
            quantity=25,
            price=48000.0,
            order_type="STOP",
            stop_price=47900.0,
        )
        assert req.order_type.value == "STOP"
        assert req.stop_price == 47900.0
        assert req.direction.value == "SELL"

    def test_valid_gtt_order(self):
        from app.schemas import TradeExecuteRequest
        req = TradeExecuteRequest(
            symbol="RELIANCE",
            direction="BUY",
            quantity=10,
            price=2500.0,
            order_type="GTT",
            limit_price=2490.0,
            stop_loss=2450.0,
            take_profit=2600.0,
        )
        assert req.order_type.value == "GTT"

    def test_invalid_quantity_zero(self):
        from app.schemas import TradeExecuteRequest
        with pytest.raises(Exception):
            TradeExecuteRequest(
                symbol="NIFTY",
                direction="BUY",
                quantity=0,
                price=22150.0,
            )

    def test_invalid_quantity_negative(self):
        from app.schemas import TradeExecuteRequest
        with pytest.raises(Exception):
            TradeExecuteRequest(
                symbol="NIFTY",
                direction="BUY",
                quantity=-5,
                price=22150.0,
            )

    def test_invalid_price_zero(self):
        from app.schemas import TradeExecuteRequest
        with pytest.raises(Exception):
            TradeExecuteRequest(
                symbol="NIFTY",
                direction="BUY",
                quantity=50,
                price=0,
            )

    def test_invalid_direction(self):
        from app.schemas import TradeExecuteRequest
        with pytest.raises(Exception):
            TradeExecuteRequest(
                symbol="NIFTY",
                direction="HOLD",
                quantity=50,
                price=22150.0,
            )

    def test_invalid_order_type(self):
        from app.schemas import TradeExecuteRequest
        with pytest.raises(Exception):
            TradeExecuteRequest(
                symbol="NIFTY",
                direction="BUY",
                quantity=50,
                price=22150.0,
                order_type="FOK",
            )

    def test_order_update_payload(self):
        from app.schemas import OrderUpdatePayload
        payload = OrderUpdatePayload(
            trade_id=1,
            status="OPEN",
            symbol="NIFTY",
            direction="BUY",
            entry_price=22150.0,
            stop_loss=22130.0,
            take_profit=22190.0,
            quantity=50,
            pnl=0.0,
        )
        assert payload.trade_id == 1
        assert payload.status == "OPEN"
        assert payload.pnl == 0.0

    def test_trade_response(self):
        from app.schemas import TradeResponse
        resp = TradeResponse(
            trade_id=42,
            status="OPEN",
            symbol="NIFTY",
            direction="BUY",
            quantity=50,
            entry_price=22150.0,
            order_type="MARKET",
            stop_loss=22130.0,
            take_profit=22190.0,
            alert=True,
            message="Order filled successfully",
        )
        assert resp.trade_id == 42
        assert resp.message == "Order filled successfully"


# ─── Trade Engine Tests ──────────────────────────────────────────

class TestTradeEngine:
    """Test TradeEngine order execution logic."""

    def _make_mock_db(self):
        """Create a mock DB session."""
        db = MagicMock()
        # Make refresh set the id on the mock trade
        def refresh_side_effect(trade):
            trade.id = 1
        db.refresh.side_effect = refresh_side_effect
        return db

    def test_market_order_execution(self):
        from app.schemas import TradeExecuteRequest
        from app.trade_engine import TradeEngine

        db = self._make_mock_db()
        req = TradeExecuteRequest(
            symbol="NIFTY",
            direction="BUY",
            quantity=50,
            price=22150.0,
            order_type="MARKET",
            stop_loss=22130.0,
            take_profit=22190.0,
            alert=True,
        )

        result = TradeEngine.execute_trade(req, user_id=1, db=db)

        assert result["status"] == "OPEN"
        assert result["symbol"] == "NIFTY"
        assert result["direction"] == "BUY"
        assert result["entry_price"] == 22150.0
        assert result["order_type"] == "MARKET"
        assert result["stop_loss"] == 22130.0
        assert result["take_profit"] == 22190.0
        assert result["alert"] is True
        # MARKET order should ignore limit_price/stop_price
        assert result["limit_price"] is None
        assert result["stop_price"] is None

        # Verify DB operations
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_limit_order_is_pending(self):
        from app.schemas import TradeExecuteRequest
        from app.trade_engine import TradeEngine

        db = self._make_mock_db()
        req = TradeExecuteRequest(
            symbol="NIFTY",
            direction="BUY",
            quantity=50,
            price=22150.0,
            order_type="LIMIT",
            limit_price=22150.0,
        )

        result = TradeEngine.execute_trade(req, user_id=1, db=db)

        assert result["status"] == "PENDING"
        assert result["limit_price"] == 22150.0

    def test_stop_order_is_pending(self):
        from app.schemas import TradeExecuteRequest
        from app.trade_engine import TradeEngine

        db = self._make_mock_db()
        req = TradeExecuteRequest(
            symbol="BANKNIFTY",
            direction="SELL",
            quantity=25,
            price=48000.0,
            order_type="STOP",
            stop_price=47900.0,
        )

        result = TradeEngine.execute_trade(req, user_id=1, db=db)

        assert result["status"] == "PENDING"
        assert result["stop_price"] == 47900.0

    def test_gtt_order_is_pending(self):
        from app.schemas import TradeExecuteRequest
        from app.trade_engine import TradeEngine

        db = self._make_mock_db()
        req = TradeExecuteRequest(
            symbol="RELIANCE",
            direction="BUY",
            quantity=10,
            price=2500.0,
            order_type="GTT",
            limit_price=2490.0,
        )

        result = TradeEngine.execute_trade(req, user_id=1, db=db)

        assert result["status"] == "PENDING"

    def test_build_order_update_payload(self):
        from app.trade_engine import TradeEngine

        mock_trade = MagicMock()
        mock_trade.id = 42
        mock_trade.status = "OPEN"
        mock_trade.symbol = "NIFTY"
        mock_trade.direction = "BUY"
        mock_trade.entry_price = 22150.0
        mock_trade.stop_loss = 22130.0
        mock_trade.take_profit = 22190.0
        mock_trade.quantity = 50
        mock_trade.pnl = 0.0

        payload = TradeEngine.build_order_update_payload(mock_trade)

        assert payload["trade_id"] == 42
        assert payload["status"] == "OPEN"
        assert payload["symbol"] == "NIFTY"
        assert payload["entry_price"] == 22150.0
        assert payload["stop_loss"] == 22130.0
        assert payload["take_profit"] == 22190.0
        assert payload["quantity"] == 50
        assert payload["pnl"] == 0.0


# ─── WebSocket Manager Tests ────────────────────────────────────

class TestConnectionManager:
    """Test WebSocket connection manager."""

    @pytest.mark.asyncio
    async def test_connect_and_disconnect(self):
        from app.websocket_manager import ConnectionManager

        manager = ConnectionManager()
        ws = AsyncMock()

        await manager.connect(ws, user_id=1)
        assert "user-1" in manager.active_connections
        assert ws in manager.active_connections["user-1"]

        manager.disconnect(ws, user_id=1)
        assert "user-1" not in manager.active_connections

    @pytest.mark.asyncio
    async def test_emit_to_connected_user(self):
        from app.websocket_manager import ConnectionManager

        manager = ConnectionManager()
        ws = AsyncMock()

        await manager.connect(ws, user_id=1)
        await manager.emit_to_user(1, "order_update", {"trade_id": 1, "status": "OPEN"})

        ws.send_json.assert_called_once_with({
            "type": "order_update",
            "data": {"trade_id": 1, "status": "OPEN"}
        })

    @pytest.mark.asyncio
    async def test_emit_to_disconnected_user_is_noop(self):
        from app.websocket_manager import ConnectionManager

        manager = ConnectionManager()
        # No connections — should not raise
        await manager.emit_to_user(999, "order_update", {"trade_id": 1})

    @pytest.mark.asyncio
    async def test_multiple_connections_per_user(self):
        from app.websocket_manager import ConnectionManager

        manager = ConnectionManager()
        ws1 = AsyncMock()
        ws2 = AsyncMock()

        await manager.connect(ws1, user_id=1)
        await manager.connect(ws2, user_id=1)

        assert len(manager.active_connections["user-1"]) == 2

        await manager.emit_to_user(1, "order_update", {"trade_id": 1})

        ws1.send_json.assert_called_once()
        ws2.send_json.assert_called_once()

    def test_get_connected_users(self):
        from app.websocket_manager import ConnectionManager

        manager = ConnectionManager()
        manager.active_connections = {
            "user-1": [MagicMock()],
            "user-2": [MagicMock()],
        }

        users = manager.get_connected_users()
        assert "user-1" in users
        assert "user-2" in users
