import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  BarChart3, 
   
   
  Brain, 
   
   
  Layers,
  Sparkles,
  
} from 'lucide-react';
import RatioGrid from '../components/features/analysis/RatioGrid';
import FinancialCharts from '../components/features/analysis/FinancialCharts';
import AIAnalyst from '../components/features/analysis/AIAnalyst';

const ResearchHub: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLaymanMode, setIsLaymanMode] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/stock/${symbol}/profile`);
        setProfile(response.data);
      } catch (error) {
        console.error("Error fetching stock profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (symbol) {
      fetchProfile();
    }
  }, [symbol]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-[#050505] relative overflow-y-auto overflow-x-hidden text-gray-100 font-sans pb-12 custom-scrollbar">
      {/* Dynamic Background */}
      <div className="absolute top-0 inset-x-0 h-[500px] w-full bg-gradient-to-b from-primary/10 via-blue-500/5 to-transparent pointer-events-none"></div>
      <div className="absolute -top-[300px] -right-[200px] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="relative z-10 p-6 space-y-8 max-w-7xl mx-auto mt-4">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/[0.02] p-8 rounded-3xl border border-white/10 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-white">{symbol}</h1>
            <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium border border-primary/30">
              EQUITY
            </span>
          </div>
          <p className="text-gray-400 text-sm max-w-lg leading-relaxed">
            Institutional-grade deep dive and fundamental analysis powered by FinGPT. Master the mechanics behind the numbers.
          </p>
          </div>

        <div className="flex items-center gap-4 p-1.5 bg-black/40 rounded-xl border border-white/10">
          <span className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer ${!isLaymanMode ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`} onClick={() => setIsLaymanMode(false)}>
            Professional
          </span>
          <span className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${isLaymanMode ? 'bg-green-500 text-black' : 'text-gray-400 hover:text-white'}`} onClick={() => setIsLaymanMode(true)}>
            <Brain className="w-3.5 h-3.5" />
            Layman Explain
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Content: Fundamentals & Charts */}
        <div className="xl:col-span-2 space-y-8">
          {/* Key Metrics Grid */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Layers className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Key Fundamental Ratios</h2>
            </div>
            <RatioGrid data={profile?.fundamentals} isLaymanMode={isLaymanMode} />
          </section>

          {/* Financial Visualizations */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Yearly Financial Growth</h2>
            </div>
            <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-white/5 h-[400px]">
              <FinancialCharts data={profile?.financials} />
            </div>
          </section>
        </div>

        {/* Right Content: AI Analyst Section */}
        <div className="space-y-8">
          <section className="space-y-4 h-full">
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <h2 className="text-xl font-semibold">The AI's Thesis</h2>
            </div>
            <div className="flex-1 min-h-[500px]">
                <AIAnalyst symbol={symbol || ''} isLaymanMode={isLaymanMode} />
            </div>
          </section>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ResearchHub;
