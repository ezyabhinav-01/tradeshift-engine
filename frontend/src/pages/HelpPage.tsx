import React, { useState } from 'react';
import axios from 'axios';
import { 
  Search, 
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  Send,
  AlertCircle,
  Mail
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const categories = [
  {
    title: 'Getting Started',
    description: 'Learn the basics of Tradeshift and set up your account.',
    icon: Zap,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    borderHover: 'group-hover:border-amber-500/50',
    links: ['Account Setup', 'Making your first trade', 'Platform Overview']
  },
  {
    title: 'Trading Guide',
    description: 'Advanced trading techniques and market analysis tools.',
    icon: TrendingUp,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    borderHover: 'group-hover:border-blue-500/50',
    links: ['Order Types', 'Chart Indicators', 'Risk Management']
  },
];

const faqs = [
  { 
    question: "How do I reset my paper trading balance?", 
    answer: "You can reset your balance in the Settings page under the 'Account' tab. Note that this will clear your transaction history." 
  },
  { 
    question: "What market data sources do you use?", 
    answer: "We aggregate data from Alpha Vantage, Shoonya, and real-time news sources to provide a comprehensive view." 
  },
  { 
    question: "Can I use Tradeshift for real trading?", 
    answer: "Tradeshift is currently a simulation platform for educational and research purposes. We do not support live trading yet." 
  }
];

const HelpPage = () => {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'unauthenticated'>('idle');
  const [activeContactMethod, setActiveContactMethod] = useState<'email' | null>(null);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setStatus('unauthenticated');
      setTimeout(() => setStatus('idle'), 5000);
      return;
    }
    
    if (!message.trim()) return;
    
    setStatus('loading');
    try {
      await axios.post('/api/user/help', { message }, { withCredentials: true });
      setStatus('success');
      setMessage('');
      setTimeout(() => setStatus('idle'), 5000);
    } catch (error) {
      console.error('Failed to submit help request', error);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0e11] text-slate-900 dark:text-slate-100 pb-20 font-sans">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white dark:bg-[#131722] border-b border-slate-200 dark:border-white/5 pt-28 pb-32 px-4 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-br from-tv-primary/5 to-transparent dark:from-tv-primary/10 dark:to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight text-slate-900 dark:text-white">
            How can we <span className="text-tv-primary">help?</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Search our knowledge base, explore specialized guides, or get in touch with our fast-response support team.
          </p>
          
          <div className="max-w-2xl mx-auto relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search className="text-slate-400 group-focus-within:text-tv-primary transition-colors" size={22} />
            </div>
            <input 
              type="text" 
              placeholder="Search for answers, guides, or keywords..." 
              className="w-full pl-14 pr-32 py-5 rounded-3xl bg-slate-50 dark:bg-[#0b0e11] border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm text-lg transition-all"
            />
            <div className="absolute inset-y-2 right-2 flex items-center">
              <button className="px-8 py-3 bg-tv-primary text-white rounded-2xl font-bold hover:bg-tv-primary/90 transition-all shadow-sm group-focus-within:shadow-md active:scale-95">
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-12 relative z-20">
        
        {/* Category Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {categories.map((cat, idx) => (
            <div key={idx} className={`bg-white dark:bg-[#1a1d21] p-8 rounded-3xl border border-slate-200 dark:border-white/5 transition-all duration-300 shadow-sm hover:shadow-xl group ${cat.borderHover}`}>
              <div className={`w-14 h-14 ${cat.bg} ${cat.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <cat.icon size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white">{cat.title}</h3>
              <p className="text-base text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                {cat.description}
              </p>
              <ul className="space-y-4">
                {cat.links.map((link, lIdx) => (
                  <li key={lIdx} className="flex items-center justify-between group/link cursor-pointer py-1">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover/link:text-tv-primary transition-colors">{link}</span>
                    <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 group-hover/link:text-tv-primary transform translate-x-0 group-hover/link:translate-x-1 transition-all" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact Us 24x7 */}
        <div className="mt-28 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Contact us 24x7</h2>
          
          <div className="space-y-4">
            {/* Email Us */}
            <div 
              onClick={() => setActiveContactMethod(activeContactMethod === 'email' ? null : 'email')}
              className={`flex items-center p-6 bg-white dark:bg-[#1a1d21] rounded-2xl border transition-all cursor-pointer group shadow-sm hover:shadow-md ${
                activeContactMethod === 'email' ? 'border-tv-primary dark:border-tv-primary/50 ring-1 ring-tv-primary/20' : 'border-slate-200 dark:border-white/5'
              }`}
            >
              <div className={`mr-5 p-4 rounded-xl group-hover:scale-110 transition-transform ${
                activeContactMethod === 'email' ? 'text-white bg-tv-primary' : 'text-emerald-500 bg-emerald-500/10'
              }`}>
                <Mail size={28} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Email us</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">support@groww.in</p>
              </div>
            </div>
          </div>
        </div>

        {/* Support Form via Email */}
        {activeContactMethod === 'email' && (
          <div className="mt-8 p-10 md:p-14 bg-white dark:bg-[#131722] rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-xl shadow-slate-200/40 dark:shadow-none relative overflow-hidden max-w-4xl mx-auto animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-tv-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="text-center mb-10 relative z-10">
              <h3 className="text-2xl font-black mb-2 text-slate-900 dark:text-white tracking-tight">Draft your email</h3>
              <p className="text-lg text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                Describe your concern in detail. We'll receive it instantly and get back to you via your registered email address.
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative z-10">
              <div className="mb-6 relative group">
                <div className="absolute top-6 left-6 pointer-events-none">
                  <Mail className="text-slate-400 group-focus-within:text-tv-primary transition-colors duration-300" size={24} />
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hello, I encountered an issue with..."
                  className="w-full min-h-[180px] pl-16 pr-6 pt-6 pb-6 bg-slate-50 dark:bg-[#0b0e11] border border-slate-200 dark:border-white/10 rounded-3xl focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary/50 resize-y text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-lg transition-all shadow-inner"
                  required
                  disabled={status === 'loading'}
                />
              </div>
              
              {status === 'success' && (
                <div className="mb-8 p-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-2xl text-base font-medium flex items-center justify-center gap-3">
                  <ShieldCheck size={20} className="shrink-0" />
                  Your message has been received! Our support team will review it shortly.
                </div>
              )}
              
              {status === 'error' && (
                <div className="mb-8 p-5 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-2xl text-base font-medium flex items-center justify-center gap-3">
                  <AlertCircle size={20} className="shrink-0" />
                  Failed to send your message. Please try again later.
                </div>
              )}

              {status === 'unauthenticated' && (
                <div className="mb-8 p-5 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-2xl text-base font-medium flex items-center justify-center gap-3">
                  <AlertCircle size={20} className="shrink-0" />
                  Please log in to submit a help request.
                </div>
              )}

              <div className="flex justify-center">
                <button 
                  type="submit"
                  disabled={status === 'loading'}
                  className={`px-12 py-4 bg-tv-primary hover:bg-tv-primary/90 text-white rounded-full font-bold text-lg transition-all flex items-center gap-3 shadow-md hover:shadow-lg active:scale-95 w-full sm:w-auto justify-center ${
                    (!user || status === 'loading' || !message.trim()) ? 'opacity-60 cursor-not-allowed hover:bg-tv-primary active:scale-100 shadow-none hover:shadow-none' : ''
                  }`}
                >
                  {status === 'loading' ? 'Sending Message...' : 'Send Message'}
                  {status !== 'loading' && <Send size={20} />}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* FAQs */}
        <div className="mt-32 max-w-4xl mx-auto">
          <h2 className="text-4xl font-black mb-12 text-center tracking-tight text-slate-900 dark:text-white">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((faq, idx) => (
              <div key={idx} className="group bg-white dark:bg-[#1a1d21] p-8 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-tv-primary/30">
                <h4 className="text-xl font-bold mb-4 flex items-start gap-4">
                  <span className="text-tv-primary text-2xl leading-none mt-0.5 font-black">Q.</span>
                  <span className="text-slate-900 dark:text-white group-hover:text-tv-primary transition-colors duration-200">{faq.question}</span>
                </h4>
                <div className="pl-10 relative">
                  <div className="absolute left-[1.1rem] top-0 bottom-0 w-0.5 bg-slate-100 dark:bg-white/5 rounded-full" />
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg pt-1">
                    {faq.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;