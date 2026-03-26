import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Maximize2, Minimize2, ExternalLink, Bot, User } from 'lucide-react';
import { sendChatQuery, fetchSuggestedTopics } from '../../services/chatApi';
import type { ChatMessage } from '../../services/chatApi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      if (inputValue) {
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
      } else {
        textareaRef.current.style.height = '44px';
      }
    }
  }, [inputValue]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, suggestions]);

  // Initial welcome message and health check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const { checkBotHealth } = await import('../../services/chatApi');
        const online = await checkBotHealth();
        setIsOnline(online);
      } catch (e) {
        setIsOnline(false);
      } finally {
        setIsCheckingHealth(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: 'Hello! I am TradeGuide, your AI trading assistant. How can I help you navigate the platform or understand the markets today?'
        }
      ]);
      loadInitialSuggestions();
    }

    return () => clearInterval(interval);
  }, [isOpen]);

  const loadInitialSuggestions = async () => {
    const defaultSuggestions = await fetchSuggestedTopics('welcome');
    if (defaultSuggestions.length > 0) {
      setSuggestions(defaultSuggestions);
    } else {
      setSuggestions(["What is the MACD?", "How do I use Replay mode?", "Show me Multibagger stocks."]);
    }
  };

  const handleSend = async (text: string = inputValue) => {
    if (!text.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setSuggestions([]); // clear suggestions while loading

    try {
      const result = await sendChatQuery(text, sessionId);
      
      // Update session tracking natively
      if (result.session_id) {
        setSessionId(result.session_id);
      }

      const botMessage: ChatMessage = {
        role: 'assistant',
        content: result.response,
        sources: result.sources,
        actions: result.actions
      };
      
      setMessages(prev => [...prev, botMessage]);
      setSuggestions(result.suggested_questions || []);

    } catch (err) {
      toast.error("Failed to reach TradeGuide AI. Is the backend running?");
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I am currently offline or experiencing network latency.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const executeAction = (action: {type: string, payload: string}) => {
    if (action.type === 'OPEN_LEARN') {
      toast.success(`Navigating to Learn: ${action.payload}`);
      navigate(`/learn?topic=${encodeURIComponent(action.payload)}`);
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 text-white transition-all hover:scale-110 z-50 flex items-center justify-center group"
      >
        <MessageCircle size={28} className="group-hover:rotate-12 transition-transform" />
      </button>
    );
  }

  return (
    <div 
      className={`fixed bottom-6 right-6 flex flex-col bg-[#0f0f0f] border border-gray-800 rounded-md shadow-2xl z-50 transition-all duration-300 overflow-hidden
        ${isExpanded ? 'w-[800px] h-[80vh] right-1/2 translate-x-1/2 bottom-[10vh]' : 'w-[400px] h-[600px]'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#141414] to-[#1a1a1a] border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Bot size={22} className={isOnline ? "text-emerald-400" : "text-gray-500"} />
          </div>
          <div>
            <h3 className="text-gray-100 font-semibold text-sm">TradeGuide AI</h3>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isCheckingHealth || isLoading ? 'bg-yellow-500 animate-pulse' : isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-gray-400 text-xs">
                {isCheckingHealth ? 'Connecting...' : (isLoading && messages.length > 1 ? 'Generating...' : (isOnline ? 'Online • Local Node' : 'Offline • Service Down'))}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-800">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-300'}`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`flex flex-col gap-1 max-w-[80%]`}>
              <div 
                className={`p-3 rounded-md text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-sm' 
                    : 'bg-[#1a1a1a] border border-gray-800 text-gray-200 rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>

              {/* Citations & Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {msg.sources.map((src, i) => (
                    <a 
                      key={i} 
                      href={src.url} 
                      className="flex items-center gap-1 text-[11px] bg-gray-900/50 border border-gray-700/50 text-gray-400 px-2 py-1 rounded hover:text-emerald-400 hover:border-emerald-400/50 transition-colors"
                    >
                      <ExternalLink size={10} />
                      {src.title}
                    </a>
                  ))}
                </div>
              )}

              {/* Bot Dynamic Actions */}
              {msg.actions && msg.actions.map((act, i) => (
                <button
                  key={i}
                  onClick={() => executeAction(act)}
                  className="mt-2 w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors"
                >
                  🚀 Expand Concept: {act.payload.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
               <Bot size={16} className="text-gray-400" />
             </div>
             <div className="bg-[#1a1a1a] border border-gray-800 p-4 rounded-md rounded-tl-sm flex gap-1 items-center">
               <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce delay-75"></span>
               <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce delay-150"></span>
               <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce delay-300"></span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {suggestions.length > 0 && !isLoading && (
        <div className="px-4 pb-2 pt-2 bg-gradient-to-t from-[#0f0f0f] to-transparent flex gap-2 overflow-x-auto scrollbar-hide">
          {suggestions.map((sug, i) => (
            <button
              key={i}
              onClick={() => handleSend(sug)}
              className="whitespace-nowrap px-3 py-1.5 bg-[#1a1a1a] border border-gray-700 hover:border-blue-500/50 hover:bg-blue-500/10 text-gray-300 rounded-full text-xs transition-colors"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* Input Tray */}
      <div className="p-4 bg-[#141414] border-t border-gray-800">
        <div className="relative flex items-end">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask TradeGuide about strategy or indicators..."
            className="w-full bg-[#0a0a0a] border border-gray-800 text-gray-200 text-sm rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800"
            disabled={isLoading}
            rows={1}
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 bottom-[6px] p-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-800 text-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <Send size={16} className={isLoading ? 'opacity-50' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
};
