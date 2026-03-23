import type { CandleData } from '../types';

type MessageHandler = (data: any) => void;

const API_BASE = ''; // Use relative paths for proxy
const WS_BASE = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;

export class MarketDataService {
    private ws: WebSocket | null = null;
    private url: string = `${WS_BASE}/ws/ticker`;
    private onMessageCallback: MessageHandler | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private lastConnectArgs: { speed: number; symbols?: string[]; symbol?: string; date?: string } | null = null;

    constructor(url?: string) {
        if (url) this.url = url;
    }

    connect(speed: number, symbols?: string[], symbol?: string, date?: string) {
        // Clear any pending reconnect
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.onclose = null; // Prevent old onclose from triggering reconnect
            this.ws.close();
            this.ws = null;
        }

        // Save args for potential reconnect
        this.lastConnectArgs = { speed, symbols, symbol, date };

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('🟢 Connected to Market Data Service');
            this.reconnectAttempts = 0; // Reset on successful connect
            this.sendMessage({
                command: 'START',
                speed,
                ...(symbols ? { symbols } : {}),
                ...(symbol ? { symbol } : {}),
                ...(date ? { date } : {}),
            });
        };

        this.ws.onmessage = (event) => {
            if (this.onMessageCallback) {
                try {
                    this.onMessageCallback(JSON.parse(event.data));
                } catch (e) {
                    console.error('❌ Failed to parse WS message:', e);
                }
            }
        };

        this.ws.onerror = (event) => {
            console.error('❌ WebSocket error:', event);
        };

        this.ws.onclose = (event) => {
            const reason = event.reason || 'No reason';
            console.log(`🔴 Disconnected from Market Data Service (code: ${event.code}, reason: ${reason})`);
            
            // Auto-reconnect only for abnormal closures (not user-initiated disconnect)
            if (event.code !== 1000 && event.code !== 1005 && this.lastConnectArgs && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000);
                console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                this.reconnectTimer = setTimeout(() => {
                    if (this.lastConnectArgs) {
                        const { speed, symbols, symbol, date } = this.lastConnectArgs;
                        this.connect(speed, symbols, symbol, date);
                    }
                }, delay);
            }
        };
    }

    disconnect() {
        // Clear reconnect on intentional disconnect
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.lastConnectArgs = null;
        this.reconnectAttempts = 0;

        if (this.ws) {
            this.ws.onclose = null; // Prevent reconnect on intentional close
            this.ws.close();
            this.ws = null;
            console.log('🔴 Disconnected from Market Data Service (user-initiated)');
        }
    }

    sendMessage(message: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    onMessage(callback: MessageHandler) {
        this.onMessageCallback = callback;
    }

    setSpeed(speed: number) {
        this.sendMessage({
            command: 'SPEED',
            speed
        });
    }
}

/**
 * Fetch historical OHLC candles from the REST API.
 * Returns candles sorted oldest → newest, ready for lightweight-charts setData().
 */
export async function fetchHistoricalCandles(
    symbol: string,
    limit = 500,
    date?: string
): Promise<CandleData[]> {
    let url = `${API_BASE}/api/historical/${encodeURIComponent(symbol)}?limit=${limit}`;
    if (date) {
        url += `&date=${date}`;
    }
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
        throw new Error(`Failed to fetch history for ${symbol}: ${res.statusText}`);
    }
    const json = await res.json();
    // Ensure ascending time order (backend already sorts, but be defensive)
    return (json.candles as CandleData[]).sort((a, b) => a.time - b.time);
}

/**
 * Fetch the list of available dates (YYYY-MM-DD) for a specific symbol.
 */
export async function fetchAvailableDates(symbol: string): Promise<string[]> {
    const res = await fetch(`${API_BASE}/api/available-dates/${encodeURIComponent(symbol)}`, { credentials: 'include' });
    if (!res.ok) {
        throw new Error(`Failed to fetch available dates for ${symbol}`);
    }
    const json = await res.json();
    return json.dates as string[];
}

export const marketDataService = new MarketDataService();
