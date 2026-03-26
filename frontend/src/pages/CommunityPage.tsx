import React, { useState, useEffect, useRef } from 'react';
import { 
  Hash, 
  Settings, 
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
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface Channel {
  id: number;
  name: string;
  description?: string;
  type: string;
  unread?: number;
}

interface Message {
  id: number;
  content: string;
  sender_id: number;
  sender_name?: string;
  timestamp: string;
  channel_id?: number;
  recipient_id?: number;
  avatar?: string; // We can generate this based on name
}

interface CommunityUser {
  id: number;
  full_name: string;
  email: string;
  is_online: boolean;
}

const CommunityPage = () => {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [communityUsers, setCommunityUsers] = useState<CommunityUser[]>([]);
  const [activeDMUser, setActiveDMUser] = useState<CommunityUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const ws = useRef<WebSocket | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [channelsRes, usersRes] = await Promise.all([
          axios.get('/api/community/channels'),
          axios.get('/api/community/users')
        ]);
        
        setChannels(channelsRes.data);
        setCommunityUsers(usersRes.data);
        
        if (channelsRes.data.length > 0) {
          setActiveChannel(channelsRes.data[0]);
        }
      } catch (error) {
        console.error('Error fetching community data:', error);
        toast.error('Failed to load community data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch messages when active target changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeChannel && !activeDMUser) return;
      
      try {
        let res;
        if (activeChannel) {
          res = await axios.get(`/api/community/channels/${activeChannel.id}/messages`);
        } else if (activeDMUser) {
          res = await axios.get(`/api/community/direct-messages/${activeDMUser.id}`);
        }
        
        if (res) {
          setMessages(res.data);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
  }, [activeChannel, activeDMUser]);

  // WebSocket Connection
  useEffect(() => {
    if (!user) return;

    // Use a simplified connection logic
    const connectWS = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/orders`; // Reusing existing ws endpoint or could be community specific
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        socket.send(JSON.stringify({ user_id: user.id }));
      };

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === 'community_message' || payload.type === 'direct_message') {
          const newMessage = payload.data;
          
          // Check if message belongs to current view
          if (activeChannel && newMessage.channel_id === activeChannel.id) {
            setMessages(prev => [...prev, newMessage]);
          } else if (activeDMUser && (
            (newMessage.sender_id === activeDMUser.id && newMessage.recipient_id === user.id) ||
            (newMessage.sender_id === user.id && newMessage.recipient_id === activeDMUser.id)
          )) {
            setMessages(prev => [...prev, newMessage]);
          } else {
            // Logic for unread badges could go here
            if (newMessage.channel_id) {
                 setChannels(prev => prev.map(ch => 
                    ch.id === newMessage.channel_id ? { ...ch, unread: (ch.unread || 0) + 1 } : ch
                 ));
            }
          }
        }
      };

      socket.onclose = () => {
        setTimeout(connectWS, 3000); // Reconnect
      };

      ws.current = socket;
    };

    connectWS();
    return () => ws.current?.close();
  }, [user, activeChannel, activeDMUser]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user) return;

    try {
      const payload: any = {
        content: messageText,
      };

      if (activeChannel) {
        payload.channel_id = activeChannel.id;
      } else if (activeDMUser) {
        payload.recipient_id = activeDMUser.id;
      }

      await axios.post('/api/community/messages', payload);
      
      // If WS is not broadcasting back to sender, we add it manually
      // But our backend's emit_to_channel broadcasts to everyone including sender
      // and emit_to_user for DMs sends to both sender and recipient.
      // So the message will come back via WS. We just clear the input.
      
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-[calc(100vh-56px)] bg-white dark:bg-[#1a1d21] overflow-hidden">
      {/* Workspace Sidebar (Narrow) */}
      <div className="w-[64px] bg-slate-100 dark:bg-[#121417] border-r border-slate-200 dark:border-white/5 flex flex-col items-center py-4 gap-4 shrink-0">
        <div className="w-12 h-12 bg-tv-primary rounded-xl flex items-center justify-center text-white font-bold text-xl cursor-pointer hover:rounded-md transition-all shadow-sm dark:shadow-none">
          TS
        </div>
        <div className="w-8 h-[2px] bg-slate-300 dark:bg-white/10 rounded-full my-1" />
        <div className="w-12 h-12 bg-white dark:bg-[#2a2d32] border border-slate-200 dark:border-transparent rounded-xl flex items-center justify-center text-slate-400 dark:text-white/60 hover:text-tv-primary dark:hover:text-white shadow-sm dark:shadow-none cursor-pointer hover:rounded-md transition-all group">
          <Plus size={24} className="group-hover:scale-110 transition-transform" />
        </div>
      </div>

      {/* Channels Sidebar (Wide) */}
      <div className="w-[260px] bg-slate-50 dark:bg-[#191b1f] border-r border-slate-200 dark:border-white/5 flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="h-12 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
          <h2 className="text-slate-900 dark:text-white font-bold flex items-center gap-1">
            Tradeshift Community <ChevronDown size={14} />
          </h2>
          <div className="w-8 h-8 rounded-full hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 dark:text-white/60">
            <Settings size={16} />
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* Section: Channels */}
          <div className="mb-4">
            <div className="px-6 flex items-center justify-between group mb-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Channels</span>
              <Plus size={14} className="text-slate-500 hover:text-slate-700 dark:hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col gap-0.5 px-2">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    setActiveChannel(ch);
                    setActiveDMUser(null);
                    // Clear unread
                    setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, unread: 0 } : c));
                  }}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors w-full text-left font-medium ${
                    activeChannel?.id === ch.id 
                      ? 'bg-tv-primary text-white' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Hash size={16} className={activeChannel?.id === ch.id ? 'text-white' : 'text-slate-400 dark:text-slate-500'} />
                  <span className="text-sm flex-1 truncate">{ch.name}</span>
                  {ch.unread ? (
                    <span className="bg-red-500 text-[10px] h-4 w-4 rounded-full flex items-center justify-center text-white font-bold">
                      {ch.unread}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Direct Messages */}
          <div className="mt-6">
            <div className="px-6 flex items-center justify-between group mb-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Direct Messages</span>
              <Plus size={14} className="text-slate-500 hover:text-slate-700 dark:hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col gap-0.5 px-2">
              {communityUsers.map((u) => (
                <button 
                  key={u.id}
                  onClick={() => {
                    setActiveDMUser(u);
                    setActiveChannel(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors w-full text-left font-medium ${
                    activeDMUser?.id === u.id 
                      ? 'bg-tv-primary text-white' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${u.is_online ? 'bg-green-500/20 text-green-500 dark:text-green-400' : 'bg-slate-500/20 text-slate-500 dark:text-slate-400'}`}>
                    {getInitials(u.full_name)}
                  </div>
                  <span className="text-sm truncate flex-1">{u.full_name}</span>
                  {u.is_online && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Profile */}
        <div className="p-4 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-200 dark:bg-white/5 cursor-pointer dark:hover:bg-white/10 transition-colors">
            <div className="w-9 h-9 rounded-md bg-tv-primary flex items-center justify-center text-white font-bold relative">
              {user?.full_name ? getInitials(user.full_name) : 'U'}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-slate-50 dark:border-[#191b1f] rounded-full" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.full_name || 'Loading...'}</span>
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
              {activeChannel ? <Hash size={18} className="text-slate-400" /> : <AtSign size={18} className="text-slate-400" />}
              {activeChannel?.name || activeDMUser?.full_name || 'Select a channel'}
              <ChevronDown size={14} className="text-slate-400" />
            </h3>
            <div className="w-[1px] h-4 bg-slate-200 dark:bg-white/10 mx-2 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">{activeChannel ? 'Community Channel' : 'Direct Message'}</span>
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
          {(activeChannel || activeDMUser) && messages.length === 0 && !isLoading && (
            <div className="mb-4">
              <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-2">
                  {activeChannel ? <Hash size={24} className="text-slate-600 dark:text-slate-400" /> : <AtSign size={24} className="text-slate-600 dark:text-slate-400" />}
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                Welcome to {activeChannel ? `#${activeChannel.name}` : activeDMUser?.full_name}
              </h1>
              <p className="text-slate-500 mt-1 max-w-2xl">
                  This is the very beginning of your conversation with <span className="text-tv-primary font-bold">{activeChannel ? `#${activeChannel.name}` : activeDMUser?.full_name}</span>.
                  Let's start collaborating!
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tv-primary"></div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex gap-4 group">
                <div className="w-9 h-9 rounded bg-tv-primary/10 text-tv-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {getInitials(m.sender_name || 'U')}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white text-[15px] hover:underline cursor-pointer">{m.sender_name}</span>
                    <span className="text-xs text-slate-400 font-medium">{formatDate(m.timestamp)}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-[15px] leading-relaxed mt-0.5">
                    {m.content}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messageEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 pt-0">
          <div className="border-2 border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#222529] focus-within:border-slate-300 dark:focus-within:border-white/20 transition-all shadow-sm">
            
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Message ${activeChannel ? `#${activeChannel.name}` : activeDMUser?.full_name || ''}`}
              className="w-full bg-transparent border-none focus:ring-0 p-3 text-[15px] text-slate-700 dark:text-slate-200 resize-none min-h-[80px]"
            />
            <div className="flex items-center justify-between p-2">
              <div className="flex items-center gap-0.5 relative">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={(e) => {
                    if(e.target.files && e.target.files.length > 0) {
                      toast.success(`Attached file: ${e.target.files[0].name}`);
                    }
                  }} 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded"
                  title="Attach file"
                >
                  <Plus size={18} />
                </button>
                <div className="w-[1px] h-4 bg-slate-200 dark:bg-white/10 mx-1" />
                <button 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded"
                  title="Add emoji"
                >
                  <Smile size={18} />
                </button>
                
                {showEmojiPicker && (
                  <div className="absolute bottom-10 left-8 bg-white dark:bg-[#2a2d32] border border-slate-200 dark:border-white/10 shadow-lg rounded-lg p-2 flex gap-2 z-50">
                    {['😀', '😂', '🔥', '👍', '🚀', '👀'].map(emoji => (
                      <button 
                        key={emoji}
                        className="hover:bg-slate-100 dark:hover:bg-white/5 p-1 rounded text-xl"
                        onClick={() => {
                          setMessageText(prev => prev + emoji);
                          setShowEmojiPicker(false);
                          textareaRef.current?.focus();
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                <button 
                  onClick={() => {
                    setMessageText(prev => prev + '@');
                    textareaRef.current?.focus();
                  }}
                  className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded"
                  title="Mention someone"
                >
                  <AtSign size={18} />
                </button>
              </div>
              <button 
                onClick={handleSendMessage}
                className={`p-2 rounded transition-all ${
                  messageText.trim() 
                    ? 'bg-tv-primary text-white scale-100' 
                    : 'bg-slate-200 dark:bg-white/5 text-slate-500 cursor-not-allowed scale-95'
                }`}
                disabled={!messageText.trim()}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityPage;
