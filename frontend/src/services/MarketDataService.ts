import type { CandleData } from '../types';

type MessageHandler = (data: any) => void;

const API_BASE = 'http://localhost:8000';

export class MarketDataService {
    private ws: WebSocket | null = null;
    private url: string = `ws://localhost:8000/ws/ticker`;
    private onMessageCallback: MessageHandler | null = null;

    constructor(url?: string) {
        if (url) this.url = url;
    }

    connect(speed: number, symbol?: string, date?: string) {
        if (this.ws) {
            this.ws.close();
        }

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('🟢 Connected to Market Data Service');
            this.sendMessage({
                command: 'START',
                speed,
                ...(symbol ? { symbol } : {}),
                ...(date ? { date } : {}),
            });
        };

        this.ws.onmessage = (event) => {
            if (this.onMessageCallback) {
                this.onMessageCallback(JSON.parse(event.data));
            }
        };

        this.ws.onclose = () => {
            console.log('🔴 Disconnected from Market Data Service');
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
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
    const res = await fetch(url);
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
    const res = await fetch(`${API_BASE}/api/available-dates/${encodeURIComponent(symbol)}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch available dates for ${symbol}`);
    }
    const json = await res.json();
    return json.dates as string[];
}

export const marketDataService = new MarketDataService();
