import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useLearnStore, type SubModule } from '../store/useLearnStore';
import { ArrowLeft, BookOpen, ChevronRight, Lock, Sparkles, Trophy } from 'lucide-react';
import { useAccessControl } from '../hooks/useAccessControl';
import { motion } from 'framer-motion';

interface ModuleDetail {
  id: string;
  title: string;
  description: string;
  moduleNumber: string;
  trackId: string;
  trackTitle: string;
  subModules: SubModule[];
}

export default function ModuleDetailPage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  // Removed unused user
  const { checkAccess } = useAccessControl();
  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { completedLessons } = useLearnStore();

  useEffect(() => {
    async function fetchModule() {
      try {
        const res = await fetch(`/api/learn/modules/${moduleId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setModule(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchModule();
  }, [moduleId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[600px] bg-black">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-indigo-500/10 rounded-full blur-xl animate-pulse" />
            </div>
          </div>
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] animate-pulse">Initializing Group...</p>
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center p-8 min-h-[600px] bg-black">
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 ring-1 ring-white/10">
          <BookOpen className="w-10 h-10 text-slate-600" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Module Group Not Found</h2>
        <p className="text-slate-500 text-sm max-w-xs mb-8 font-medium">The content you are looking for has either been relocated or does not exist.</p>
        <button onClick={() => navigate('/learn')} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all">
          <ArrowLeft size={14} /> Back to Academy
        </button>
      </div>
    );
  }

  // isGuest removed
  const totalModuleLessons = module.subModules.reduce((acc, sm) => acc + (sm.lessons?.length || 0), 0);
  const completedModuleLessons = module.subModules.reduce((acc, sm) => acc + (sm.lessons || []).filter(l => completedLessons.includes(l.id)).length, 0);
  const progressPct = totalModuleLessons > 0 ? Math.round((completedModuleLessons / totalModuleLessons) * 100) : 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-black selection:bg-indigo-500/30">
      {/* ══════════════ NAVIGATION BAR ══════════════ */}
      <div className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(`/learn/track/${module.trackId}`)}
            className="group flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500/20 transition-all border border-white/5 group-hover:border-indigo-500/30">
              <ArrowLeft size={14} className="text-slate-400 group-hover:text-indigo-400 transition-colors" />
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors">Back to Track Index</span>
          </button>
          
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter leading-none mb-1">Group Progress</span>
                <span className="text-sm font-black text-white leading-none">{progressPct}%</span>
             </div>
             <div className="w-12 h-12 rounded-full border-2 border-white/5 flex items-center justify-center relative">
                <svg className="w-10 h-10 transform -rotate-90">
                  <circle
                    cx="20" cy="20" r="18"
                    stroke="currentColor" strokeWidth="3"
                    fill="transparent"
                    className="text-white/5"
                  />
                  <circle
                    cx="20" cy="20" r="18"
                    stroke="currentColor" strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={113}
                    strokeDashoffset={113 - (113 * progressPct) / 100}
                    className="text-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-1000"
                  />
                </svg>
             </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full px-6 py-16">
        {/* ══════════════ MODULE HEADER ══════════════ */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-20"
        >
          <div className="flex items-baseline gap-4 mb-4">
            <span className="text-8xl font-black text-white/5 leading-none select-none">{module.moduleNumber}</span>
            <div className="flex flex-col">
               <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.3em]">Module Group</span>
               </div>
               <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight">{module.title}</h1>
            </div>
          </div>
          
          <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-2xl border-l-2 border-white/5 pl-8 mt-6">
            {module.description}
          </p>
        </motion.div>

        {/* ══════════════ CHAPTER SELECTION ══════════════ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-8 px-2">
             <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Available Chapters</h3>
             <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-indigo-500" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{module.subModules.length} Segments</span>
             </div>
          </div>

          <div className="grid grid-cols-1 gap-12 border-l border-white/5 ml-4 pl-12">
            {module.subModules.length > 0 ? (
              module.subModules.map((sm, index) => {
                const smLessons = sm.lessons || [];
                const smCompletedCount = smLessons.filter(l => completedLessons.includes(l.id)).length;
                const smProgress = smLessons.length > 0 ? Math.round((smCompletedCount / smLessons.length) * 100) : 0;
                const isMastered = smProgress === 100 && smLessons.length > 0;

                return (
                  <motion.button
                    key={sm.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => {
                      if (checkAccess()) navigate(`/learn/chapter/${sm.id}`);
                    }}
                    className="group flex flex-col items-start text-left relative"
                  >
                    {/* Visual Indicator on the line */}
                    <div className={`absolute -left-[53px] top-4 w-[11px] h-[11px] rounded-full border-2 bg-black z-10 transition-all duration-500 ${
                      isMastered ? 'border-emerald-500 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'border-white/20 group-hover:border-indigo-500 group-hover:scale-125'
                    }`} />

                    <div className="flex items-start gap-4">
                      <span className={`text-3xl font-black transition-colors duration-300 ${isMastered ? 'text-emerald-500' : 'text-white/20 group-hover:text-indigo-400'}`}>
                        {index + 1}.
                      </span>
                      <div className="space-y-3">
                         <div className="flex items-center gap-3">
                            <h4 className={`text-2xl md:text-3xl font-black tracking-tight transition-all duration-300 ${isMastered ? 'text-emerald-400' : 'text-slate-100 group-hover:text-white'}`}>
                              {sm.title}
                            </h4>
                            {isMastered && (
                               <motion.div 
                                 initial={{ scale: 0 }} 
                                 animate={{ scale: 1 }} 
                                 className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-500 uppercase tracking-widest"
                               >
                                 Mastered
                               </motion.div>
                            )}
                         </div>

                         {sm.description && (
                           <p className="text-slate-500 text-sm leading-relaxed max-w-xl group-hover:text-slate-400 transition-colors">
                            {sm.description}
                           </p>
                         )}

                         <div className="flex items-center gap-6 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] rounded-full border border-white/5 ring-1 ring-white/5">
                               <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-1000 ${isMastered ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${smProgress}%` }}
                                  />
                               </div>
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{smProgress}%</span>
                            </div>
                            
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300 flex items-center gap-2">
                               Enter Chapter <ChevronRight size={10} />
                            </span>
                         </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })
            ) : (
              <div className="py-20 flex flex-col items-center">
                <Lock className="w-12 h-12 text-slate-800 mb-4" />
                <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Chapters Restricting Access</p>
                <p className="text-[10px] text-slate-600 font-medium mt-1">Check back later for updated content.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Decorative footer footer */}
      <div className="mt-auto py-20 px-6 border-t border-white/5 bg-gradient-to-b from-transparent to-indigo-500/5">
         <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
            <Trophy className="w-8 h-8 text-indigo-500/20 mb-4" />
            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Goal Objective</h5>
            <p className="text-slate-400 text-sm font-medium max-w-xs">Complete all chapters in this group to earn 500 XP and the module completion badge.</p>
         </div>
      </div>
    </div>
  );
}
