#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

REPORT_PATH="project_docs_archive/docs/main_docs/reports/phase5_baseline_latest.json"
mkdir -p "$(dirname "$REPORT_PATH")"

.venv/bin/pytest backend/tests/integration -q
.venv/bin/python backend/scripts/validate_runtime_config.py
.venv/bin/python backend/scripts/load/run_phase5_baseline.py \
  --users "${1:-100}" \
  --report-path "$REPORT_PATH" \
  --db-path backend/tests/.tmp/phase5_load.db

.venv/bin/python - <<'PY'
import json
from pathlib import Path

report = json.loads(Path("project_docs_archive/docs/main_docs/reports/phase5_baseline_latest.json").read_text())
rest = report["scenarios"]["rest_usage"]
ws = report["scenarios"]["ws_replay_usage"]
acked = ws["extra"].get("acknowledged_sessions", 0)
users = max(int(ws.get("users", 0)), 1)
ack_ratio = acked / users

errors = []
if rest["error_rate"] > 0.01:
    errors.append(f"REST error rate too high: {rest['error_rate']:.2%}")
if rest["p95_latency_ms"] > 750:
    errors.append(f"REST p95 too high: {rest['p95_latency_ms']} ms")
if ws["extra"].get("unexpected_disconnects", 0) > 0:
    errors.append(f"Unexpected replay disconnects: {ws['extra']['unexpected_disconnects']}")
if ack_ratio < 0.95:
    errors.append(f"Replay SPEED_ACK success below gate: {ack_ratio:.2%}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    raise SystemExit(1)

print("Final verification thresholds passed.")
PY
