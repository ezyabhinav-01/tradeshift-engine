import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Hash,
  Settings,
  Plus,
  Send,
  AtSign,
  Smile,
  Paperclip,
  ChevronDown,
  Info,
  X,
  Search,
  MessageSquare,
  Users,
  Loader2,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  client_temp_id?: number;
  delivery_status?: 'sending' | 'sent' | 'failed';
}

interface CommunityUser {
  id: number;
  full_name: string;
  email: string;
  is_online: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

// Backend stores datetime.utcnow() with no 'Z' suffix.
// Appending 'Z' forces the browser to parse it as UTC before converting to IST.
const ensureUTC = (iso: string) =>
  iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`;

const formatTime = (iso: string) =>
  new Date(ensureUTC(iso)).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

const formatDateGroup = (iso: string) => {
  const d = new Date(ensureUTC(iso));
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata' };
  const toDate = (dt: Date) =>
    new Intl.DateTimeFormat('en-IN', { ...opts, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
  const today = toDate(new Date());
  const yesterday = toDate(new Date(Date.now() - 86400000));
  const msgDay = toDate(d);
  if (msgDay === today) return 'Today';
  if (msgDay === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
};

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#ef4444', '#84cc16',
];
const getAvatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

// ─── Login Prompt Modal ───────────────────────────────────────────────────────

const LoginPromptModal = () => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-sm rounded-[2rem] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-[#1e2128]"
      >
        {/* Icon */}
        <div className="flex flex-col items-center px-8 pt-10 pb-6 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
          >
            <Users size={30} className="text-indigo-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Join the Community</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Please log in to access channels, direct messages, and connect with other traders.
          </p>
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex flex-col gap-3">
          <a
            href="/login"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 bg-gradient-to-tr from-indigo-500 to-indigo-600 shadow-xl shadow-indigo-500/20"
          >
            Log In to Continue
          </a>
          <a
            href="/register"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-indigo-500/40 hover:text-indigo-500 transition-all"
          >
            Create an Account
          </a>
        </div>
      </div>
    </div>
  );
};

// ─── New DM Modal ─────────────────────────────────────────────────────────────

interface NewDMModalProps {
  onClose: () => void;
  onConfirm: (user: CommunityUser) => void;
}

const NewDMModal = ({ onClose, onConfirm }: NewDMModalProps) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<CommunityUser | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setFound(null);
    setError('');
    try {
      const res = await axios.get(`/api/community/users/lookup?q=${encodeURIComponent(query.trim())}`);
      setFound(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'No user found with that email or Demat ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-[#1e2128]"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10">
              <MessageSquare size={18} className="text-indigo-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">New Direct Message</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Enter recipient's Email or Demat ID</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal body */}
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setError(''); setFound(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="user@gmail.com or DEMAT123456"
              className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span>Find</span>
            </button>
          </div>

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              <AlertCircle size={15} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Found user */}
          {found && (
            <div className="rounded-xl border border-indigo-500/20 overflow-hidden bg-indigo-500/5">
              <div className="flex items-center gap-4 px-4 py-3.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg shadow-indigo-500/10"
                  style={{ background: getAvatarColor(found.id) }}
                >
                  {getInitials(found.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{found.full_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{found.email}</p>
                </div>
                <div className={`w-2 h-2 rounded-full shrink-0 ${found.is_online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </div>
              <div className="border-t border-indigo-500/10 px-4 py-3 flex justify-end">
                <button
                  onClick={() => onConfirm(found)}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold text-white cursor-pointer transition-all hover:bg-indigo-700 bg-indigo-600 shadow-xl shadow-indigo-500/20"
                >
                  <UserCheck size={15} />
                  Open Chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const CommunityPage = () => {
  const { user, loading } = useAuth();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeDMUser, setActiveDMUser] = useState<CommunityUser | null>(null);
  const [dmHistory, setDmHistory] = useState<CommunityUser[]>([]); // previously messaged users
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state

  const ws = useRef<WebSocket | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Scroll to bottom ────────────────────────────────────────────────────────
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Initial data: channels + persisted DM contacts ────────────────────────
  // Only fetch DM contacts when logged in — never expose other users' DMs to guests
  // only fetch when we definitively know the auth state
  useEffect(() => {
    if (loading) return;

    const fetchData = async () => {
      try {
        setIsInitializing(true);
        if (user) {
          const [channelsRes, dmContactsRes] = await Promise.all([
            axios.get('/api/community/channels'),
            axios.get('/api/community/dm-contacts'),
          ]);
          if (!isMountedRef.current) return;
          setChannels(channelsRes.data);
          if (channelsRes.data.length > 0) setActiveChannel(channelsRes.data[0]);
          if (dmContactsRes.data.length > 0) setDmHistory(dmContactsRes.data);
        } else {
          // Guest: clear any stale DM history and channels
          setDmHistory([]);
          setChannels([]);
          setActiveChannel(null);
          setActiveDMUser(null);
        }
      } catch {
        toast.error('Failed to load community data');
      } finally {
        if (isMountedRef.current) setIsInitializing(false);
      }
    };
    fetchData();
  }, [user, loading]);

  // ── Fetch messages whenever active target changes ────────────────────────────
  useEffect(() => {
    if (!activeChannel && !activeDMUser) return;

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      setMessages([]);
      try {
        let res;
        if (activeChannel) {
          res = await axios.get(`/api/community/channels/${activeChannel.id}/messages`);
        } else if (activeDMUser) {
          res = await axios.get(`/api/community/direct-messages/${activeDMUser.id}`);
        }
        if (isMountedRef.current && res) setMessages(res.data);
      } catch {
        toast.error('Failed to load messages');
      } finally {
        if (isMountedRef.current) setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [activeChannel, activeDMUser]);

  // ── WebSocket ────────────────────────────────────────────────────────────────
  const activeChannelRef = useRef(activeChannel);
  const activeDMUserRef = useRef(activeDMUser);
  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);
  useEffect(() => { activeDMUserRef.current = activeDMUser; }, [activeDMUser]);

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      // Deduplicate: skip if exact ID already present
      if (prev.some((m) => m.id === msg.id)) return prev;
      // If WS delivers the real message for our optimistic stub, replace it
      if (msg.id > 0) {
        const filtered = prev.filter((m) => !(m.id < 0 && m.content === msg.content && m.sender_id === msg.sender_id));
        return [...filtered, msg];
      }
      return [...prev, msg];
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let isAlive = true;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${proto}//${window.location.host}/ws/orders`);

      socket.onopen = () => {
        if (isAlive) socket.send(JSON.stringify({ user_id: user.id }));
      };

      socket.onmessage = (event) => {
        if (!isAlive) return;
        const payload = JSON.parse(event.data);
        if (payload.type === 'community_message_status') {
          const status = payload.data as { client_temp_id: number; saved: boolean; server_id?: number };
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== status.client_temp_id) return m;
              if (status.saved && status.server_id) {
                return { ...m, id: status.server_id, delivery_status: 'sent' };
              }
              return { ...m, delivery_status: 'failed' };
            })
          );
          return;
        }
        if (payload.type === 'community_message' || payload.type === 'direct_message') {
          const msg: Message = { ...payload.data, delivery_status: 'sent' };
          const curChannel = activeChannelRef.current;
          const curDM = activeDMUserRef.current;

          if (curChannel && msg.channel_id === curChannel.id) {
            appendMessage(msg);
          } else if (
            curDM &&
            ((msg.sender_id === curDM.id && msg.recipient_id === user.id) ||
              (msg.sender_id === user.id && msg.recipient_id === curDM.id))
          ) {
            appendMessage(msg);
          } else if (msg.channel_id) {
            setChannels((prev) =>
              prev.map((ch) =>
                ch.id === msg.channel_id ? { ...ch, unread: (ch.unread || 0) + 1 } : ch
              )
            );
          }
        }
      };

      socket.onclose = () => {
        if (isAlive) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.current = socket;
    };

    connect();

    return () => {
      isAlive = false;
      clearTimeout(reconnectTimer);
      ws.current?.close();
    };
  }, [user, appendMessage]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!messageText.trim() || !user) return;

    const content = messageText.trim();
    const tempId = -Date.now(); // negative so it never collides with real DB ids

    const payload: any = { content };
    if (activeChannel) payload.channel_id = activeChannel.id;
    else if (activeDMUser) payload.recipient_id = activeDMUser.id;
    else return;

    // ── 1. Show instantly (Optimistic UI) ──
    setMessageText('');
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        content,
        sender_id: user.id,
        sender_name: user.full_name || user.email || 'You',
        timestamp: new Date().toISOString(),
        channel_id: activeChannel?.id,
        recipient_id: activeDMUser?.id,
        delivery_status: 'sending' as const,
      },
    ]);

    try {
      // ── 2. Save to DB in background ──
      const res = await axios.post('/api/community/messages', payload);
      // Swap stub with real confirmed message (has the real DB id)
      setMessages((prev) => {
        // WS may have already delivered the real message
        if (prev.some((m) => m.id === res.data.id)) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? { ...res.data, delivery_status: 'sent' } : m));
      });
    } catch {
      // Mark as failed so user knows
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, delivery_status: 'failed' } : m))
      );
      toast.error('Failed to send message. Tap to retry.');
    }
  };

  // ── Open DM with a user ──────────────────────────────────────────────────────
  const openDM = (dmUser: CommunityUser) => {
    setActiveDMUser(dmUser);
    setActiveChannel(null);
    setShowNewDM(false);
    // maintain history of DM conversations
    setDmHistory((prev) => {
      if (prev.some((u) => u.id === dmUser.id)) return prev;
      return [dmUser, ...prev];
    });
  };

  // ── Group messages by date ───────────────────────────────────────────────────
  const grouped: { label: string; items: Message[] }[] = [];
  for (const msg of messages) {
    const label = formatDateGroup(msg.timestamp);
    const last = grouped[grouped.length - 1];
    if (last && last.label === label) last.items.push(msg);
    else grouped.push({ label, items: [msg] });
  }

  // While auth is resolving show a neutral loading spinner (not the login gate)
  if (loading && !user) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" style={{ background: '#0f1117' }}>
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-background">
      {/* Show login gate for unauthenticated users */}
      {!user && !loading && <LoginPromptModal />}

      {showNewDM && user && (
        <NewDMModal
          onClose={() => setShowNewDM(false)}
          onConfirm={(u) => openDM(u)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] flex flex-col shrink-0 border-r border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0a] transition-transform duration-300 lg:relative lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Workspace header */}
        <div
          className="h-13 flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/5 cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs bg-gradient-to-tr from-indigo-500 to-indigo-600"
            >
              TS
            </div>
            <span className="text-slate-900 dark:text-white font-bold text-sm flex items-center gap-1">
              Tradeshift <ChevronDown size={13} className="text-slate-400 dark:text-slate-500" />
            </span>
          </div>
          <Settings size={15} className="text-slate-500 group-hover:text-slate-300 transition-colors cursor-pointer" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto py-3 space-y-5 scrollbar-thin">

          {/* Channels section */}
          <section className="px-3">
            <div className="flex items-center justify-between px-2 mb-1.5 group">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Channels</span>
              <Plus size={13} className="text-slate-500 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-all" />
            </div>

            {isInitializing ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <Loader2 size={14} className="animate-spin text-slate-500" />
                <span className="text-xs text-slate-500">Loading…</span>
              </div>
            ) : (
              <div className="space-y-0.5">
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setActiveChannel(ch);
                      setActiveDMUser(null);
                      setIsSidebarOpen(false); // Close sidebar on mobile
                      setChannels((prev) => prev.map((c) => (c.id === ch.id ? { ...c, unread: 0 } : c)));
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-all cursor-pointer text-sm font-black group/ch ${
                      activeChannel?.id === ch.id
                        ? 'text-white bg-indigo-500 shadow-lg shadow-indigo-500/20'
                        : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Hash size={15} className={activeChannel?.id === ch.id ? 'text-indigo-400' : 'text-slate-500 group-hover/ch:text-slate-300'} />
                    <span className="flex-1 truncate">{ch.name}</span>
                    {ch.unread ? (
                      <span className="bg-red-500 text-[9px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center text-white font-bold">
                        {ch.unread}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Direct Messages section – only visible when logged in */}
          {user && (
            <section className="px-3">
              <div className="flex items-center justify-between px-2 mb-1.5 group">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Direct Messages</span>
                <button
                  onClick={() => setShowNewDM(true)}
                  className="text-slate-500 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                  title="New Direct Message"
                >
                  <Plus size={13} />
                </button>
              </div>

              {dmHistory.length === 0 ? (
                <button
                  onClick={() => setShowNewDM(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-dashed border-slate-200 dark:border-white/10 text-sm text-slate-500 hover:text-indigo-500 hover:border-indigo-500/40 transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>New message</span>
                </button>
              ) : (
                <div className="space-y-0.5">
                  {dmHistory.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        openDM(u);
                        setIsSidebarOpen(false); // Close sidebar on mobile
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-all cursor-pointer text-sm font-black ${
                        activeDMUser?.id === u.id 
                          ? 'text-white bg-indigo-500 shadow-lg shadow-indigo-500/20' 
                          : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center text-white font-black text-[10px] shadow-sm"
                          style={{ background: getAvatarColor(u.id) }}
                        >
                          {getInitials(u.full_name)}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-50 dark:border-[#13151a] ${u.is_online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      </div>
                      <span className="flex-1 truncate">{u.full_name}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setShowNewDM(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>New message</span>
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Bottom profile */}
        <div className="p-3 border-t border-slate-200 dark:border-white/5">
          <div
            className="flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-colors hover:bg-white/5"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs relative shrink-0 bg-gradient-to-tr from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/10"
            >
              {user?.full_name ? getInitials(user.full_name) : 'U'}
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-50 dark:border-[#13151a] rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 dark:text-white truncate">{user?.full_name || 'You'}</p>
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-tight">Online</p>
            </div>
            <Settings size={14} className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer shrink-0" />
          </div>
        </div>
      </aside>

      {/* ── Main Chat Area ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0f1117]">
        {/* Chat header */}
        <div
          className="h-13 flex items-center justify-between px-4 sm:px-5 py-3 border-b shrink-0 border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/2"
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-slate-500 hover:text-indigo-500 transition-colors"
            >
              <Hash size={20} />
            </button>

            {activeChannel ? (
              <>
                <Hash size={18} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                <div className="overflow-hidden">
                  <h2 className="font-black text-slate-900 dark:text-white text-sm truncate">{activeChannel.name}</h2>
                  <p className="text-xs text-slate-500 hidden sm:block truncate">
                    {activeChannel.description || 'Community Channel'}
                  </p>
                </div>
              </>
            ) : activeDMUser ? (
              <>
                <div className="relative shrink-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-md"
                    style={{ background: getAvatarColor(activeDMUser.id) }}
                  >
                    {getInitials(activeDMUser.full_name)}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#0f1117] ${activeDMUser.is_online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                </div>
                <div className="overflow-hidden">
                  <h2 className="font-black text-slate-900 dark:text-white text-sm truncate">{activeDMUser.full_name}</h2>
                  <p className="text-xs text-slate-500 truncate">{activeDMUser.is_online ? 'Online' : 'Offline'}</p>
                </div>
              </>
            ) : (
              <>
                <Users size={18} className="text-slate-500 shrink-0" />
                <h2 className="font-bold text-slate-500 text-sm">Select a channel</h2>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button className="p-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors cursor-pointer" title="Files">
              <Paperclip size={17} />
            </button>
            <button className="p-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors cursor-pointer" title="Details">
              <Info size={17} />
            </button>
          </div>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 scrollbar-thin">
          {/* Welcome message */}
          {!isLoadingMessages && (activeChannel || activeDMUser) && messages.length === 0 && (
            <div className="flex flex-col items-start pt-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                {activeChannel
                  ? <Hash size={28} className="text-indigo-400" />
                  : <AtSign size={28} className="text-indigo-500 dark:text-indigo-400" />}
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
                {activeChannel ? `#${activeChannel.name}` : activeDMUser?.full_name}
              </h1>
              <p className="text-slate-400 text-sm max-w-lg">
                {activeChannel
                  ? `This is the very beginning of #${activeChannel.name}. Start a conversation!`
                  : `This is the beginning of your DM with ${activeDMUser?.full_name}. Say hello!`}
              </p>
            </div>
          )}

          {/* No channel selected */}
          {!activeChannel && !activeDMUser && (
            <div className="flex-1 flex flex-col items-center justify-center pt-24 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-indigo-500/10"
              >
                <Hash size={30} className="text-indigo-500 dark:text-indigo-400" />
              </div>
              <p className="text-slate-400 font-semibold">Pick a channel or start a direct message</p>
              <p className="text-slate-600 text-sm mt-1">Your conversations will appear here</p>
            </div>
          )}

          {/* Loading spinner */}
          {isLoadingMessages && (
            <div className="flex justify-center pt-16">
              <Loader2 size={24} className="animate-spin text-indigo-400" />
            </div>
          )}

          {/* Grouped messages – WhatsApp style bubbles */}
          {!isLoadingMessages && grouped.map(({ label, items }) => (
            <div key={label}>
              {/* Date divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-slate-100 dark:bg-white/5" />
                <span
                  className="text-[11px] font-black text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/7 border border-slate-200 dark:border-white/8 uppercase tracking-widest"
                >
                  {label}
                </span>
                <div className="flex-1 h-px bg-slate-100 dark:bg-white/5" />
              </div>

              <div className="flex flex-col gap-[3px]">
                {items.map((msg, idx) => {
                  const prevMsg = idx > 0 ? items[idx - 1] : null;
                  const isConsecutive = !!prevMsg && prevMsg.sender_id === msg.sender_id &&
                    (new Date(ensureUTC(msg.timestamp)).getTime() - new Date(ensureUTC(prevMsg.timestamp)).getTime()) < 5 * 60 * 1000;
                  const isMe = msg.sender_id === user?.id;
                  const showAvatar = !isMe && !isConsecutive;

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${
                        isMe ? 'flex-row-reverse' : 'flex-row'
                      } ${isConsecutive ? 'mt-[2px]' : 'mt-3'}`}
                    >
                      {/* Overlay for mobile sidebar */}
                      {isSidebarOpen && (
                        <div 
                          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
                          onClick={() => setIsSidebarOpen(false)}
                        />
                      )}
                      
                      {/* Avatar placeholder (others only) */}
                      {!isMe && (
                        <div className="w-7 h-7 shrink-0">
                          {showAvatar && (
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px]"
                              style={{ background: getAvatarColor(msg.sender_id) }}
                            >
                              {getInitials(msg.sender_name || 'U')}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        className={`max-w-[85%] md:max-w-[70%] min-w-[60px] relative shadow-sm ${
                          isMe
                            ? 'rounded-t-2xl rounded-bl-2xl rounded-br-sm'
                            : 'rounded-t-2xl rounded-br-2xl rounded-bl-sm bubble-others'
                        }`}
                        style={isMe
                          ? { background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)' }
                          : {}
                        }
                      >
                        {/* Sender name (channel view, others, first in group) */}
                        {!isMe && !isConsecutive && activeChannel && (
                          <p
                            className="text-[11px] font-bold px-3 pt-2 pb-0"
                            style={{ color: getAvatarColor(msg.sender_id) }}
                          >
                            {msg.sender_name || 'Unknown'}
                          </p>
                        )}

                        {/* Message text + time inline */}
                        <div className="px-3 pt-2 pb-2">
                          <p
                            className={`text-[14.5px] leading-relaxed break-words font-medium ${
                              isMe ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {msg.content}
                            {/* Invisible spacer so time never overlaps text */}
                            <span className="inline-block w-14">&nbsp;</span>
                          </p>
                        </div>

                        {/* Time – absolute bottom-right inside bubble */}
                        <span
                          className="absolute bottom-[6px] right-[10px] text-[10.5px] font-medium select-none pointer-events-none"
                          style={{ color: isMe ? 'rgba(255,255,255,0.55)' : 'rgba(148,163,184,0.8)' }}
                        >
                          {formatTime(msg.timestamp)}
                          
                          {isMe && msg.delivery_status === 'failed' ? ' • Failed' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div ref={messageEndRef} />
        </div>

        {/* Input area */}
        {(activeChannel || activeDMUser) && (
          <div className="px-4 pb-4 pt-2 shrink-0">
            <div
              className="rounded-2xl border border-slate-200 dark:border-white/8 transition-all shadow-2xl bg-slate-50 dark:bg-[#1a1d24]"
            >
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
                className="w-full bg-transparent border-none focus:outline-none focus:ring-0 px-4 pt-3.5 pb-1 text-[14.5px] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 resize-none min-h-[64px] max-h-[180px] font-medium"
              />

              <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                <div className="flex items-center gap-0.5 relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        toast.success(`Attached: ${e.target.files[0].name}`);
                      }
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/8 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus size={17} />
                  </button>
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/8 rounded-lg transition-colors cursor-pointer"
                  >
                    <Smile size={17} />
                  </button>
                  <button
                    onClick={() => { setMessageText((prev) => prev + '@'); textareaRef.current?.focus(); }}
                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/8 rounded-lg transition-colors cursor-pointer"
                  >
                    <AtSign size={17} />
                  </button>

                  {showEmojiPicker && (
                    <div
                      className="absolute bottom-12 left-0 rounded-2xl border shadow-2xl p-2 flex gap-1 z-50 bg-white dark:bg-[#1e2028] border-slate-200 dark:border-white/10"
                    >
                      {['😀', '😂', '🔥', '👍', '🚀', '👀', '💯', '🎯'].map((emoji) => (
                        <button
                          key={emoji}
                          className="p-1.5 hover:bg-white/8 rounded-lg text-xl transition-colors cursor-pointer"
                          onClick={() => {
                            setMessageText((prev) => prev + emoji);
                            setShowEmojiPicker(false);
                            textareaRef.current?.focus();
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-black transition-all cursor-pointer shadow-lg ${
                    messageText.trim()
                      ? 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-500/20'
                      : 'bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Send size={15} />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5 px-1">
              <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for new line
            </p>
          </div>
        )}
      </main>

      <style>{`
        .bubble-others {
          background-color: #f1f5f9; /* slate-100 (light mode) */
          border: 1px solid #e2e8f0; /* slate-200 */
        }
        .dark .bubble-others {
          background-color: #1e2330 !important; /* dark variant */
          border: 1px solid rgba(255,255,255,0.06) !important;
        }

        .cms-content-chapter {
          color: #475569;
          font-size: 1.125rem;
          line-height: 1.8;
        }
      `}</style>
    </div>
  );
};

export default CommunityPage;
