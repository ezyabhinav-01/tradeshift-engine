import axios from 'axios';

const API_URL = '/api';

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
    }
});

/**
 * Sends a query to the Local AI Model Backend and retrieves the response.
 * Handles automatic session ID passthrough.
 */
export const sendChatQuery = async (message: string, sessionId?: string): Promise<ChatResponse> => {
    try {
        const payload = sessionId ? { message, session_id: sessionId } : { message };
        const response = await axiosInstance.post(`/chat`, payload);
        return response.data;
    } catch (error) {
        console.error("Error communicating with TradeGuideBot Pipeline:", error);
        throw error;
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
    try {
        const response = await axiosInstance.get(`/chat/suggestions/${topic}`);
        return response.data.suggestions;
    } catch (error) {
        console.error("Could not fetch contextual AI suggestions:", error);
        return [];
    }
};
/**
 * Verifies if the TradeGuide AI backend is alive and reachable.
 */
export const checkBotHealth = async (): Promise<boolean> => {
    try {
        // Increase timeout to 15s to allow for AI model cold-starts in Docker
        const response = await axiosInstance.get('/chat/health', { timeout: 15000 });
        return response.status === 200;
    } catch (error) {
        return false;
    }
};
