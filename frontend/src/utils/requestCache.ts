type CacheOptions = {
  ttlMs?: number;
  forceRefresh?: boolean;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const valueCache = new Map<string, CacheEntry<unknown>>();
const inflightCache = new Map<string, Promise<unknown>>();

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const ttlMs = options.ttlMs ?? 60_000;
  const forceRefresh = options.forceRefresh ?? false;

  if (!forceRefresh) {
    const cached = valueCache.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  const inflight = inflightCache.get(key) as Promise<T> | undefined;
  if (inflight) {
    return inflight;
  }

  const request = fetcher()
    .then((result) => {
      valueCache.set(key, {
        value: result,
        expiresAt: Date.now() + ttlMs,
      });
      return result;
    })
    .finally(() => {
      inflightCache.delete(key);
    });

  inflightCache.set(key, request);
  return request;
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number): void {
  valueCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateCache(key: string): void {
  valueCache.delete(key);
  inflightCache.delete(key);
}
