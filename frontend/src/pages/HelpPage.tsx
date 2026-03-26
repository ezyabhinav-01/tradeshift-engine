import React from 'react';
import { 
  Search, 
  Book, 
  MessageCircle, 
  PlayCircle, 
  FileText, 
  ExternalLink, 
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  HelpCircle
} from 'lucide-react';

const categories = [
  {
    title: 'Getting Started',
    description: 'Learn the basics of Tradeshift and set up your account.',
    icon: Zap,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    links: ['Account Setup', 'Making your first trade', 'Platform Overview']
  },
  {
    title: 'Trading Guide',
    description: 'Advanced trading techniques and market analysis tools.',
    icon: TrendingUp,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    links: ['Order Types', 'Chart Indicators', 'Risk Management']
  },
  {
    title: 'Security & Privacy',
    description: 'How we keep your data and assets safe.',
    icon: ShieldCheck,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    links: ['Two-Factor Auth', 'Data Encryption', 'Privacy Policy']
  },
  {
    title: 'API Documentation',
    description: 'Build your own tools using our robust API.',
    icon: FileText,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    links: ['API Authentication', 'Rate Limits', 'Endpoints Reference']
  }
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
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0e11] text-slate-900 dark:text-slate-100 pb-20">
      {/* Hero Section */}
      <div className="bg-white dark:bg-[#131722] border-b border-slate-200 dark:border-white/5 pt-16 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">How can we help?</h1>
          <div className="relative max-w-2xl mx-auto mt-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search for articles, guides, and more..."
              className="w-full pl-12 pr-4 py-4 bg-slate-100 dark:bg-[#1a1d21] border border-slate-200 dark:border-white/10 rounded-md focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary outline-none transition-all shadow-lg text-lg"
            />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm text-slate-500">
            <span>Popular:</span>
            <button className="hover:text-tv-primary transition-colors hover:underline">API Integration</button>
            <span>•</span>
            <button className="hover:text-tv-primary transition-colors hover:underline">Chart Shortcuts</button>
            <span>•</span>
            <button className="hover:text-tv-primary transition-colors hover:underline">Reset Balance</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-10">
        {/* Category Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat, idx) => (
            <div key={idx} className="bg-white dark:bg-[#1a1d21] p-6 rounded-md border border-slate-200 dark:border-white/5 hover:border-tv-primary/50 transition-all shadow-sm hover:shadow-md group">
              <div className={`w-12 h-12 ${cat.bg} ${cat.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <cat.icon size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">{cat.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                {cat.description}
              </p>
              <ul className="space-y-3">
                {cat.links.map((link, lIdx) => (
                  <li key={lIdx} className="flex items-center justify-between group/link cursor-pointer">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover/link:text-tv-primary transition-colors">{link}</span>
                    <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover/link:text-tv-primary transform translate-x-0 group-hover/link:translate-x-1 transition-all" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Support Options */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="flex flex-col items-center text-center p-8 bg-tv-primary/5 rounded-3xl border border-tv-primary/10">
              <MessageCircle size={32} className="text-tv-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Live Chat</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Talk to our support team in real-time during business hours.</p>
              <button className="px-6 py-2 bg-tv-primary text-white rounded-full font-bold hover:bg-tv-primary/90 transition-all">Start Chat</button>
           </div>
           <div className="flex flex-col items-center text-center p-8 bg-purple-500/5 rounded-3xl border border-purple-500/10">
              <HelpCircle size={32} className="text-purple-500 mb-4" />
              <h3 className="text-xl font-bold mb-2">Community Forum</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Ask questions and share knowledge with other Tradeshift users.</p>
              <button className="px-6 py-2 bg-purple-500 text-white rounded-full font-bold hover:bg-purple-500/90 transition-all">Visit Forum</button>
           </div>
           <div className="flex flex-col items-center text-center p-8 bg-green-500/5 rounded-3xl border border-green-500/10">
              <PlayCircle size={32} className="text-green-500 mb-4" />
              <h3 className="text-xl font-bold mb-2">Video Tutorials</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Watch step-by-step guides on how to use all the platform features.</p>
              <button className="px-6 py-2 bg-green-500 text-white rounded-full font-bold hover:bg-green-500/90 transition-all">Watch Now</button>
           </div>
        </div>

        {/* FAQs */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-black mb-10 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white dark:bg-[#1a1d21] p-6 rounded-md border border-slate-200 dark:border-white/5 shadow-sm">
                <h4 className="text-lg font-bold mb-2 flex items-center gap-3">
                  <span className="text-tv-primary">Q:</span>
                  {faq.question}
                </h4>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed pl-8">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
          
          <div className="mt-12 text-center p-12 bg-white dark:bg-[#131722] rounded-3xl border border-slate-200 dark:border-white/5">
             <h3 className="text-2xl font-bold mb-4">Still need help?</h3>
             <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
               If you couldn't find the answer you were looking for, feel free to reach out to our dedicated support team.
             </p>
             <button className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-black hover:opacity-90 transition-all flex items-center gap-2 mx-auto">
               Contact Support <ExternalLink size={18} />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
