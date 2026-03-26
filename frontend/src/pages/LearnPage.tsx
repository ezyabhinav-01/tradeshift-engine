import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { BookOpen, TrendingUp, BarChart3, Presentation, History, Calculator } from 'lucide-react';

// Custom interface identifying content blocks
interface ContentSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: string[];
}

const learnData: ContentSection[] = [
  {
    id: 'macd',
    title: 'Moving Average Convergence Divergence (MACD)',
    icon: <TrendingUp className="text-emerald-400" size={24} />,
    content: [
      "MACD is a trend-following momentum indicator that shows the relationship between two moving averages of a security's price.",
      "The MACD is calculated by subtracting the 26-period Exponential Moving Average (EMA) from the 12-period EMA.",
      "A nine-day EMA of the MACD called the 'signal line', is then plotted on top of the MACD line, which can function as a trigger for buy and sell signals."
    ]
  },
  {
    id: 'pe-ratio',
    title: 'Understanding the P/E Ratio',
    icon: <Calculator className="text-blue-400" size={24} />,
    content: [
      "The Price-to-Earnings Ratio (P/E ratio) is the ratio for valuing a company that measures its current share price relative to its EPS.",
      "A high P/E could mean that a company's stock is overvalued, or else that investors are expecting high growth rates in the future.",
      "Companies that have no earnings or that are losing money do not have a P/E ratio since there is nothing to put in the denominator."
    ]
  },
  {
    id: 'roe',
    title: 'Return on Equity (ROE) Explored',
    icon: <BarChart3 className="text-indigo-400" size={24} />,
    content: [
      "Return on equity (ROE) is a measure of financial performance calculated by dividing net income by shareholders' equity.",
      "Because shareholders' equity is equal to a company's assets minus its debt, ROE is considered the return on net assets.",
      "ROE is considered a measure of a corporation's profitability in relation to stockholders' equity."
    ]
  },
  {
    id: 'drawing-tools',
    title: 'Platform Guide: Drawing Tools',
    icon: <Presentation className="text-purple-400" size={24} />,
    content: [
      "To use drawing tools on the Tradeshift Engine, open the ProChart from the left navigation.",
      "On the left side of the chart, you will find a toolbar containing various geometric tools like Trend Lines, Horizontal Rays, and Fibonacci Retracements.",
      "You can edit the color and width of the drawing by right-clicking it to open the floating property menu."
    ]
  },
  {
    id: 'replay-mode',
    title: 'Platform Guide: Historical Replay Mode',
    icon: <History className="text-rose-400" size={24} />,
    content: [
      "The Historical Replay Mode allows you to backtest trading strategies by stepping through historical price action.",
      "To activate Replay Mode, click the 'Replay' icon on the top toolbar above the chart.",
      "You can use the Play, Pause, and Step Forward controls in the floating Replay Panel at the bottom to simulate live trading."
    ]
  }
];

export default function LearnPage() {
  const location = useLocation();
  const sectionsRef = useRef<{ [key: string]: HTMLElement | null }>({});

  useEffect(() => {
    // Intercept query strings like ?topic=macd
    const searchParams = new URLSearchParams(location.search);
    const targetTopic = searchParams.get('topic');

    if (targetTopic && sectionsRef.current[targetTopic]) {
      // Small timeout guarantees React has flushed layout paints
      setTimeout(() => {
        sectionsRef.current[targetTopic]?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  }, [location.search]);

  return (
    <div className="flex flex-col flex-1 h-screen overflow-y-auto bg-slate-50 dark:bg-[#0a0a0a] text-slate-800 dark:text-slate-200">
      <div className="max-w-4xl min-w-4xl mx-auto px-8 py-12">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-16 h-16 rounded-md bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <BookOpen size={32} className="text-emerald-500 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Trading Mastery</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Your premier dictionary for indicators, metrics, and platform navigation.</p>
          </div>
        </div>

        <div className="space-y-8 pb-32">
          {learnData.map((section) => (
            <section
              key={section.id}
              id={section.id}
              ref={(el) => { sectionsRef.current[section.id] = el; }}
              className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-slate-800 rounded-md p-8 hover:border-emerald-500/30 transition-colors shadow-sm dark:shadow-xl"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                  {section.icon}
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{section.title}</h2>
              </div>
              
              <div className="space-y-4">
                {section.content.map((paragraph, index) => (
                  <p key={index} className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
