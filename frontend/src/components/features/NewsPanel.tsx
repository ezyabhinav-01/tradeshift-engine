import React, { useState } from 'react';
import { Newspaper, Loader2, TrendingUp, TrendingDown, Minus, MessageSquare, Send, Activity, Sparkles, Lightbulb, Zap, Clock, ExternalLink } from 'lucide-react';
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
                newLoadings[item.id] = false;
                changed = true;
            }
        });
        if (changed) setLoadingQAs(newLoadings);
    }, [newsItems, loadingQAs]);

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-white/5">
            {/* Professional Header */}
            <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-black/40 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Newspaper size={18} className="text-primary" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Market Pulse</span>
                        <div className="flex items-center gap-1.5">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                            </span>
                            <span className="text-[8px] font-bold text-red-500 uppercase tracking-widest">Live Wire</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                   <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                     {newsItems.length} Stories
                   </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar bg-gradient-to-b from-transparent to-black/20">
                {newsItems.length === 0 && (
                    <div className="text-xs text-tv-text-secondary text-center py-8">
                        No news for this session yet. Waiting for simulation...
                    </div>
                )}
                {newsItems.map((item, i) => {
                    const isNew = i === 0;
                    return (
                        <div key={item.id} className={`group relative p-4 rounded-md border transition-all duration-300 ${
                            isNew 
                            ? 'bg-gradient-to-br from-white/[0.05] to-transparent border-white/10 shadow-xl shadow-black/50' 
                            : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                        }`}>
                            {/* News Source & Meta */}
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-primary text-black">
                                        {item.source || 'REUTERS'}
                                    </span>
                                    {isNew && (
                                        <span className="text-[8px] font-black text-primary animate-pulse uppercase tracking-wider">Just In</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 text-gray-500">
                                    <Clock size={10} />
                                    <span className="text-[9px] font-bold uppercase tracking-wider">{item.time_str}</span>
                                </div>
                            </div>

                            {/* Title */}
                            <h4 className="text-sm font-bold text-white leading-tight mb-3 group-hover:text-primary transition-colors">
                                {item.title}
                            </h4>
                            
                            {/* Initial Analysis phase */}
                            {item.analysis === "Analyzing impact..." ? (
                                <div className="flex items-center text-[10px] text-[#2962FF] gap-1.5 animate-pulse py-2">
                                    <Loader2 size={12} className="animate-spin" />
                                    <span>FinGPT analyzing impact...</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 mt-1">
                                    {/* FinGPT Impact Section */}
                                    <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex flex-col gap-2 ring-1 ring-white/5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Sparkles size={11} className="text-primary" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">FinGPT Sentiment</span>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1
                                                ${item.sentiment === 'POSITIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                  item.sentiment === 'NEGATIVE' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 
                                                  'bg-blue-500/10 text-blue-400 border border-blue-500/20'}
                                            `}>
                                                {item.sentiment === 'POSITIVE' ? <TrendingUp size={10} /> : 
                                                 item.sentiment === 'NEGATIVE' ? <TrendingDown size={10} /> : <Minus size={10} />}
                                                {item.sentiment}
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-gray-300 leading-relaxed font-medium">
                                            {item.analysis}
                                        </p>
                                    </div>

                                    {/* Impact Quantization Section */}
                                    {(item.predicted_impact || item.actual_impact) && (
                                        <div className="flex flex-col gap-2 mt-2 p-3 bg-gradient-to-r from-blue-500/5 to-transparent rounded-xl border border-blue-500/10 overflow-hidden relative">
                                            <div className="absolute right-0 top-0 h-full w-24 bg-blue-500/5 blur-2xl pointer-events-none"></div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="p-1 bg-blue-500/20 rounded">
                                                    <Activity size={12} className="text-blue-400" />
                                                </div>
                                                <span className="text-[10px] font-black text-white uppercase tracking-wider">Quantized Impact</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 relative z-10">
                                                <div className="space-y-0.5">
                                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Predicted</span>
                                                    <div className="text-xs font-mono font-bold text-white">{item.predicted_impact !== "Unknown" ? item.predicted_impact : "CALCULATING..."}</div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Actual</span>
                                                    {item.actual_impact ? (
                                                        <div className={`text-xs font-mono font-black ${item.actual_impact.includes('+') ? 'text-emerald-400' : item.actual_impact.includes('-') ? 'text-rose-400' : 'text-white'}`}>
                                                            {item.actual_impact}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[9px] text-blue-400 flex items-center gap-1.5 font-bold animate-pulse uppercase">
                                                            <Loader2 size={10} className="animate-spin" /> Live Tapping
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* AI News Explainer (The USP) */}
                                    {item.explainer && (
                                        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5 relative overflow-hidden group/explainer">
                                            <div className="absolute top-0 right-0 p-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-bl-lg opacity-40 group-hover/explainer:opacity-100 transition-opacity">
                                                <Sparkles size={10} className="text-white" />
                                            </div>
                                            
                                            <div className="space-y-3 relative z-10">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1 bg-indigo-500/20 rounded">
                                                        <Lightbulb size={12} className="text-indigo-400" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Insider Analysis</span>
                                                </div>
                                                
                                                <div className="space-y-2.5">
                                                    <p className="text-[11px] text-gray-400 leading-relaxed">
                                                        {item.explainer.essence}
                                                    </p>
                                                    
                                                    <div className="pl-3 border-l-2 border-primary/30">
                                                        <p className="text-[10px] text-primary italic font-medium leading-relaxed">
                                                            "{item.explainer.analogy}"
                                                        </p>
                                                    </div>

                                                    <div className="flex items-start gap-2 p-2.5 bg-white/[0.03] rounded-lg border border-white/5">
                                                        <Zap size={12} className="text-amber-400 shrink-0 mt-0.5" />
                                                        <span className="text-[10px] text-gray-300 font-bold leading-snug">
                                                            {item.explainer.golden_rule}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Q&A Section */}
                                    <div className="mt-4 pt-4 border-t border-white/5">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare size={12} className="text-gray-500" />
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ask Analyst</span>
                                            </div>
                                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-white transition-colors">
                                                <ExternalLink size={12} />
                                            </a>
                                        </div>
                                        
                                        {/* History */}
                                        {item.qa_history && item.qa_history.length > 0 && (
                                            <div className="flex flex-col gap-3 mb-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                                {item.qa_history.map((qa, qId) => (
                                                    <div key={qId} className="space-y-1.5">
                                                        <div className="text-[10px] font-bold text-white pl-2 border-l-2 border-primary">Q: {qa.question}</div>
                                                        <div className="text-[10px] text-gray-400 pl-2 leading-relaxed text-justify">A: {qa.answer}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
     
                                        {/* Input */}
                                        <div className="relative group/input">
                                            <input 
                                                type="text" 
                                                placeholder="Ask about sector impact..." 
                                                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 pr-10 text-[10px] text-white placeholder:text-gray-600 focus:outline-none focus:border-primary transition-all"
                                                value={qInputs[item.id] || ''}
                                                onChange={e => setQInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                onKeyDown={e => { if(e.key === 'Enter') handleAsk(item.id); }}
                                                disabled={loadingQAs[item.id]}
                                            />
                                            <button 
                                                onClick={() => handleAsk(item.id)}
                                                disabled={loadingQAs[item.id] || !qInputs[item.id]?.trim()}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-black rounded-lg hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                                            >
                                                {loadingQAs[item.id] ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default NewsPanel;
