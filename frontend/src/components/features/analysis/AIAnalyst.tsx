import React, { useState } from 'react';
import axios from 'axios';
import { 
  ChevronRight, 
  RotateCcw, 
  BrainCircuit, 
  ShieldCheck, 
  Lightbulb,
  MessageSquareQuote,
  Send,
  User
} from 'lucide-react';

interface AIAnalystProps {
  symbol: string;
  isLaymanMode: boolean;
}

// No API_BASE needed when using proxy for relative paths

const AIAnalyst: React.FC<AIAnalystProps> = ({ symbol, isLaymanMode }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [laymanExplanation, setLaymanExplanation] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [isSimplifying, setIsSimplifying] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const performAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const response = await axios.post(`/api/stock/${symbol}/analyze`);
      setAnalysis(response.data.analysis);
      setLaymanExplanation(null); // Reset explanation when new analysis comes
      setChatHistory([]); // Reset chat when new analysis is generated
    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getLaymanExplanation = async () => {
    if (!analysis) return;
    setIsSimplifying(true);
    try {
      const response = await axios.post(`/api/stock/${symbol}/explain`, {
        text: analysis
      });
      setLaymanExplanation(response.data.explanation);
    } catch (error) {
      console.error("Layman simplification failed:", error);
    } finally {
      setIsSimplifying(false);
    }
  };

  // Auto-simplify if layman mode is toggled and we have analysis but no explanation
  React.useEffect(() => {
    if (isLaymanMode && analysis && !laymanExplanation && !isSimplifying) {
      getLaymanExplanation();
    }
  }, [isLaymanMode, analysis]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || isSending) return;

    const newMessage = { role: 'user' as const, content: chatInput };
    setChatHistory(prev => [...prev, newMessage]);
    setChatInput("");
    setIsSending(true);

    try {
      const response = await axios.post(`/api/stock/${symbol}/chat`, {
        question: newMessage.content,
        history: chatHistory
      });
      setChatHistory(prev => [...prev, { role: 'assistant', content: response.data.answer }]);
    } catch (error) {
      console.error("Chat failed:", error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: "Failed to connect to the educational engine. Please try again." }]);
    } finally {
      setIsSending(false);
    }
  };

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, analysis, laymanExplanation]);

  // Auto-generate analysis on mount or symbol change
  React.useEffect(() => {
    performAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  if (!analysis && !isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/5 border-dashed rounded-3xl space-y-4 text-center h-[600px] shadow-sm dark:shadow-none">
        <div className="p-4 bg-primary/10 rounded-full">
          <BrainCircuit className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Deep AI Thesis Pending</h3>
          <p className="text-gray-500 text-sm max-w-xs">
            Ask FinGPT to scan all fundamentals to generate a high-conviction investment thesis.
          </p>
        </div>
        <button 
          onClick={performAnalysis}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-black rounded-xl font-bold hover:scale-105 transition-transform"
        >
          Generate AI Thesis
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const currentContent = isLaymanMode ? (laymanExplanation || "Simplifying for you...") : analysis;
  const isLoading = isAnalyzing || (isLaymanMode && isSimplifying);

  return (
    <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-none rounded-3xl overflow-hidden flex flex-col h-[600px]">
      <div className="p-5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-white/[0.02]">
        <div className="flex items-center gap-2">
          {isLaymanMode ? (
            <BrainCircuit className="w-5 h-5 text-green-600 dark:text-green-500" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-primary" />
          )}
          <span className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">
            {isLaymanMode ? "AI ANALYST (LAYMAN)" : "INSTITUTIONAL GRADE THESIS"}
          </span>
        </div>
        <button 
          onClick={performAnalysis}
          className="p-2 hover:bg-gray-200 dark:hover:bg-white/5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          title="Regenerate Analysis"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {isLoading ? (
          <div className="space-y-4 py-8">
            <div className="h-4 bg-white/5 rounded-full w-3/4 animate-pulse"></div>
            <div className="h-4 bg-white/5 rounded-full w-full animate-pulse"></div>
            <div className="h-4 bg-white/5 rounded-full w-5/6 animate-pulse"></div>
            <div className="h-4 bg-white/5 rounded-full w-2/3 animate-pulse"></div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="text-black dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {currentContent?.includes('<!DOCTYPE html>') || currentContent?.includes('<html') || currentContent?.includes('401') ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex flex-col gap-2">
                  <span className="font-bold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> AI Engine Unavailable
                  </span>
                  <span>The AI analysis engine is currently unavailable. This is usually caused by missing or invalid API keys (e.g., HuggingFace). Please check your backend configuration.</span>
                </div>
              ) : currentContent?.split('###').map((section, idx) => {
                if (!section.trim()) return null;
                const isVarsity = section.includes('VARSITY LESSON');
                
                return (
                  <div key={idx} className={`mb-6 p-1 ${isVarsity ? 'bg-amber-500/5 border border-amber-500/20 rounded-md p-6 shadow-[0_0_20px_-5px_rgba(245,158,11,0.1)]' : ''}`}>
                    {idx > 0 && <h3 className={`text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${isVarsity ? 'text-amber-400' : 'text-primary'}`}>
                      {isVarsity ? <Lightbulb className="w-4 h-4" /> : <ChevronRight className="w-3 h-3" />}
                      {section.split('\n')[0].replace('###', '').trim()}
                    </h3>}
                    <div className={`${isVarsity ? 'text-gray-200 italic dark:text-gray-300' : 'text-black dark:text-gray-300'}`}>
                      {section.split('\n').slice(1).join('\n').trim()}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Chat History */}
            {chatHistory.length > 0 && (
              <div className="mt-8 space-y-4 border-t border-gray-200 dark:border-white/5 pt-6">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                  <MessageSquareQuote className="w-3.5 h-3.5" />
                  Q&A Sessions
                </h4>
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                        <BrainCircuit className="w-3 h-3 text-primary" />
                      </div>
                    )}
                    <div className={`p-3 rounded-md max-w-[85%] text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-gray-900 text-white dark:bg-white/10 dark:text-white rounded-tr-sm' 
                        : 'bg-primary/5 border border-primary/20 dark:border-primary/10 text-black dark:text-gray-300 rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center shrink-0 mt-1">
                        <User className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                      </div>
                    )}
                  </div>
                ))}
                {isSending && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                      <BrainCircuit className="w-3 h-3 text-primary animate-pulse" />
                    </div>
                    <div className="p-3 rounded-md bg-primary/5 border border-primary/10 rounded-tl-sm">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/5 backdrop-blur-md">
        <form onSubmit={handleSendMessage} className="relative flex items-center">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={isSending || isLoading || !analysis}
            placeholder="Ask a question about this analysis..."
            className="w-full bg-white dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-600 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50 shadow-inner dark:shadow-none"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || isSending || isLoading || !analysis}
            className="absolute right-2 p-1.5 bg-primary text-black rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      <div className="px-4 pb-3 pt-1 bg-gray-50 dark:bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
          <MessageSquareQuote className="w-3.5 h-3.5" />
          Powered by FinGPT Engine v2.0
        </div>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500/50"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500/20"></div>
        </div>
      </div>
    </div>
  );
};

export default AIAnalyst;
