import { useState, useEffect, useCallback, useRef } from 'react';

interface TopicTagData {
  id: number;
  tagName: string;
  displayName: string;
  shortSummary: string | null;
  targetType: string;
  targetId: string;
  iconEmoji: string;
  usageCount: number;
}

interface ResolvedTag extends TopicTagData {
  targetTitle?: string;
  breadcrumb?: string;
  navigateTo?: string;
}

let cachedTags: TopicTagData[] | null = null;
let fetchPromise: Promise<TopicTagData[]> | null = null;

export function useTopicTags() {
  const [tags, setTags] = useState<TopicTagData[]>(cachedTags || []);
  const [loading, setLoading] = useState(!cachedTags);

  useEffect(() => {
    if (cachedTags) {
      setTags(cachedTags);
      setLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetch('/api/learn/tags')
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          cachedTags = data;
          return data;
        })
        .catch(() => []);
    }

    fetchPromise.then(data => {
      setTags(data);
      setLoading(false);
    });
  }, []);

  const resolveTag = useCallback((tagName: string): TopicTagData | null => {
    const normalized = tagName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return tags.find(t => t.tagName === normalized) || null;
  }, [tags]);

  const resolveTagDetail = useCallback(async (tagName: string): Promise<ResolvedTag | null> => {
    const normalized = tagName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    try {
      const res = await fetch(`/api/learn/tags/${normalized}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const recordClick = useCallback(async (tagId: number) => {
    try {
      await fetch(`/api/learn/tags/${tagId}/click`, { method: 'POST' });
    } catch {
      // fire-and-forget
    }
  }, []);

  // Invalidate cache (call after tags change)
  const refreshTags = useCallback(async () => {
    cachedTags = null;
    fetchPromise = null;
    try {
      const res = await fetch('/api/learn/tags');
      const data = res.ok ? await res.json() : [];
      cachedTags = data;
      setTags(data);
    } catch {
      setTags([]);
    }
  }, []);

  return { tags, loading, resolveTag, resolveTagDetail, recordClick, refreshTags };
}
