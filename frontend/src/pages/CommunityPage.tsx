import React, { useState } from 'react';
import { 
  Hash, 
  Settings, 
  MessageSquare, 
  Users, 
  Bell, 
  Search, 
  Plus, 
  Send, 
  AtSign, 
  Smile, 
  Paperclip,
  ChevronDown,
  Info
} from 'lucide-react';

const channels = [
  { id: '1', name: 'general', type: 'public' },
  { id: '2', name: 'trading-signals', type: 'public', unread: 3 },
  { id: '3', name: 'announcements', type: 'public' },
  { id: '4', name: 'bugs-reporting', type: 'public' },
  { id: '5', name: 'dev-chat', type: 'private' },
];

const messages = [
  { 
    id: '1', 
    user: 'Alex Rivera', 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex', 
    time: '10:24 AM', 
    content: "Hey everyone! Has anyone checked the recent BTC pump? Signals are looking bullish." 
  },
  { 
    id: '2', 
    user: 'Sarah Chen', 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', 
    time: '10:26 AM', 
    content: "Yeah, I'm seeing strong support at $65k. Might be a good entry point." 
  },
  { 
    id: '3', 
    user: 'TradeBot AI', 
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bot', 
    time: '10:30 AM', 
    content: "🚨 VOLATILITY ALERT: High trading volume detected in ETH/USDT." 
  },
  { 
    id: '4', 
    user: 'Jordan Smith', 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan', 
    time: '10:45 AM', 
    content: "Can someone help me with the API integration? I'm getting a 401 error." 
  },
];

const CommunityPage = () => {
  const [activeChannel, setActiveChannel] = useState(channels[0]);
  const [message, setMessage] = useState('');

  return (
    <div className="flex h-[calc(100vh-56px)] bg-white dark:bg-[#1a1d21] overflow-hidden">
      {/* Workspace Sidebar (Narrow) */}
      <div className="w-[64px] bg-[#121417] border-r border-white/5 flex flex-col items-center py-4 gap-4 shrink-0">
        <div className="w-12 h-12 bg-tv-primary rounded-xl flex items-center justify-center text-white font-bold text-xl cursor-pointer hover:rounded-2xl transition-all">
          TS
        </div>
        <div className="w-8 h-[2px] bg-white/10 rounded-full my-1" />
        <div className="w-12 h-12 bg-[#2a2d32] rounded-xl flex items-center justify-center text-white/60 hover:text-white cursor-pointer hover:rounded-2xl transition-all group">
          <Plus size={24} className="group-hover:scale-110 transition-transform" />
        </div>
      </div>

      {/* Channels Sidebar (Wide) */}
      <div className="w-[260px] bg-[#191b1f] border-r border-white/5 flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 cursor-pointer hover:bg-white/5 transition-colors">
          <h2 className="text-white font-bold flex items-center gap-1">
            Tradeshift Community <ChevronDown size={14} />
          </h2>
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60">
            <Settings size={16} />
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* Section: Threads, Mentions */}
          <div className="px-3 mb-6 flex flex-col gap-0.5">
            <button className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:bg-white/5 hover:text-white rounded-md transition-colors w-full text-left">
              <MessageSquare size={18} />
              <span className="text-sm font-medium">Threads</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:bg-white/5 hover:text-white rounded-md transition-colors w-full text-left">
              <AtSign size={18} />
              <span className="text-sm font-medium">Mentions & Reactions</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:bg-white/5 hover:text-white rounded-md transition-colors w-full text-left ">
              <Send size={18} />
              <span className="text-sm font-medium">Drafts & Sent</span>
            </button>
          </div>

          {/* Section: Channels */}
          <div className="mb-4">
            <div className="px-6 flex items-center justify-between group mb-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Channels</span>
              <Plus size={14} className="text-slate-500 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col gap-0.5 px-2">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors w-full text-left font-medium ${
                    activeChannel.id === ch.id 
                      ? 'bg-tv-primary text-white' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Hash size={16} className={activeChannel.id === ch.id ? 'text-white' : 'text-slate-500'} />
                  <span className="text-sm flex-1">{ch.name}</span>
                  {ch.unread && (
                    <span className="bg-red-500 text-[10px] h-4 w-4 rounded-full flex items-center justify-center text-white font-bold">
                      {ch.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Direct Messages */}
          <div className="mt-6">
            <div className="px-6 flex items-center justify-between group mb-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Direct Messages</span>
              <Plus size={14} className="text-slate-500 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col gap-0.5 px-2">
               <button className="flex items-center gap-2 px-4 py-1.5 text-slate-400 hover:bg-white/5 hover:text-white rounded-md transition-colors w-full text-left">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-bold">AC</div>
                  <span className="text-sm">Alex Rivera</span>
               </button>
               <button className="flex items-center gap-2 px-4 py-1.5 text-slate-400 hover:bg-white/5 hover:text-white rounded-md transition-colors w-full text-left">
                  <div className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center text-[10px] font-bold">SC</div>
                  <span className="text-sm">Sarah Chen</span>
               </button>
            </div>
          </div>
        </div>

        {/* Bottom Profile */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
            <div className="w-9 h-9 rounded-md bg-tv-primary flex items-center justify-center text-white font-bold relative">
              D
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#191b1f] rounded-full" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-white truncate">Dheeraj Kumar</span>
              <span className="text-[10px] text-slate-500 truncate">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#1a1d21]">
        {/* Chat Header */}
        <div className="h-12 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-2 overflow-hidden">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 px-2 py-1 rounded transition-colors whitespace-nowrap">
              <Hash size={18} className="text-slate-400" />
              {activeChannel.name}
              <ChevronDown size={14} className="text-slate-400" />
            </h3>
            <div className="w-[1px] h-4 bg-slate-200 dark:bg-white/10 mx-2 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-6 h-6 rounded border-2 border-white dark:border-[#1a1d21] bg-slate-200 dark:bg-white/10" />
                ))}
              </div>
              <span className="text-xs text-slate-500 font-medium">1,240 members</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-colors" title="View files">
              <Paperclip size={20} />
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-colors" title="Details">
              <Info size={20} />
            </button>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          {/* Welcome Message */}
          <div className="mb-4">
             <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-2">
                <Hash size={24} className="text-slate-600 dark:text-slate-400" />
             </div>
             <h1 className="text-2xl font-black text-slate-900 dark:text-white">Welcome to #{activeChannel.name}</h1>
             <p className="text-slate-500 mt-1 max-w-2xl">
                This is the very beginning of the <span className="text-tv-primary font-bold">#{activeChannel.name}</span> channel. 
                Use this space to share ideas, ask questions, and collaborate with other traders.
             </p>
          </div>

          <div className="h-[1px] bg-slate-200 dark:bg-white/5 flex items-center justify-center">
            <span className="bg-white dark:bg-[#1a1d21] px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Today</span>
          </div>

          {messages.map((m) => (
            <div key={m.id} className="flex gap-4 group">
              <img src={m.avatar} alt={m.user} className="w-9 h-9 rounded bg-slate-100 dark:bg-white/5 shrink-0" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 dark:text-white text-[15px] hover:underline cursor-pointer">{m.user}</span>
                  <span className="text-xs text-slate-400 font-medium">{m.time}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-[15px] leading-relaxed mt-0.5">
                  {m.content}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-4 pt-0">
          <div className="border-2 border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#222529] focus-within:border-slate-300 dark:focus-within:border-white/20 transition-all shadow-sm">
            <div className="flex items-center gap-1 p-1 border-b border-slate-100 dark:border-white/5">
               <button className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded"><b>B</b></button>
               <button className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded"><i>I</i></button>
               <button className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded"><s>S</s></button>
               <div className="w-[1px] h-4 bg-slate-200 dark:bg-white/10 mx-1" />
               <button className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded"><Plus size={16} /></button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Message #${activeChannel.name}`}
              className="w-full bg-transparent border-none focus:ring-0 p-3 text-[15px] text-slate-700 dark:text-slate-200 resize-none min-h-[80px]"
            />
            <div className="flex items-center justify-between p-2">
              <div className="flex items-center gap-0.5">
                <button className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded"><Plus size={18} /></button>
                <div className="w-[1px] h-4 bg-slate-200 dark:bg-white/10 mx-1" />
                <button className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded"><Smile size={18} /></button>
                <button className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded"><AtSign size={18} /></button>
              </div>
              <button 
                className={`p-2 rounded transition-all ${
                  message.trim() 
                    ? 'bg-tv-primary text-white scale-100' 
                    : 'bg-slate-200 dark:bg-white/5 text-slate-500 cursor-not-allowed scale-95'
                }`}
                disabled={!message.trim()}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
             <span className="text-[11px] text-slate-500 italic">Sarah is typing...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityPage;
