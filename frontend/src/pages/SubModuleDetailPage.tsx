import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLearnStore } from '../store/useLearnStore';
import {
  ArrowLeft, CheckCircle2, BookOpen,
  Award, LineChart, Sparkles,
  Trophy, Zap, ShieldCheck, ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAccessControl } from '../hooks/useAccessControl';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { parseTextWithTags, useTopicPortalHydrator } from '../components/TopicPortal';
import './LearnPage.css';

interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

interface LessonData {
  id: string;
  title: string;
  lessonNumber: string | null;
  contentHtml: string;
  xpReward: number;
  duration: number;
  type: string;
  quizQuestions: QuizQuestion[];
  practiceSceneId?: string;
}

interface SubModuleData {
  id: string;
  title: string;
  subModuleNumber: string | null;
  moduleId: string;
  moduleTitle: string;
  trackId: string;
  trackTitle: string;
  prev_id: string | null;
  next_id: string | null;
  description: string | null;
  lessons: LessonData[];
}

interface Comment {
  id: number;
  user_id: number;
  user_full_name: string;
  sub_module_id: number;
  content: string;
  created_at: string;
}

export default function SubModuleDetailPage() {
  const { subModuleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { checkAccess } = useAccessControl();
  const { completeLesson, completedLessons, logLearningTime } = useLearnStore();
  
  const [data, setData] = useState<SubModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, Record<number, number>>>({});
  const [showQuizResults, setShowQuizResults] = useState<Record<string, boolean>>({});
  
  // Discussion State
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"]
  });
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    if (!user) {
      checkAccess();
      navigate('/learn');
      return;
    }
  }, [user, navigate, checkAccess]);

  useEffect(() => {
    setLoading(true);
    async function fetchSubModule() {
      try {
        const res = await fetch(`/api/learn/sub-modules/${subModuleId}`);
        if (!res.ok) throw new Error('Failed to fetch chapter');
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchSubModule();
    fetchComments();
    window.scrollTo(0, 0);
  }, [subModuleId]);

  async function fetchComments() {
    try {
      const res = await fetch(`/api/learn/sub-modules/${subModuleId}/comments`);
      if (res.ok) setComments(await res.json());
    } catch (e) { console.error(e); }
  }

  const handlePostComment = async () => {
    if (!newComment.trim() || isPosting) return;
    setIsPosting(true);
    try {
      const res = await fetch(`/api/learn/sub-modules/${subModuleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment })
      });
      if (res.ok) {
        setNewComment("");
        fetchComments();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPosting(false);
    }
  };

  // Active Learning Time Tracker
  useEffect(() => {
    if (loading || !data) return;
    const interval = setInterval(() => {
      if (!document.hidden) {
        logLearningTime(1);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [loading, data, logLearningTime]);

  // #TopicRef — Hydrate topic-tag spans in lesson HTML content
  useTopicPortalHydrator(contentRef);

  const handleLessonComplete = (lessonId: string) => {
    if (data && !completedLessons.includes(lessonId)) {
      completeLesson(lessonId, data.trackId);
    }
  };

  const handleQuizSubmit = (lessonId: string) => {
    setShowQuizResults(prev => ({ ...prev, [lessonId]: true }));
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-[#030303]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <Sparkles className="absolute inset-0 m-auto text-indigo-400 animate-pulse" size={24} />
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-white tracking-widest uppercase">Preparing Chapter</p>
            <p className="text-xs text-slate-500 mt-1 font-bold">Assembling elite trading knowledge...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center p-8 min-h-screen bg-[#030303]">
        <BookOpen className="w-20 h-20 text-slate-700 mb-6" />
        <h2 className="text-2xl font-black text-white mb-2">Chapter Not Found</h2>
        <p className="text-slate-500 max-w-xs mb-8">The chapter you're looking for doesn't exist or has been removed.</p>
        <button 
          onClick={() => navigate('/learn')} 
          className="px-8 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-500 transition-all flex items-center gap-2"
        >
          <ArrowLeft size={20} /> Back to Academy
        </button>
      </div>
    );
  }

  const completedCount = data.lessons.filter(l => completedLessons.includes(l.id)).length;
  const isChapterComplete = completedCount === data.lessons.length;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#030303] selection:bg-indigo-500/30">
      {/* ───── STICKY CHAPTER NAV ───── */}
      <motion.div 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-[100] bg-[#0a0a0a]/80 backdrop-blur-3xl border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <div className="flex items-center gap-4 min-w-0">
            <button 
              onClick={() => navigate(`/learn/track/${data.trackId}`)}
              className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{data.trackTitle}</span>
                <span className="text-slate-700">•</span>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Chapter {data.subModuleNumber || data.id}</span>
              </div>
              <h1 className="text-sm md:text-base font-black text-white truncate leading-tight">{data.title}</h1>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 flex-shrink-0">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Chapter Progress</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(completedCount / data.lessons.length) * 100}%` }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
                  />
                </div>
                <span className="text-xs font-black text-white">{completedCount}/{data.lessons.length}</span>
              </div>
            </div>
            {isChapterComplete ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest">
                <ShieldCheck size={16} /> Completed
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest animate-pulse">
                <Zap size={16} /> In Progress
              </div>
            )}
          </div>
        </div>
        {/* Scroll Progress Bar */}
        <motion.div 
          className="h-0.5 bg-indigo-500 origin-left"
          style={{ scaleX }}
        />
      </motion.div>

      <div ref={scrollRef} className="pt-24 pb-40 relative z-0">
        <div className="max-w-4xl mx-auto px-6">
          
          {/* ───── CHAPTER HEADER ───── */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-32 space-y-8"
          >
            <div className="flex items-center gap-4">
              <div className="px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">
                {data.subModuleNumber ? `Segment ${data.subModuleNumber}` : 'Active Segment'}
              </div>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            
            <div className="space-y-6">
              <h1 className="text-6xl md:text-7xl font-black text-white tracking-tighter leading-[0.9]">
                {data.title}
              </h1>
              
              {data.description && (
                <p className="text-xl md:text-2xl text-slate-400 font-medium leading-relaxed max-w-3xl border-l-4 border-indigo-500/30 pl-8 py-2">
                  {data.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-8 pt-4">
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Total Lessons</span>
                  <span className="text-xl font-bold text-white tracking-tight">{data.lessons.length} Modules</span>
               </div>
               <div className="w-px h-10 bg-white/10" />
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">XP Potential</span>
                  <span className="text-xl font-bold text-amber-500 tracking-tight">
                    {data.lessons.reduce((acc, l) => acc + l.xpReward, 0)} XP
                  </span>
               </div>
            </div>
          </motion.div>

          {/* ───── LESSON STACK ───── */}
          {data.lessons.map((lesson, index) => {
            const isCompleted = completedLessons.includes(lesson.id);
            const isQuiz = lesson.type === 'quiz' || (lesson.quizQuestions && lesson.quizQuestions.length > 0);
            const currentSelected = selectedAnswers[lesson.id] || {};
            const currentShowResults = showQuizResults[lesson.id] || false;
            
            const allQuestionsAnswered = lesson.quizQuestions?.length 
              ? Object.keys(currentSelected).length === lesson.quizQuestions.length
              : true;
            
            const isQuizPassed = () => {
              if (!isQuiz) return true;
              if (!currentShowResults) return false;
              return lesson.quizQuestions.every((q, idx) => currentSelected[idx] === q.correct_index);
            };

            return (
              <motion.section 
                key={lesson.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="relative scroll-mt-32"
              >
                {/* Visual Connector Line */}
                {index < data.lessons.length - 1 && (
                  <div className="absolute left-1/2 -bottom-48 w-px h-24 bg-gradient-to-b from-white/10 to-transparent hidden md:block" />
                )}

                <div className="space-y-10">
                  {/* Sub-Topic Header */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Sub-Topic {index + 1}</span>
                      {isCompleted && (
                        <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">
                          <CheckCircle2 size={10} /> Complete
                        </span>
                      )}
                    </div>
                    <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight">
                      {lesson.title}
                    </h3>
                  </div>

                  {/* Lesson Content - Premium prose */}
                  <div 
                    ref={contentRef}
                    className="cms-content-chapter prose prose-invert prose-indigo max-w-none"
                    dangerouslySetInnerHTML={{ __html: lesson.contentHtml }}
                  />

                  {/* Simulator Integration (if present) */}
                  {lesson.practiceSceneId && (
                    <div className="my-16 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-white/5 rounded-3xl p-10 overflow-hidden group relative">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-1000" />
                      <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
                        <div className="space-y-4">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-black uppercase tracking-wider">
                            <LineChart size={14} /> Practical Application
                          </div>
                          <h4 className="text-2xl font-black text-white">Interactive Market Drill</h4>
                          <p className="text-slate-400 text-sm leading-relaxed">
                            Don't just read—execute. Load this specific {lesson.title} setup in our high-fidelity simulator and master the pattern with zero risk.
                          </p>
                        </div>
                        <div className="flex justify-end">
                          <a 
                            href={`/trade?scene_id=${lesson.practiceSceneId}`}
                            className="bg-white text-black font-black px-8 py-4 rounded-2xl hover:bg-indigo-400 hover:text-white transition-all shadow-xl flex items-center gap-2 group-hover:-translate-y-1"
                          >
                            Enter Simulator <ArrowRight size={18} />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Knowledge Check (Quiz) */}
                  {isQuiz && (
                    <div className="mt-20 p-10 rounded-[2.5rem] bg-white/[0.01] border border-white/5 space-y-10">
                       <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                          <Zap size={24} />
                        </div>
                        <div>
                          <h4 className="text-2xl font-black text-white tracking-tight">Concept Mastery</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-0.5">Validate your analysis skills</p>
                        </div>
                      </div>

                      <div className="space-y-12">
                        {lesson.quizQuestions.map((q, qIdx) => {
                          const isCrt = currentShowResults && currentSelected[qIdx] === q.correct_index;
                          return (
                            <div key={qIdx} className="space-y-5">
                               <p className="text-lg font-bold text-slate-200">
                                <span className="text-indigo-400 mr-2 opacity-50">{String(qIdx + 1).padStart(2, '0')}.</span> {q.question}
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {q.options.map((opt, oIdx) => {
                                  const isSel = currentSelected[qIdx] === oIdx;
                                  const showCrt = currentShowResults && oIdx === q.correct_index;
                                  const showWrng = currentShowResults && isSel && oIdx !== q.correct_index;

                                  return (
                                    <button
                                      key={oIdx}
                                      disabled={currentShowResults}
                                      onClick={() => setSelectedAnswers(prev => ({
                                        ...prev,
                                        [lesson.id]: { ...(prev[lesson.id] || {}), [qIdx]: oIdx }
                                      }))}
                                      className={`w-full text-left p-5 rounded-2xl border text-sm transition-all
                                        ${showCrt ? 'bg-emerald-500/20 border-emerald-500/50 text-white font-bold ring-2 ring-emerald-500/10' : 
                                          showWrng ? 'bg-red-500/20 border-red-500/50 text-white font-bold ring-2 ring-red-500/10' : 
                                          isSel ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-100 font-bold' : 
                                          'bg-black/60 border-white/5 text-slate-400 hover:border-white/20 hover:bg-white/[0.04]'
                                        }
                                      `}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                              <AnimatePresence>
                                {currentShowResults && q.explanation && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className={`p-5 rounded-3xl text-sm leading-relaxed border ${isCrt ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' : 'bg-red-500/10 border-red-500/20 text-red-200'}`}
                                  >
                                    <div className="font-black uppercase text-[10px] tracking-widest mb-2 flex items-center gap-2">
                                      {isCrt ? <CheckCircle2 size={12} /> : <Zap size={12} />}
                                      Institutional Explanation
                                    </div>
                                    {q.explanation}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-end pt-6 border-t border-white/5">
                        {!currentShowResults ? (
                          <button
                            onClick={() => handleQuizSubmit(lesson.id)}
                            disabled={!allQuestionsAnswered}
                            className="px-10 py-4 bg-white text-black font-black rounded-2xl hover:bg-indigo-400 hover:text-white transition-all disabled:opacity-20 disabled:grayscale transition-all hover:-translate-y-1 active:scale-95"
                          >
                            Submit Analysis
                          </button>
                        ) : !isQuizPassed() ? (
                          <button
                            onClick={() => {
                              setShowQuizResults(prev => ({ ...prev, [lesson.id]: false }));
                              setSelectedAnswers(prev => ({ ...prev, [lesson.id]: {} }));
                            }}
                            className="px-8 py-4 bg-red-500/20 text-red-100 font-black rounded-2xl hover:bg-red-500/30 transition-all border border-red-500/30"
                          >
                            Retry Analysis
                          </button>
                        ) : (
                          <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-emerald-500/10 text-emerald-400 font-black text-sm uppercase tracking-widest border border-emerald-500/30">
                            <CheckCircle2 size={20} /> Analysis Verified
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sub-Topic Completion Action */}
                  <div className="pt-10 flex flex-col items-center gap-4">
                    <button
                      onClick={() => handleLessonComplete(lesson.id)}
                      disabled={isCompleted || !isQuizPassed()}
                      className={`relative overflow-hidden px-10 py-5 rounded-[2rem] font-black transition-all group ${
                        isCompleted
                          ? 'bg-emerald-500/5 text-emerald-500/50 border border-emerald-500/10 cursor-default'
                          : isQuizPassed()
                            ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-900/40 hover:-translate-y-1 active:scale-95'
                            : 'bg-white/5 text-slate-800 border border-white/5 cursor-not-allowed hidden'
                      }`}
                    >
                      <div className="relative z-10 flex items-center gap-3">
                        {isCompleted ? (
                          <><CheckCircle2 size={24} /> Topic Mastered</>
                        ) : (
                          <><Award size={24} /> Mark Topic as Complete</>
                        )}
                      </div>
                      {!isCompleted && isQuizPassed() && (
                        <motion.div 
                          className="absolute inset-0 bg-white/10"
                          initial={{ x: '-100%' }}
                          animate={{ x: '100%' }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        />
                      )}
                    </button>
                    {!isCompleted && !isQuizPassed() && !isQuiz && (
                        <button
                          onClick={() => handleLessonComplete(lesson.id)}
                          className="px-8 py-4 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-2xl font-black text-sm transition-all border border-indigo-600/30"
                        >
                          Complete Sub-Topic {index + 1}
                        </button>
                    )}
                  </div>
                </div>
              </motion.section>
            );
          })}

          {/* ───── CHAPTER FINALE ───── */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="pt-20"
          >
            <div className="relative p-16 rounded-[4rem] bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent border border-white/10 text-center overflow-hidden">
               {/* Background Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[150px] pointer-events-none" />
              
              <div className="relative z-10 space-y-10">
                <div className="w-28 h-28 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto border border-white/10 shadow-3xl">
                  <Trophy size={56} className="text-amber-500 drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]" />
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-5xl font-black text-white tracking-tighter">Chapter Conquest</h3>
                  <p className="text-slate-400 max-w-lg mx-auto leading-relaxed text-lg">
                    You've successfully completed every sub-topic in this chapter. Your analytical understanding of these concepts is now documented.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6">
                  {data.next_id ? (
                    <button 
                      onClick={() => navigate(`/learn/chapter/${data.next_id}`)}
                      className="w-full sm:w-auto px-12 py-6 bg-indigo-600 text-white font-black rounded-[2.5rem] hover:bg-indigo-500 transition-all shadow-2xl active:scale-95 text-lg flex items-center gap-3"
                    >
                      Continue to Next Chapter <ArrowRight size={24} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => navigate(`/learn/track/${data.trackId}`)}
                      className="w-full sm:w-auto px-12 py-6 bg-white text-black font-black rounded-[2.5rem] hover:bg-indigo-400 hover:text-white transition-all shadow-2xl active:scale-95 text-lg"
                    >
                      Track Completed
                    </button>
                  )}
                  <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="w-full sm:w-auto px-10 py-6 bg-white/5 text-white font-black rounded-[2.5rem] hover:bg-white/10 transition-all border border-white/10"
                  >
                    Review Core Concepts
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ───── CHAPTER NAVIGATION FOOTER ───── */}
          <div className="pt-24 grid grid-cols-2 gap-6 border-t border-white/5">
            <div className="col-span-1">
              {data.prev_id && (
                <button 
                  onClick={() => navigate(`/learn/chapter/${data.prev_id}`)}
                  className="w-full p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all text-left flex flex-col gap-2 group"
                >
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <ArrowLeft size={12} /> Previous Segment
                  </span>
                  <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">Go Back</span>
                </button>
              )}
            </div>
            <div className="col-span-1">
              {data.next_id && (
                <button 
                  onClick={() => navigate(`/learn/chapter/${data.next_id}`)}
                  className="w-full p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all text-right flex flex-col items-end gap-2 group"
                >
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                    Next Segment <ArrowRight size={12} />
                  </span>
                  <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">Advance Chapter</span>
                </button>
              )}
            </div>
          </div>

          {/* ───── PUBLIC DISCUSSION ───── */}
          <div className="pt-32 space-y-12">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-4xl font-black text-white tracking-tighter">Chapter Discussion</h3>
                <p className="text-slate-500 text-sm mt-1 uppercase font-bold tracking-widest">Connect with elite analysts</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-slate-400 text-xs font-black">
                {comments.length} Contributions
              </div>
            </div>

            {/* Post Comment Input */}
            <div className="p-8 rounded-3xl bg-white/[0.01] border border-white/5 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-lg border border-indigo-500/20">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 space-y-4">
                  <textarea 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your insights, ask a question, or discuss this topic..."
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 outline-none transition-all resize-none min-h-[120px]"
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handlePostComment}
                      disabled={!newComment.trim() || isPosting}
                      className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-500 disabled:opacity-20 transition-all flex items-center gap-2"
                    >
                      {isPosting ? 'Posting...' : 'Post Contribution'} <Sparkles size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Comment List */}
            <div className="space-y-8">
              {comments.map((comment) => (
                <motion.div 
                  key={comment.id}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  className="flex gap-6 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0">
                    {comment.user_full_name.charAt(0)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-white tracking-wide">{comment.user_full_name}</span>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed bg-white/[0.02] p-6 rounded-2xl rounded-tl-none border border-white/5">
                      {parseTextWithTags(comment.content)}
                    </p>
                  </div>
                </motion.div>
              ))}
              {comments.length === 0 && (
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                  <Sparkles size={40} className="text-slate-800 mx-auto mb-4" />
                  <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">No contributions yet.</p>
                  <p className="text-slate-700 text-xs mt-1">Be the first to start the discussion.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .cms-content-chapter {
          color: #94a3b8;
          font-size: 1.125rem;
          line-height: 1.8;
        }
        .cms-content-chapter h1, 
        .cms-content-chapter h2, 
        .cms-content-chapter h3 {
          color: #ffffff;
          font-weight: 900;
          letter-spacing: -0.025em;
          margin-top: 3rem;
          margin-bottom: 1.5rem;
        }
        .cms-content-chapter h1 { font-size: 3rem; }
        .cms-content-chapter h2 { font-size: 2rem; border-left: 4px solid #6366f1; padding-left: 1.5rem; }
        .cms-content-chapter h3 { font-size: 1.5rem; }
        .cms-content-chapter p { margin-bottom: 1.5rem; }
        .cms-content-chapter strong { color: #ffffff; font-weight: 800; }
        .cms-content-chapter ul, .cms-content-chapter ol {
          margin-bottom: 2rem;
          padding-left: 1.5rem;
        }
        .cms-content-chapter li {
          margin-bottom: 0.75rem;
        }
        .cms-content-chapter blockquote {
          border-left: 4px solid #6366f1;
          padding: 1.5rem 2rem;
          background: rgba(99, 102, 241, 0.05);
          border-radius: 0 1.5rem 1.5rem 0;
          font-style: italic;
          color: #cbd5e1;
          margin: 3rem 0;
        }
        .cms-content-chapter img {
          border-radius: 2rem;
          margin: 3rem 0;
          border: 1px solid rgba(255,255,255,0.05);
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        }
        .cms-content-chapter pre {
          background: #0f172a;
          padding: 1.5rem;
          border-radius: 1.5rem;
          border: 1px solid rgba(255,255,255,0.05);
          overflow-x: auto;
          margin: 2rem 0;
        }
        .cms-content-chapter code {
          color: #818cf8;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas;
          font-size: 0.9em;
        }
        .cms-content-chapter .topic-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.9em;
          cursor: pointer;
          transition: all 0.3s;
          color: #818cf8;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
        }
        .cms-content-chapter .topic-tag:hover {
          background: rgba(99,102,241,0.2);
          border-color: rgba(99,102,241,0.4);
          box-shadow: 0 0 20px -5px rgba(99,102,241,0.4);
        }
        @keyframes tagPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
          50% { box-shadow: 0 0 12px -3px rgba(99,102,241,0.15); }
        }
      `}</style>
    </div>
  );
}
