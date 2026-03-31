import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, BookOpen, Clock, ChevronRight, CheckCircle2, 
  TrendingUp, BarChart3, Calculator, Layers, PieChart, Brain,
  Target, Award, ArrowRight
} from 'lucide-react';
import { useLearnStore } from '../store/useLearnStore';
import './LearnPage.css';

const TRACK_ICONS: Record<string, React.ReactNode> = {
  TrendingUp: <TrendingUp size={32} />,
  BarChart3: <BarChart3 size={32} />,
  Calculator: <Calculator size={32} />,
  Layers: <Layers size={32} />,
  PieChart: <PieChart size={32} />,
  Brain: <Brain size={32} />,
};

const TrackDetailPage: React.FC = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { tracks, completedLessons, getTrackProgress, getModuleProgress, fetchTracks, fetchUserStats } = useLearnStore();

  useEffect(() => {
    if (tracks.length === 0) {
      Promise.all([fetchTracks(), fetchUserStats()]);
    }
  }, [tracks.length, fetchTracks, fetchUserStats]);

  const track = useMemo(() => tracks.find(t => t.id === trackId), [tracks, trackId]);
  const progress = track ? getTrackProgress(track.id) : 0;

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] text-center p-8">
        <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
          <BookOpen size={32} className="text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Track Not Found</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
          The learning track you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/learn')}
          className="px-6 py-2.5 rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-400 transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Back to Academy
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-[#030303]">
      {/* ══════════════ STICKY TOP BAR ══════════════ */}
      <div className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/learn')}
            className="group flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Academy
          </button>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Your Progress</span>
              <span className="text-sm font-black text-white">{progress}% Complete</span>
            </div>
            <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden hidden md:block">
              <div 
                className={`h-full bg-gradient-to-r ${track.color} transition-all duration-1000`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-6 py-12 space-y-12">
        {/* ══════════════ HERO SECTION ══════════════ */}
        <div className="relative p-8 rounded-3xl overflow-hidden border border-white/5 bg-white/[0.02]">
          <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${track.color}`} />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className={`p-5 rounded-2xl bg-gradient-to-br ${track.color} text-white shadow-2xl`}>
              {TRACK_ICONS[track.icon]}
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg bg-white/10 text-white border border-white/10">
                  {track.difficulty}
                </span>
                <span className="text-slate-500 text-xs font-bold flex items-center gap-1">
                  <Target size={14} /> {track.totalLessons} Lessons
                </span>
              </div>
              <h1 className="text-4xl font-black text-white tracking-tight">{track.title}</h1>
              <p className="text-slate-400 max-w-2xl leading-relaxed">{track.description}</p>
            </div>
          </div>
        </div>

        {/* ══════════════ CHAPTER INDEX ══════════════ */}
        <div className="space-y-16">
          {track.modules.map((module, mIdx) => {
            const modProgress = getModuleProgress(module.id);
            return (
              <div key={module.id} className="space-y-8">
                {/* Module Header */}
                <div className="flex items-center justify-between group">
                  <div className="flex items-baseline gap-4">
                    <span className="text-6xl font-black text-white/5 group-hover:text-white/10 transition-colors">
                      {String(mIdx + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h2 className="text-2xl font-black text-white tracking-tight">{module.title}</h2>
                      <p className="text-sm text-slate-500 mt-1">{module.description}</p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{modProgress}% Done</div>
                    <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${track.color}`}
                        style={{ width: `${modProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Lessons (Chapters) List */}
                <div className="grid grid-cols-1 gap-1 border-l-2 border-white/5 ml-8 pl-8">
                  {module.subModules.flatMap(sm => sm.lessons).map((lesson, lIdx) => {
                    const isCompleted = completedLessons.includes(lesson.id);
                    return (
                      <Link
                        key={lesson.id}
                        to={`/learn/${track.id}/${lesson.id}`}
                        className="group relative flex items-center justify-between p-4 rounded-xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/5"
                      >
                        <div className="flex items-center gap-5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                            isCompleted 
                              ? 'bg-emerald-500/20 text-emerald-500' 
                              : 'bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-white'
                          }`}>
                            {isCompleted ? <CheckCircle2 size={18} /> : (lIdx + 1)}
                          </div>
                          <div>
                            <h4 className={`font-bold transition-colors ${
                              isCompleted ? 'text-slate-400 line-through' : 'text-slate-200 group-hover:text-white'
                            }`}>
                              {lesson.title}
                            </h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                <Clock size={10} /> {lesson.duration}m read
                              </span>
                              {lesson.type === 'quiz' && (
                                <span className="text-[10px] text-amber-500/80 font-black uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded">
                                  QUIZ
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Start Chapter</span>
                          <ChevronRight size={14} className="text-indigo-400" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ══════════════ ACTION FOOTER ══════════════ */}
        <div className="pt-12 border-t border-white/5">
          <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-transparent border border-white/5 text-center space-y-6">
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/10">
              <Award size={32} className="text-indigo-400 shadow-xl shadow-indigo-500/20" />
            </div>
            <h3 className="text-2xl font-black text-white">Ready for the Next Milestone?</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Each chapter you complete brings you closer to mastering {track.title}. Keep going to earn your track completion badge.
            </p>
            <Link
              to="/learn"
              className="inline-flex items-center gap-2 text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
            >
              Check Other Tracks <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackDetailPage;
