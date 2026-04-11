from app.models import TradeLog


def test_portfolio_and_history_remain_consistent_across_open_and_closed_trades(client, helpers):
    email = helpers.register_and_login(client, prefix="portfolio-history")
    user = helpers.run(helpers.get_user_by_email(email))

    open_trade = client.post(
        "/api/trade/",
        json={
            "symbol": "HDFCBANK",
            "direction": "BUY",
            "quantity": 5,
            "price": 1500,
            "order_type": "MARKET",
            "session_type": "REPLAY",
        },
    )
    assert open_trade.status_code == 200, open_trade.text
    open_trade_id = open_trade.json()["trade_id"]

    positions_response = client.get("/api/portfolio/positions")
    holdings_response = client.get("/api/portfolio/holdings")
    summary_response = client.get("/api/portfolio/summary")
    history_open_response = client.get("/api/history/trades")

    assert positions_response.status_code == 200, positions_response.text
    assert holdings_response.status_code == 200, holdings_response.text
    assert summary_response.status_code == 200, summary_response.text
    assert history_open_response.status_code == 200, history_open_response.text

    positions = positions_response.json()["positions"]
    holdings = holdings_response.json()["holdings"]
    summary_open = summary_response.json()
    history_open = history_open_response.json()["trades"]

    assert len(positions) == 1
    assert len(holdings) == 1
    assert positions[0]["symbol"] == holdings[0]["symbol"] == "HDFCBANK"
    assert positions[0]["quantity"] == holdings[0]["quantity"] == 5
    assert round(summary_open["current_value"], 2) == round(holdings[0]["current_value"], 2)
    assert summary_open["cash_balance"] < 100000.0
    assert any(row["id"] == open_trade_id and row["status"] == "OPEN" for row in history_open)

    close_response = client.post(
        f"/api/trade/close/{open_trade_id}",
        json={"exit_type": "MARKET", "exit_price": 1525, "session_type": "REPLAY"},
    )
    assert close_response.status_code == 200, close_response.text

    summary_closed_response = client.get("/api/portfolio/summary")
    positions_closed_response = client.get("/api/portfolio/positions")
    holdings_closed_response = client.get("/api/portfolio/holdings")
    history_closed_response = client.get("/api/history/trades", params={"include_children": "false"})
    monthly_summary_response = client.get("/api/history/monthly-summary")
    research_response = client.get("/api/portfolio/research")

    summary_closed = summary_closed_response.json()
    positions_closed = positions_closed_response.json()["positions"]
    holdings_closed = holdings_closed_response.json()["holdings"]
    history_closed = history_closed_response.json()["trades"]
    monthly_summary = monthly_summary_response.json()["months"]
    research = research_response.json()

    closed_trade = next(row for row in history_closed if row["id"] == open_trade_id)
    expected_pnl = round((closed_trade["exit_price"] - closed_trade["entry_price"]) * closed_trade["quantity"], 2)

    assert positions_closed == []
    assert holdings_closed == []
    assert summary_closed["current_value"] == 0
    assert round(summary_closed["total_value"], 2) == round(summary_closed["cash_balance"], 2)
    assert round(summary_closed["cash_balance"], 2) == round(100000.0 + expected_pnl, 2)
    assert closed_trade["status"] == "CLOSED"
    assert round(closed_trade["pnl"], 2) == expected_pnl
    assert closed_trade["holding_time_seconds"] >= 0
    assert len(monthly_summary) == 1
    assert round(monthly_summary[0]["total_pnl"], 2) == expected_pnl
    assert research["total_trades"] == 1
    assert round(research["avg_pnl"], 2) == expected_pnl
    assert helpers.wait_for(lambda: bool(helpers.run(helpers.get_snapshots(user.id))))

    trade_rows = helpers.run(helpers.get_trade_rows(TradeLog.user_id == user.id))
    assert len(trade_rows) == 1
    assert trade_rows[0].status == "CLOSED"
