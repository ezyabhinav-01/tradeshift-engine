import axios from 'axios';
import { getCachedOrFetch } from '../utils/requestCache';

const API_URL = '/api';
const CHAT_TIMEOUT_MS = 30000;
const HEALTH_CACHE_MS = 20_000;
const SUGGESTION_CACHE_MS = 2 * 60_000;
const CHAT_RESPONSE_CACHE_MS = 30_000;

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    sources?: { title: string; url: string }[];
    actions?: { type: string; payload: string }[];
}

export interface ChatResponse {
    session_id: string;
    response: string;
    actions: { type: string; payload: string }[];
    sources: { title: string; url: string }[];
    suggested_questions: string[];
    model: string;
}

const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        'x-api-key': 'tradeshift-local-key'
    },
    timeout: CHAT_TIMEOUT_MS,
});

const responseCache = new Map<string, { ts: number; value: ChatResponse }>();

const buildClientSideFallback = (message: string, sessionId?: string): ChatResponse => ({
    session_id: sessionId || crypto.randomUUID(),
    response: message.toLowerCase().includes('macd')
        ? 'MACD compares a fast and slow moving average to highlight momentum shifts. A cross above the signal line often indicates improving momentum, and a cross below can indicate weakening momentum.'
        : 'TradeGuide is facing temporary connectivity pressure, but core help is still available. Please retry in a few seconds for full AI responses.',
    actions: [],
    sources: [],
    suggested_questions: ['Explain MACD', 'How do I use Replay mode?', 'How to read ROCE and PE together?'],
    model: 'frontend-fallback',
});

/**
 * Sends a query to the Local AI Model Backend and retrieves the response.
 * Handles automatic session ID passthrough.
 */
export const sendChatQuery = async (message: string, sessionId?: string): Promise<ChatResponse> => {
    const cacheKey = `${sessionId || 'anon'}:${message.trim().toLowerCase()}`;
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CHAT_RESPONSE_CACHE_MS) {
        return cached.value;
    }

    const payload = sessionId ? { message, session_id: sessionId } : { message };
    try {
        const response = await axiosInstance.post(`/chat`, payload);
        responseCache.set(cacheKey, { ts: Date.now(), value: response.data });
        return response.data;
    } catch (error) {
        console.error("Error communicating with TradeGuideBot Pipeline:", error);
        // One quick retry for transient network hiccups.
        try {
            const retry = await axiosInstance.post(`/chat`, payload);
            responseCache.set(cacheKey, { ts: Date.now(), value: retry.data });
            return retry.data;
        } catch (retryError) {
            console.error("Retry failed for TradeGuideBot Pipeline:", retryError);
            const fallback = buildClientSideFallback(message, sessionId);
            responseCache.set(cacheKey, { ts: Date.now(), value: fallback });
            return fallback;
        }
    }
};

/**
 * Transmits RLHF feedback based on user Upvotes/Downvotes.
 */
export const transmitChatFeedback = async (sessionId: string, rating: 'upvote' | 'downvote', feedback?: string) => {
    try {
        await axiosInstance.post(`/chat/feedback`, { session_id: sessionId, rating, feedback });
    } catch (error) {
        console.error("Failed to sync AI feedback:", error);
    }
};

/**
 * Pre-fetches contextual suggested queries dynamically from the engine.
 */
export const fetchSuggestedTopics = async (topic: string): Promise<string[]> => {
    return getCachedOrFetch(
        `chat:suggestions:${topic.toLowerCase()}`,
        async () => {
            try {
                const response = await axiosInstance.get(`/chat/suggestions/${topic}`);
                return response.data.suggestions;
            } catch (error) {
                console.error("Could not fetch contextual AI suggestions:", error);
                return [];
            }
        },
        { ttlMs: SUGGESTION_CACHE_MS }
    );
};
/**
 * Verifies if the TradeGuide AI backend is alive and reachable.
 */
export const checkBotHealth = async (): Promise<boolean> => {
    return getCachedOrFetch(
        'chat:health',
        async () => {
            try {
                // Increase timeout to 15s to allow for AI model cold-starts in Docker
                const response = await axiosInstance.get('/chat/health', { timeout: 15000 });
                return response.status === 200;
            } catch (error) {
                return false;
            }
        },
        { ttlMs: HEALTH_CACHE_MS }
    );
};
