export interface CandleData {
    time: number; // Unix timestamp
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    color?: string;
    symbol?: string;
}

export interface Trade {
    id: string | number;
    symbol: string;
    direction?: 'BUY' | 'SELL'; // backend uses direction
    type?: 'BUY' | 'SELL';      // legacy frontend uses type
    parentTradeId?: number | null;
    entryPrice: number;
    quantity: number;
    pnl?: number;
    exitPrice?: number;
    exitReason?: string;
    entryTime?: string | null;
    exitTime?: string | null;
    holdingTimeSeconds?: number;
    holdingTimeMins?: number;
    timestamp: Date;
    status: 'OPEN' | 'CLOSED' | 'PENDING' | 'TRIGGERED' | 'FILLED' | 'CANCELLED';
    stopLoss?: number;
    takeProfit?: number;
    limitPrice?: number;
    stopPrice?: number;
    sessionType?: 'REPLAY';
}
