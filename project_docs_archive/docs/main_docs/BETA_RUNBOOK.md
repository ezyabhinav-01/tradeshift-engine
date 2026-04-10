# Beta Runbook

## Startup

1. Export the beta-safe environment values:
   - `APP_ENV=beta`
   - `COOKIE_SECURE=true`
   - `HSTS_ENABLED=true`
   - `REPLAY_MAX_CONCURRENT_SESSIONS=100`
   - `RUN_BACKGROUND_JOBS=false` for controlled replay-only beta unless background jobs are explicitly required
2. Validate configuration before boot:
   ```bash
   .venv/bin/python backend/scripts/validate_runtime_config.py
   ```
3. Start the backend:
   ```bash
   cd backend
   ../.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```
4. Start the frontend:
   ```bash
   cd frontend
   npm run dev -- --host 0.0.0.0 --port 5173
   ```

## Health Checks

- API liveness:
  ```bash
  curl -fsS http://127.0.0.1:8000/health
  ```
- Scheduler health:
  ```bash
  curl -fsS -H "X-Admin-Service-Key: $ADMIN_SERVICE_KEY" http://127.0.0.1:8000/api/admin/scheduler/status
  ```
- Integration coverage:
  ```bash
  .venv/bin/pytest backend/tests/integration -q
  ```
- 100-user readiness:
  ```bash
  .venv/bin/python backend/scripts/load/run_phase5_baseline.py --users 100
  ```

## Rollback

1. Stop the candidate backend process.
2. Re-point traffic to the previous backend process or restart the prior known-good revision.
3. Restore the previous environment file if any runtime toggle changed.
4. Re-run:
   ```bash
   curl -fsS http://127.0.0.1:8000/health
   ```
5. Confirm the last known-good report or smoke test still passes.

## Incident Quick Actions

- Elevated API latency:
  - Pause new beta invites.
  - Check [docs/reports/phase5_baseline_latest.json](/Users/riteshkumarsingh/Desktop/tradeshift-engine/docs/reports/phase5_baseline_latest.json) against live symptoms.
  - Restart the backend if latency remains elevated after active replay sessions drain.
- Replay websocket disconnect spike:
  - Check `REPLAY_MAX_CONCURRENT_SESSIONS`, `WS_SEND_TIMEOUT_SECONDS`, and CPU saturation.
  - Temporarily reduce concurrent testers and re-run the websocket scenario.
- Auth failures:
  - Verify `SECRET_KEY`, cookie flags, and session table connectivity.
  - Re-run the auth/session integration suite.
- Data/replay startup failures:
  - Confirm local parquet files exist in `backend/data`.
  - Confirm `index_metadata` or the equivalent catalog is populated for the runtime database.

## One-Week Monitoring Plan

- Day 1:
  - Review health, latency, error rate, and websocket disconnect patterns every 2 hours.
- Days 2-3:
  - Review twice daily and after any beta invite increase.
- Days 4-7:
  - Review daily plus any incident-triggered spot check.
- Track:
  - `/health` availability
  - REST p95 latency
  - websocket session start success rate
  - order placement error rate
  - unexpected websocket disconnect count
