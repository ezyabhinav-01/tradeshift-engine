from app.models import TradeLog


def test_market_order_lifecycle_updates_children_and_websocket(client, helpers):
    email = helpers.register_and_login(client, prefix="order-flow")

    with client.websocket_connect("/ws/orders") as websocket:
        connected = websocket.receive_json()
        assert connected["type"] == "connected"

        place_response = client.post(
            "/api/trade/",
            json={
                "symbol": "RELIANCE",
                "direction": "BUY",
                "quantity": 4,
                "price": 2500,
                "order_type": "MARKET",
                "stop_loss": 2460,
                "take_profit": 2555,
                "session_type": "REPLAY",
            },
        )
        assert place_response.status_code == 200, place_response.text
        order_payload = place_response.json()
        assert order_payload["status"] == "OPEN"
        assert order_payload["fill_ratio"] > 0
        assert order_payload["simulated_latency_ms"] >= 0

        ws_place_update = websocket.receive_json()
        assert ws_place_update["type"] == "order_update"
        assert ws_place_update["data"]["status"] == "OPEN"
        assert ws_place_update["data"]["symbol"] == "RELIANCE"

        user = helpers.run(helpers.get_user_by_email(email))
        rows = helpers.run(helpers.get_trade_rows(TradeLog.user_id == user.id, TradeLog.symbol == "RELIANCE"))
        assert len(rows) == 3
        parent = next(row for row in rows if row.parent_trade_id is None)
        assert parent.id == order_payload["trade_id"]
        children = [row for row in rows if row.parent_trade_id == parent.id]
        assert {child.order_type for child in children} == {"LIMIT", "STOP"}
        assert all(child.status == "PENDING" for child in children)

        modify_response = client.patch(
            f"/api/trade/order/{parent.id}",
            json={"stop_loss": 2475, "take_profit": 2580},
        )
        assert modify_response.status_code == 200, modify_response.text

        updated_rows = helpers.run(helpers.get_trade_rows(TradeLog.user_id == user.id, TradeLog.symbol == "RELIANCE"))
        updated_children = [row for row in updated_rows if row.parent_trade_id == parent.id]
        assert next(row for row in updated_children if row.order_type == "STOP").stop_price == 2475
        assert next(row for row in updated_children if row.order_type == "LIMIT").limit_price == 2580

        close_response = client.post(
            f"/api/trade/close/{parent.id}",
            json={"exit_type": "MARKET", "exit_price": 2590, "session_type": "REPLAY"},
        )
        assert close_response.status_code == 200, close_response.text
        assert close_response.json()["status"] == "CLOSED"

        ws_close_update = websocket.receive_json()
        assert ws_close_update["type"] == "order_update"
        assert ws_close_update["data"]["status"] == "CLOSED"
        assert ws_close_update["data"]["exit_price"] > 0

    final_rows = helpers.run(helpers.get_trade_rows(TradeLog.user_id == user.id, TradeLog.symbol == "RELIANCE"))
    final_parent = next(row for row in final_rows if row.parent_trade_id is None)
    final_children = [row for row in final_rows if row.parent_trade_id == final_parent.id]
    assert final_parent.status == "CLOSED"
    assert final_parent.exit_reason == "manual_market"
    assert final_parent.holding_time >= 0
    assert all(child.status == "CANCELLED" for child in final_children)


def test_cancel_pending_order_hard_deletes_trade_row(client, helpers):
    email = helpers.register_and_login(client, prefix="cancel-delete")
    user = helpers.run(helpers.get_user_by_email(email))

    place_response = client.post(
        "/api/trade/",
        json={
            "symbol": "NIFTY",
            "direction": "BUY",
            "quantity": 2,
            "price": 22000,
            "order_type": "LIMIT",
            "limit_price": 22000,
            "session_type": "REPLAY",
        },
    )
    assert place_response.status_code == 200, place_response.text
    order_id = place_response.json()["trade_id"]

    before_rows = helpers.run(
        helpers.get_trade_rows(TradeLog.user_id == user.id, TradeLog.id == order_id)
    )
    assert len(before_rows) == 1
    assert before_rows[0].status == "PENDING"

    cancel_response = client.delete(f"/api/trade/order/{order_id}", params={"session_type": "REPLAY"})
    assert cancel_response.status_code == 200, cancel_response.text

    after_rows = helpers.run(
        helpers.get_trade_rows(TradeLog.user_id == user.id, TradeLog.id == order_id)
    )
    assert after_rows == []
