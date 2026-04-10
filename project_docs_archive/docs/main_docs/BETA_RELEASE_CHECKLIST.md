# Beta Release Checklist

## Final Verification Sequence

```bash
chmod +x backend/scripts/final_verification.sh
./backend/scripts/final_verification.sh 100
```

## Go / No-Go Table

| Check | Go Threshold | No-Go Trigger |
| :--- | :--- | :--- |
| Integration tests | All Phase 5 integration tests pass | Any auth/order/portfolio-history regression |
| REST baseline | Error rate <= 1% and p95 <= 750 ms | Error rate > 1% or p95 > 750 ms |
| Websocket replay baseline | Unexpected disconnects = 0 and replay start success >= 95% | Replay start failures > 5% or unexpected disconnects > 0 |
| Config sanity | `validate_runtime_config.py` exits 0 | Any config error |
| Security defaults | No placeholder secrets in beta env | Placeholder/default secrets remain |
| Rollback readiness | Previous known-good revision is runnable | No rollback target verified |

## Release Checklist

- Run [backend/scripts/final_verification.sh](/Users/riteshkumarsingh/Desktop/tradeshift-engine/backend/scripts/final_verification.sh).
- Archive the latest report at [docs/reports/phase5_baseline_latest.json](/Users/riteshkumarsingh/Desktop/tradeshift-engine/docs/reports/phase5_baseline_latest.json).
- Confirm the beta env passes [backend/scripts/validate_runtime_config.py](/Users/riteshkumarsingh/Desktop/tradeshift-engine/backend/scripts/validate_runtime_config.py).
- Confirm the runbook at [docs/BETA_RUNBOOK.md](/Users/riteshkumarsingh/Desktop/tradeshift-engine/docs/BETA_RUNBOOK.md) is available to operators.
- Confirm rollback target and command path are known before inviting users.

## Known Release Gates

- Replay beta should not launch with `REPLAY_MAX_CONCURRENT_SESSIONS < 100`.
- Beta should not launch on SQLite unless the user pool is deliberately tiny and rollback tolerance is high.
- Beta should not launch while placeholder admin/chatbot/MinIO/email credentials remain in the active environment.
