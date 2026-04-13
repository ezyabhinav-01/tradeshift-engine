import axios from 'axios';
import { getCachedOrFetch } from '../utils/requestCache';

const BASE_URL = import.meta.env.VITE_API_URL || '';
const API_BASE = `${BASE_URL}/api/news`;

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment?: string;
  category: string;
  imageUrl?: string;
  sourceTrust?: 'high' | 'medium';
}

export interface ExplainResponse {
  news_id: string | number;
  explanation: string;
}

const explainCache: Record<string, { ts: number; explanation: string }> = {};

export const fetchNews = async (category: string = 'all', limit: number = 50): Promise<NewsItem[]> => {
  const cacheKey = `news:list:${category}:${limit}`;
  return getCachedOrFetch(
    cacheKey,
    async () => {
      try {
        const response = await axios.get(`${API_BASE}/`, {
          params: { category, limit },
          timeout: 8000,
        });
        return response.data;
      } catch (error) {
        console.error('Error fetching news:', error);
        throw error;
      }
    },
    { ttlMs: 120_000 }
  );
};

export const explainNews = async (
  newsId: string | number, 
  userLevel: string = 'Beginner',
  title?: string,
  description?: string
): Promise<string> => {
  const key = `${newsId}:${userLevel}`;
  const cached = explainCache[key];
  const now = Date.now();
  if (cached && now - cached.ts < 10 * 60 * 1000) {
    return cached.explanation;
  }

  try {
    const response = await axios.post(`${API_BASE}/explain`, {
      news_id: newsId,
      user_level: userLevel,
      title,
      description
    }, {
      // LLM-backed endpoint; keep a realistic timeout budget.
      timeout: 25000,
    });
    const explanation = response.data.explanation || 'Explanation is currently unavailable. Please retry.';
    explainCache[key] = { ts: now, explanation };
    return explanation;
  } catch (error) {
    // One retry for transient timeouts/network blips.
    if (axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || !error.response)) {
      try {
        const retry = await axios.post(`${API_BASE}/explain`, {
          news_id: newsId,
          user_level: userLevel,
          title,
          description
        }, {
          timeout: 25000,
        });
        const explanation = retry.data.explanation || 'Explanation is currently unavailable. Please retry.';
        explainCache[key] = { ts: Date.now(), explanation };
        return explanation;
      } catch (retryErr) {
        console.error(`Retry failed for news explanation ID ${newsId}:`, retryErr);
        throw retryErr;
      }
    }
    console.error(`Error explaining news for ID ${newsId}:`, error);
    throw error;
  }
};
