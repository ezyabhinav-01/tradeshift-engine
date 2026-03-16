import React, { useState } from 'react';
import { Newspaper, Loader2, TrendingUp, TrendingDown, Minus, MessageSquare, Send, Activity, Sparkles, Lightbulb, Zap } from 'lucide-react';
import { useGame } from '../../hooks/useGame';

const NewsPanel = () => {
    const { newsItems, askNewsQuestion } = useGame();
    const [qInputs, setQInputs] = useState<Record<number, string>>({});
    const [loadingQAs, setLoadingQAs] = useState<Record<number, boolean>>({});

    const handleAsk = (newsId: number) => {
        const q = qInputs[newsId];
        if (!q || q.trim() === '') return;
        
        setLoadingQAs(prev => ({ ...prev, [newsId]: true }));
        askNewsQuestion(newsId, q);
        setQInputs(prev => ({ ...prev, [newsId]: '' }));
    };

    // Remove loading state when qa_history changes for a specific news item
    React.useEffect(() => {
        const newLoadings = { ...loadingQAs };
        let changed = false;
        newsItems.forEach(item => {
            if (newLoadings[item.id] && item.qa_history && item.qa_history.length > 0) {
                // We don't have a perfect correlation if they ask instantly again, but roughly this works
                newLoadings[item.id] = false;
                changed = true;
            }
        });
        if (changed) setLoadingQAs(newLoadings);
    }, [newsItems]);

    return (
        <div className="flex flex-col h-full bg-tv-bg-base border-l border-tv-border">
            <div className="h-12 border-b border-tv-border flex items-center px-4 font-bold text-sm text-tv-text-primary gap-2">
                <Newspaper size={16} />
                <span>News AI</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
                {newsItems.length === 0 && (
                    <div className="text-xs text-tv-text-secondary text-center py-8">
                        No news for this session yet. Waiting for simulation...
                    </div>
                )}
                {newsItems.map((item, i) => (
                    <div key={i} className="p-3 rounded bg-tv-bg-pane border border-tv-border transition-colors flex flex-col gap-2">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                            <h4 className="text-xs font-medium text-tv-text-primary pr-2 leading-snug">
                                {item.title}
                            </h4>
                            <span className="text-[10px] text-tv-text-secondary whitespace-nowrap">{item.time_str}</span>
                        </div>
                        
                        {/* Initial Analysis phase */}
                        {item.analysis === "Analyzing impact..." ? (
                            <div className="flex items-center text-[10px] text-[#2962FF] gap-1.5 animate-pulse py-2">
                                <Loader2 size={12} className="animate-spin" />
                                <span>FinGPT analyzing impact...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 mt-1">
                                {/* FinGPT Impact Section */}
                                <div className="p-2 bg-tv-bg-base rounded border border-tv-border/50 flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-semibold text-tv-text-primary flex items-center gap-1">
                                            FinGPT Sentiment
                                        </span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold flex items-center gap-1
                                            ${item.sentiment === 'POSITIVE' ? 'bg-emerald-500/10 text-emerald-500' :
                                                item.sentiment === 'NEGATIVE' ? 'bg-rose-500/10 text-rose-500' : 'bg-yellow-500/10 text-yellow-500'}
                                        `}>
                                            {item.sentiment === 'POSITIVE' && <TrendingUp size={10} />}
                                            {item.sentiment === 'NEGATIVE' && <TrendingDown size={10} />}
                                            {item.sentiment === 'NEUTRAL' && <Minus size={10} />}
                                            {item.sentiment}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-tv-text-secondary italic leading-relaxed">
                                        "{item.analysis}"
                                    </p>
                                </div>

                                {/* Impact Quantization Section */}
                                {(item.predicted_impact || item.actual_impact) && (
                                    <div className="flex flex-col gap-1 mt-1 p-2 bg-[#1E222D] rounded border border-tv-border/50">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Activity size={12} className="text-tv-primary" />
                                            <span className="text-[10px] font-semibold text-tv-text-primary">15m Impact Quantization</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="text-tv-text-secondary">Predicted:</span>
                                            <span className="font-mono text-tv-text-primary">{item.predicted_impact !== "Unknown" ? item.predicted_impact : "N/A"}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="text-tv-text-secondary">Actual:</span>
                                            {item.actual_impact ? (
                                                <span className={`font-mono font-bold ${item.actual_impact.includes('+') ? 'text-emerald-500' : item.actual_impact.includes('-') ? 'text-rose-500' : 'text-tv-text-primary'}`}>
                                                    {item.actual_impact}
                                                </span>
                                            ) : (
                                                <span className="text-tv-text-secondary animate-pulse flex items-center gap-1">
                                                    <Loader2 size={8} className="animate-spin" /> Observing market...
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* AI News Explainer (The USP) */}
                                {item.explainer && (
                                    <div className="mt-1 p-3 rounded-lg bg-gradient-to-br from-[#2962FF]/10 to-[#BB1DDF]/10 border border-[#2962FF]/20 relative overflow-hidden group shadow-lg shadow-[#000]/20">
                                        <div className="absolute top-0 right-0 p-1 bg-gradient-to-l from-[#2962FF] to-[#BB1DDF] rounded-bl-lg opacity-80 group-hover:opacity-100 transition-opacity">
                                            <Sparkles size={10} className="text-white animate-pulse" />
                                        </div>
                                        
                                        <div className="flex flex-col gap-2 relative z-10">
                                            <div className="flex items-center gap-1.5 uppercase tracking-tighter text-[9px] font-black text-[#2962FF]">
                                                <Zap size={10} fill="#2962FF" />
                                                AI Explainer
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <div>
                                                    <div className="text-[10px] font-bold text-tv-text-primary flex items-center gap-1 mb-0.5">
                                                        <Lightbulb size={10} className="text-yellow-400" />
                                                        The Essence
                                                    </div>
                                                    <p className="text-[10px] text-tv-text-secondary leading-relaxed">
                                                        {item.explainer.essence}
                                                    </p>
                                                </div>
                                                
                                                <div className="p-2 bg-black/40 rounded border border-white/5 backdrop-blur-md">
                                                    <span className="text-[9px] font-black uppercase text-tv-text-secondary block mb-1 font-mono">Stock Analogy</span>
                                                    <p className="text-[10px] text-[#2962FF] italic leading-tight">
                                                        "{item.explainer.analogy}"
                                                    </p>
                                                </div>

                                                <div className="pt-1 border-t border-[#2962FF]/10">
                                                    <span className="text-[10px] text-tv-text-primary px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full inline-block font-black tracking-tight">
                                                        💡 {item.explainer.golden_rule}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Q&A Section */}
                                <div className="mt-2 flex flex-col gap-2">
                                    <div className="flex items-center gap-1.5 border-b border-tv-border/50 pb-1">
                                        <MessageSquare size={12} className="text-tv-text-secondary" />
                                        <span className="text-[10px] font-semibold text-tv-text-secondary uppercase tracking-wider">Ask FinGPT</span>
                                    </div>
                                    
                                    {/* History */}
                                    {item.qa_history && item.qa_history.length > 0 && (
                                        <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-1">
                                            {item.qa_history.map((qa, qId) => (
                                                <div key={qId} className="flex flex-col gap-1 text-[10px]">
                                                    <div className="font-medium text-tv-text-primary border-l-2 border-tv-primary pl-1.5">Q: {qa.question}</div>
                                                    <div className="text-tv-text-secondary pl-2 text-justify">A: {qa.answer}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Input */}
                                    <div className="flex items-center gap-1">
                                        <input 
                                            type="text" 
                                            placeholder="Ask about sector impact..." 
                                            className="flex-1 bg-tv-bg-base border border-tv-border rounded px-2 py-1 text-[10px] text-tv-text-primary focus:outline-none focus:border-tv-primary"
                                            value={qInputs[item.id] || ''}
                                            onChange={e => setQInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                            onKeyDown={e => { if(e.key === 'Enter') handleAsk(item.id); }}
                                            disabled={loadingQAs[item.id]}
                                        />
                                        <button 
                                            onClick={() => handleAsk(item.id)}
                                            disabled={loadingQAs[item.id] || !qInputs[item.id]?.trim()}
                                            className="p-1 bg-tv-primary hover:bg-[#1E53E5] text-white rounded disabled:opacity-50 transition-colors"
                                        >
                                            {loadingQAs[item.id] ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NewsPanel;
