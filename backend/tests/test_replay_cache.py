import datetime as dt
import unittest

from app.replay.cache import ReplayRedisCache, epoch_ms, expand_compact_tick, stable_seed


class ReplayCacheTests(unittest.TestCase):
    def test_stable_seed_is_repeatable(self):
        seed_a = stable_seed("replay-ticks", "v1", "NIFTY", "2026-04-02")
        seed_b = stable_seed("replay-ticks", "v1", "NIFTY", "2026-04-02")
        seed_c = stable_seed("replay-ticks", "v1", "RELIANCE", "2026-04-02")
        self.assertEqual(seed_a, seed_b)
        self.assertNotEqual(seed_a, seed_c)

    def test_epoch_ms_treats_naive_timestamp_as_utc(self):
        value = dt.datetime(2026, 4, 2, 3, 45, 0)
        self.assertEqual(epoch_ms(value), 1775101500000)

    def test_expand_compact_tick_returns_legacy_tick_shape(self):
        tick = expand_compact_tick("NIFTY", [1775101500000, 22383.4, 0])
        self.assertEqual(tick["symbol"], "NIFTY")
        self.assertEqual(tick["price"], 22383.4)
        self.assertEqual(tick["timestamp"], "2026-04-02T03:45:00Z")
        self.assertEqual(tick["volume"], 0)

    def test_cache_is_noop_without_redis(self):
        cache = ReplayRedisCache(None)
        self.assertFalse(cache.available)
        self.assertIsNone(cache.get_candles("NIFTY", "2026-04-02"))
        self.assertIsNone(cache.get_ticks("NIFTY", "2026-04-02"))


if __name__ == "__main__":
    unittest.main()
