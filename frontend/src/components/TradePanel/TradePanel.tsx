import { useState, useEffect } from 'react';
import { useGame } from '../../hooks/useGame';
import { useMultiChartStore } from '../../store/useMultiChartStore';
import { X, ChevronDown, Bell, BellOff, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { toast } from 'sonner';

export interface OrderData {
  symbol: string;
  direction: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  order_type: 'MARKET' | 'LIMIT' | 'STOP' | 'GTT';
  limit_price?: number;
  stop_price?: number;
  stop_loss?: number;
  take_profit?: number;
  alert: boolean;
}

interface TradePanelProps {
  price: number;
  onExecute: (data: OrderData) => void;
  onClose: () => void;
}

const TradePanel = ({ price, onExecute, onClose }: TradePanelProps) => {
  const { isPlaying, selectedSymbol, userSettings } = useGame();
  const { charts, activeChartId } = useMultiChartStore();
  
  const activeChart = charts.find(c => c.id === activeChartId);
  const activeSymbol = activeChart?.symbol || selectedSymbol;

  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState(50);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP' | 'GTT'>('LIMIT');
  const [limitPrice, setLimitPrice] = useState(price);
  const [stopPrice, setStopPrice] = useState(price);
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Sync prices when target price changes
  useEffect(() => {
    setLimitPrice(price);
    setStopPrice(price);
    
    // Auto-suggest SL/TP (0.5% / 1% ranges)
    const slOffset = price * 0.005;
    const tpOffset = price * 0.01;
    
    if (direction === 'BUY') {
      setStopLoss((price - slOffset).toFixed(2));
      setTakeProfit((price + tpOffset).toFixed(2));
    } else {
      setStopLoss((price + slOffset).toFixed(2));
      setTakeProfit((price - tpOffset).toFixed(2));
    }
  }, [price, direction]);

  const validate = (): string | null => {
    if (qty <= 0) return "Quantity must be greater than zero";
    
    // Pre-validate against User Risk Settings
    if (userSettings && qty > userSettings.max_order_quantity) {
      return `Quantity exceeds your maximum allowed limit of ${userSettings.max_order_quantity} lots.`;
    }
    
    const slValue = stopLoss ? parseFloat(stopLoss) : null;
    const tpValue = takeProfit ? parseFloat(takeProfit) : null;
    const entryPrice = orderType === 'MARKET' ? price : limitPrice;

    if (slValue !== null) {
      if (direction === 'BUY' && slValue >= entryPrice) return "Stop Loss must be below entry price for BUY";
      if (direction === 'SELL' && slValue <= entryPrice) return "Stop Loss must be above entry price for SELL";
    }

    if (tpValue !== null) {
      if (direction === 'BUY' && tpValue <= entryPrice) return "Take Profit must be above entry price for BUY";
      if (direction === 'SELL' && tpValue >= entryPrice) return "Take Profit must be below entry price for SELL";
    }

    if ((orderType === 'LIMIT' || orderType === 'GTT') && !limitPrice) return "Limit price must be set";
    if (orderType === 'STOP' && !stopPrice) return "Stop price must be set";

    return null;
  };

  const handleExecute = () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const orderData: OrderData = {
      symbol: activeSymbol,
      direction,
      quantity: qty,
      price,
      order_type: orderType,
      limit_price: (orderType === 'LIMIT' || orderType === 'GTT') ? limitPrice : undefined,
      stop_price: orderType === 'STOP' ? stopPrice : undefined,
      stop_loss: stopLoss ? parseFloat(stopLoss) : undefined,
      take_profit: takeProfit ? parseFloat(takeProfit) : undefined,
      alert: alertEnabled,
    };

    onExecute(orderData);
    handleClose();
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const isBuy = direction === 'BUY';

  return (
    <>
      <div 
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      <div className={`fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="mx-auto max-w-3xl bg-[#0a0c10] border-t border-white/10 rounded-t-[2.5rem] shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.8)] overflow-hidden">
          
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2 cursor-pointer group" onClick={handleClose}>
            <div className="w-12 h-1.5 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors" />
          </div>

          {/* Main Content */}
          <div className="px-8 pb-10">
            
            {/* Header */}
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                  {activeSymbol}
                  <span className="text-xs font-mono px-2 py-1 bg-white/5 border border-white/10 rounded text-white/40 align-middle">
                    {activeSymbol.includes('NIFTY') ? 'INDEX / NSE' : 'EQ / NSE'}
                  </span>
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-mono text-white/50">Market Price:</span>
                  <span className="text-sm font-mono font-bold text-[#089981]">₹{price.toFixed(2)}</span>
                </div>
              </div>
              <button 
                onClick={handleClose}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-all transform hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              
              {/* Left Column: Order Config */}
              <div className="space-y-6">
                
                {/* Direction Switcher */}
                <div className="p-1 bg-white/5 rounded-2xl flex gap-1">
                  <button 
                    onClick={() => setDirection('BUY')}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-black transition-all duration-300 ${isBuy ? 'bg-[#089981] text-white shadow-lg shadow-[#089981]/20' : 'text-white/30 hover:text-white/50'}`}
                  >
                    <TrendingUp size={18} /> BUY / LONG
                  </button>
                  <button 
                    onClick={() => setDirection('SELL')}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-black transition-all duration-300 ${!isBuy ? 'bg-[#f23645] text-white shadow-lg shadow-[#f23645]/20' : 'text-white/30 hover:text-white/50'}`}
                  >
                    <TrendingDown size={18} /> SELL / SHORT
                  </button>
                </div>

                {/* Order Type & Price Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Type</label>
                    <div className="relative">
                      <select 
                        value={orderType}
                        onChange={(e) => setOrderType(e.target.value as any)}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-4 text-white font-bold text-sm appearance-none focus:outline-none focus:border-white/20 transition-colors"
                      >
                        <option value="MARKET">MARKET</option>
                        <option value="LIMIT">LIMIT</option>
                        <option value="STOP">STOP</option>
                        <option value="GTT">GTT</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">
                      {orderType === 'STOP' ? 'Stop Price' : 'Price'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-mono">₹</span>
                      <input 
                        type="number"
                        step="0.05"
                        disabled={orderType === 'MARKET'}
                        value={orderType === 'STOP' ? stopPrice : limitPrice}
                        onChange={(e) => orderType === 'STOP' ? setStopPrice(parseFloat(e.target.value)) : setLimitPrice(parseFloat(e.target.value))}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 text-white font-mono font-bold text-sm focus:outline-none focus:border-white/20 transition-colors disabled:opacity-30"
                      />
                    </div>
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Quantity (Lots)</label>
                  <div className="flex gap-2">
                    <button onClick={() => setQty(Math.max(50, qty - 50))} className="h-14 w-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-colors font-bold text-xl">−</button>
                    <input 
                      type="number" 
                      value={qty}
                      onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                      className="flex-1 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-white font-mono font-bold text-lg focus:outline-none focus:border-white/20 transition-colors" 
                    />
                    <button onClick={() => setQty(qty + 50)} className="h-14 w-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-colors font-bold text-xl">+</button>
                  </div>
                </div>
              </div>

              {/* Right Column: Advanced Options */}
              <div className="space-y-6">
                
                {/* SL / TP Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#f23645]/60 uppercase tracking-[0.2em] px-1">Stop Loss</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-mono">₹</span>
                      <input 
                        type="number"
                        step="0.05"
                        placeholder="Optional"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        className="w-full h-14 bg-[#f23645]/5 border border-[#f23645]/20 rounded-xl pl-8 pr-4 text-white font-mono font-bold text-sm focus:outline-none focus:border-[#f23645]/40 transition-colors placeholder:text-white/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#089981]/60 uppercase tracking-[0.2em] px-1">Take Profit</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-mono">₹</span>
                      <input 
                        type="number"
                        step="0.05"
                        placeholder="Optional"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value)}
                        className="w-full h-14 bg-[#089981]/5 border border-[#089981]/20 rounded-xl pl-8 pr-4 text-white font-mono font-bold text-sm focus:outline-none focus:border-[#089981]/40 transition-colors placeholder:text-white/10"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Info / Alert */}
                <div className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${alertEnabled ? 'bg-amber-500/20 text-amber-500' : 'bg-white/5 text-white/20'}`}>
                        {alertEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Price Alert</p>
                        <p className="text-[10px] text-white/30 uppercase font-black">Notify on execution</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setAlertEnabled(!alertEnabled)}
                      className={`w-12 h-6 rounded-full relative transition-colors ${alertEnabled ? 'bg-amber-500' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${alertEnabled ? 'translate-x-[24px]' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className="h-[1px] bg-white/5" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/40">
                      <Info size={14} />
                      <span className="text-xs font-medium">Estimated Margin</span>
                    </div>
                    <span className="text-sm font-mono font-black text-white">₹{((limitPrice * qty) / 5).toLocaleString()}</span>
                  </div>
                </div>

                {/* Submit Action */}
                <button 
                  disabled={!isPlaying}
                  onClick={handleExecute}
                  className={`w-full py-5 rounded-2xl font-black text-lg transition-all transform active:scale-[0.98] disabled:opacity-30 disabled:grayscale ${isBuy ? 'bg-[#089981] hover:bg-[#067a65] shadow-xl shadow-[#089981]/20' : 'bg-[#f23645] hover:bg-[#d12435] shadow-xl shadow-[#f23645]/20'} text-white`}
                >
                  PLACE {direction} {orderType} ORDER
                </button>

                {!isPlaying && (
                  <p className="text-center text-[10px] font-black text-white/20 tracking-widest uppercase">Start simulation to trade</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TradePanel;
