# Tradeshift Engine Scalability Testing Procedures

Scalability testing ensures the Tradeshift Engine can handle growth in user volume without degradation of service, especially concerning the WebSocket real-time connections and PostgreSQL connection pooling.

## 1. Load Testing (Normal Operations)
Load tests simulate the expected day-to-day traffic. 

**Execution:**
```bash
k6 run load_tests/load_test.js
```
**Success Criteria:**
- 95th percentile (P95) response time under 500ms.
- 0% WebSocket connection drop rate.
- Less than 1% HTTP error rate.

## 2. Stress Testing (Breaking Point Discovery)
Stress tests push the system well beyond expected traffic to identify bottlenecks (e.g., Database lock contention, CPU throttling, Memory leaks).

**Execution:**
```bash
k6 run load_tests/stress_test.js
```
**Monitoring Focus:**
- Use APM (Application Performance Monitoring) to watch PostgreSQL `max_connections`.
- Monitor FastAPI worker CPU utilization.
- Watch for memory leaks over prolonged spike holds.

## 3. Real-Time WebSocket Scaling (Spike Testing)
Because Tradeshift Engine relies heavily on WebSockets for live portfolio and order updates, the WebSocket infrastructure must be independently tested for horizontal scalability.

- **Objective**: Ensure the `order_manager` and broadcasting systems do not block the asyncio event loop under high load.
- **Testing Approach**: Simulate thousands of concurrent users connecting and receiving high-frequency message broadcasts (e.g., market data ticks).

## 4. Horizontal Scaling Procedures
When vertical scaling is insufficient, horizontal scaling involves running multiple FastAPI workers/pods.
- **Requirement**: The application state must be completely stateless.
- **Procedure**: Deploy 3+ replicas of the backend container. Run `k6` stress tests targeting the Load Balancer to verify traffic distribution and ensure background tasks (like `save_trade_async`) do not execute duplicate operations or face deadlocks.
