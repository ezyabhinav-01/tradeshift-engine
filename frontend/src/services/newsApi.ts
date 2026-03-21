import axios from 'axios';

const API_BASE = '/api/news';

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment?: string;
  category: string;
}

export interface ExplainResponse {
  news_id: string;
  explanation: string;
}

export const fetchNews = async (category: string = 'all', limit: number = 50): Promise<NewsItem[]> => {
  try {
    const response = await axios.get(`${API_BASE}/`, {
      params: { category, limit }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
};

export const explainNews = async (newsId: string, userLevel: string = 'Beginner'): Promise<string> => {
  try {
    const response = await axios.post(`${API_BASE}/explain`, {
      news_id: newsId,
      user_level: userLevel
    });
    return response.data.explanation;
  } catch (error) {
    console.error(`Error explaining news for ID ${newsId}:`, error);
    throw error;
  }
};
