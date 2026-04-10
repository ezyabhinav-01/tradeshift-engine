import time
import unittest

from app.runtime_guards import ProcessFileLock, RollingSuccessTracker, TTLCache, parse_cors_origins, should_record_activity


class RuntimeGuardsTests(unittest.TestCase):
    def test_parse_cors_origins_uses_defaults_when_env_missing(self):
        defaults = ["http://localhost:5173"]
        self.assertEqual(parse_cors_origins(None, defaults), defaults)

    def test_parse_cors_origins_splits_and_trims(self):
        defaults = ["http://localhost:5173"]
        result = parse_cors_origins(" https://a.com,https://b.com  , ", defaults)
        self.assertEqual(result, ["https://a.com", "https://b.com"])

    def test_should_record_activity_debounces(self):
        cache = {}
        self.assertTrue(should_record_activity(cache, "user@example.com", 100.0, 45))
        self.assertFalse(should_record_activity(cache, "user@example.com", 120.0, 45))
        self.assertTrue(should_record_activity(cache, "user@example.com", 150.1, 45))

    def test_should_record_activity_prunes_when_large(self):
        cache = {f"user{i}": float(i) for i in range(5200)}
        self.assertTrue(should_record_activity(cache, "fresh", 9999.0, 45))
        self.assertLessEqual(len(cache), 5000)

    def test_process_file_lock_blocks_second_acquire(self):
        lock_a = ProcessFileLock("unit_test_single_instance_lock")
        lock_b = ProcessFileLock("unit_test_single_instance_lock")
        try:
            self.assertTrue(lock_a.acquire())
            self.assertFalse(lock_b.acquire())
        finally:
            lock_a.release()
            lock_b.release()

    def test_ttl_cache_expires_values(self):
        cache = TTLCache(ttl_seconds=0.1, max_entries=5)
        cache.set("token", "value")
        self.assertEqual(cache.get("token"), "value")
        time.sleep(0.12)
        self.assertIsNone(cache.get("token"))

    def test_rolling_success_tracker_reports_ratio(self):
        tracker = RollingSuccessTracker(window_size=5)
        tracker.record(True)
        tracker.record(False)
        tracker.record(True)
        snapshot = tracker.snapshot()
        self.assertEqual(snapshot.attempts, 3)
        self.assertEqual(snapshot.successes, 2)
        self.assertAlmostEqual(snapshot.success_ratio, 2 / 3, places=4)


if __name__ == "__main__":
    unittest.main()
