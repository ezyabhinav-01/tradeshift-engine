# India Fundamentals Dynamic Data Plan

## Objective
Replace all hardcoded company fundamentals with authentic, dynamic, auditable data for Indian equities (NSE/BSE), without web scraping.

## Scope
- Profile card metrics: market cap, current price, high/low, P/E, book value, dividend yield, ROCE, ROE, face value.
- Key ratios section.
- Quarterly results section.
- Yearly financial growth chart.
- About and key points summary.

## Guiding Rules
1. No hardcoded business values in API responses.
2. Every displayed value must have `source`, `as_of`, and `quality_status`.
3. Ratios should be recomputed internally where possible, not blindly copied.
4. If data is unavailable, show `N/A` with quality flags instead of fake values.

## Data Source Strategy (India-first)
1. Primary source: licensed India market/filings feeds (official exchange or authorized channel).
2. Secondary source: one fundamentals API for cross-check and fill-gaps.
3. Price source: exchange-grade or broker-grade live/EOD feed for valuation-linked metrics.

## Canonical Data Model
1. `company_master`
- isin, nse_symbol, bse_code, company_name, sector, industry, listing_status.
2. `fundamentals_snapshot`
- symbol, metric_name, metric_value, unit, as_of, source, quality_status, quality_score, ingestion_run_id.
3. `financial_statement_annual`
- symbol, year, revenue, ebit, net_profit, eps, total_assets, current_liabilities, equity.
4. `financial_statement_quarterly`
- symbol, quarter, revenue, net_profit, eps, filing_date.
5. `corporate_actions`
- symbol, event_type, ex_date, ratio, cash_amount.
6. `ingestion_audit_log`
- provider, endpoint, request_id, fetched_at, raw_payload_ref, status, error.

## Metric Rulebook (single source of truth)
1. PE = last_price / TTM EPS
2. ROE = TTM PAT / avg shareholder equity
3. ROCE = EBIT / (total assets - current liabilities)
4. Book Value = shareholder equity / shares outstanding
5. Dividend Yield = annual dividend per share / last_price
6. Market Cap = last_price * shares outstanding

## API Contract
1. `GET /api/stock/{symbol}/profile`
- returns `fundamentals`, `financials`, `quarterly_performance`, `meta`, `quality`.
2. `GET /api/stock/{symbol}/quality`
- returns per-metric freshness/mismatch/coverage signals.
3. `POST /api/admin/stocks/sync-all`
- scheduled and manual sync entrypoint.

## Quality Gates
1. Freshness: reject stale records beyond SLA.
2. Completeness: reject if required fields missing.
3. Formula consistency: compare provider ratio vs recomputed ratio.
4. Cross-source variance: tolerance checks between providers.
5. Corporate-action continuity: validate split/bonus-adjusted series.

## Runtime Behavior
1. Serve latest valid value from cache/DB.
2. Try best-effort live refresh in parallel.
3. If live refresh fails, keep last good value and mark degraded.
4. Never synthesize fake numeric values in production path.

## Rollout Plan
1. Phase 1: remove hardcoded fallbacks and add quality metadata.
2. Phase 2: add metric rulebook + internal recomputation engine.
3. Phase 3: add ingestion quality checks + alerting.
4. Phase 4: onboard full company universe with automatic reconciliation.

## Monitoring
1. Daily: missing metrics count by symbol.
2. Daily: stale metrics > SLA.
3. Daily: cross-source mismatch over threshold.
4. Weekly: provider reliability scorecard for India universe.

## Immediate Next Engineering Tasks
1. Add `source/as_of/quality_status` badges in UI cards.
2. Add dedicated `company_master` mapping table (ISIN + NSE + BSE).
3. Add quarterly financial table persistence (currently best-effort live only).
4. Add scheduled job frequency split:
- price-linked metrics: every market minute.
- fundamentals: daily + filing-day accelerated pulls.
5. Add fallback policy config by metric criticality.

## Deployment Scheduler Config (Implemented)
Use these environment variables to tune update cadence in production:
- `MARKET_REFRESH_MINUTES` (default: `5`) for market cache refresh during market hours.
- `FUND_SYNC_SYMBOL_LIMIT` (default: `200`) max symbols per fundamentals sync run.
- `FUND_SYNC_DAILY_HOUR_IST` / `FUND_SYNC_DAILY_MINUTE_IST` (default: `18:10`) post-market sync.
- `FUND_SYNC_EXTRA_HOUR_IST` / `FUND_SYNC_EXTRA_MINUTE_IST` (default: `12:30`) mid-day top-up.
- `FUND_SYNC_WEEKLY_HOUR_IST` / `FUND_SYNC_WEEKLY_MINUTE_IST` (default: `09:30`) Saturday reconciliation run.
- `FUND_SYNC_FALLBACK_SYMBOLS` comma-separated symbols used only if DB symbol discovery is empty.

Current schedule behavior:
1. Market cache refresh every `MARKET_REFRESH_MINUTES` on weekdays between 09:00 and 15:59 IST.
2. Rolling 7-day market data refresh at 17:00 IST on weekdays.
3. Daily fundamentals sync after market close on weekdays.
4. Mid-day fundamentals top-up on weekdays.
5. Weekly broader reconciliation sync on Saturday.
