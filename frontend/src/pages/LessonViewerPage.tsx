import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLearnStore } from '../store/useLearnStore';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Clock, BookOpen,
  MessageCircle, Send, ThumbsUp, Award, LineChart
} from 'lucide-react';
import './LearnPage.css';

interface SiblingLesson {
  id: string;
  title: string;
}

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
  moduleId: string | null;
  moduleTitle: string;
  trackId: string;
  xpReward: number;
  type: string;
  quizQuestions: QuizQuestion[];
  practiceSceneId?: string;
  siblings: SiblingLesson[];
}

interface Comment {
  id: string;
  author: string;
  timestamp: string;
  text: string;
  likes: number;
  liked: boolean;
}

export default function LessonViewerPage() {
  const { trackId, lessonId } = useParams();
  const navigate = useNavigate();
  const { completeLesson, completedLessons, logLearningTime } = useLearnStore();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isCompleted = lessonId ? completedLessons.includes(lessonId) : false;

  useEffect(() => {
    setLoading(true);
    setShowCompleted(false);
    async function fetchLesson() {
      try {
        const res = await fetch(`/api/learn/lessons/${lessonId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setLesson(data);
        // Load mock comments
        setComments([
          {
            id: '1',
            author: 'Arjun Mehta',
            timestamp: 'March 28, 2026',
            text: 'This was really well explained. The examples made it much easier to understand the concept.',
            likes: 12,
            liked: false,
          },
          {
            id: '2',
            author: 'Priya Sharma',
            timestamp: 'March 30, 2026',
            text: 'Can you add more real-world scenarios? Would love to see how this applies to the Indian markets specifically.',
            likes: 8,
            liked: false,
          },
        ]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchLesson();
    // Scroll to top when lesson changes
    window.scrollTo(0, 0);
  }, [lessonId]);

  // --- Active Learning Time Tracker ---
  useEffect(() => {
    // Only track if successfully loaded and observing a lesson
    if (loading || !lesson) return;
    
    // Log 1 minute of active learning time every 60 seconds
    const interval = setInterval(() => {
      // Pause tracking if the user minimizes or switches tabs
      if (!document.hidden) {
        logLearningTime(1);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [loading, lesson, logLearningTime]);

  // Find prev/next lessons
  const currentIndex = lesson?.siblings.findIndex(s => s.id === lessonId) ?? -1;
  const prevLesson = currentIndex > 0 ? lesson?.siblings[currentIndex - 1] : null;
  const nextLesson = lesson?.siblings && currentIndex < lesson.siblings.length - 1
    ? lesson.siblings[currentIndex + 1]
    : null;

  const handleComplete = () => {
    if (trackId && lessonId) {
      completeLesson(lessonId, trackId);
      setShowCompleted(true);
      setTimeout(() => setShowCompleted(false), 3000);
    }
  };

  const handleQuizSubmit = () => {
    setShowQuizResults(true);
  };

  const isQuizPassed = () => {
    if (!lesson || !lesson.quizQuestions || lesson.quizQuestions.length === 0) return true;
    if (!showQuizResults) return false;
    return lesson.quizQuestions.every((q, idx) => selectedAnswers[idx] === q.correct_index);
  };

  const allQuestionsAnswered = lesson?.quizQuestions?.length 
    ? Object.keys(selectedAnswers).length === lesson.quizQuestions.length
    : true;

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const comment: Comment = {
      id: Date.now().toString(),
      author: 'You',
      timestamp: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      text: newComment,
      likes: 0,
      liked: false,
    };
    setComments(prev => [comment, ...prev]);
    setNewComment('');
  };

  const handleLike = (commentId: string) => {
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, likes: c.liked ? c.likes - 1 : c.likes + 1, liked: !c.liked }
        : c
    ));
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[600px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading lesson...</p>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center p-8 min-h-[600px]">
        <BookOpen className="w-16 h-16 text-slate-400 mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-white mb-2">Lesson Not Found</h2>
        <button onClick={() => navigate('/learn')} className="text-emerald-500 hover:text-emerald-400 font-bold flex items-center gap-2 mt-4">
          <ArrowLeft size={16} /> Back to Academy
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-[#030303]">
      {/* Breadcrumb header */}
      <div className="border-b border-white/5 bg-[#0a0a0a]/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => navigate('/learn')} className="text-slate-400 hover:text-white transition-colors font-medium">
              Learn
            </button>
            <span className="text-slate-600">/</span>
            {lesson.moduleId && (
              <>
                <button
                  onClick={() => navigate(`/learn/module/${lesson.moduleId}`)}
                  className="text-slate-400 hover:text-white transition-colors font-medium truncate max-w-[200px]"
                >
                  {lesson.moduleTitle}
                </button>
                <span className="text-slate-600">/</span>
              </>
            )}
            <span className="text-white font-bold truncate max-w-[200px]">{lesson.title}</span>
          </div>
          {!isCompleted && (
            <span className="text-xs font-bold text-emerald-500/80 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
              <Award size={12} /> +{lesson.xpReward} XP
            </span>
          )}
        </div>
      </div>

      {/* Main reading area */}
      <div className="max-w-3xl mx-auto w-full px-6 py-16" ref={contentRef}>
        {/* Module subtitle */}
        {lesson.moduleTitle && (
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
            Module{lesson.lessonNumber ? ` ${lesson.lessonNumber.split('.')[0]}` : ''}. {lesson.moduleTitle}
          </p>
        )}
        
        {/* Green accent bar */}
        <div className="w-24 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full mb-6" />

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-snug mb-3">
          {lesson.lessonNumber && <span className="text-emerald-400 mr-1">{lesson.lessonNumber}.</span>}
          {lesson.title}
        </h1>

        {/* Duration */}
        <div className="flex items-center gap-3 text-sm text-slate-400 mb-12">
          <span className="flex items-center gap-1.5"><Clock size={14} /> ~5 min read</span>
        </div>

        {/* ─── ARTICLE CONTENT ─── */}
        {lesson.contentHtml ? (
          <div
            className="cms-content"
            dangerouslySetInnerHTML={{ __html: lesson.contentHtml }}
          />
        ) : (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Content is being prepared.</p>
          </div>
        )}

        {/* ─── SIMULATOR PRACTICE ─── */}
        {lesson.practiceSceneId && (
          <div className="mt-16 bg-gradient-to-br from-[#0f172a] to-[#020617] border border-indigo-500/20 rounded-3xl p-8 relative overflow-hidden group">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-700" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-4">
                  <LineChart size={14} /> Interactive Market Replay
                </div>
                <h3 className="text-2xl font-black text-white mb-2">Practice this setup in the real market</h3>
                <p className="text-slate-400 leading-relaxed text-sm">
                  Reading about it is just the first step. Jump into our high-fidelity trading simulator, load this exact historical scenario, and execute trades without risking real capital.
                </p>
              </div>
              <div>
                <a 
                  href={`/simulator?scene_id=${lesson.practiceSceneId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20 hover:shadow-indigo-500/30 w-full md:w-auto hover:-translate-y-0.5"
                >
                  Launch Simulator <ArrowRight size={16} />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ─── QUIZ ASSESSMENT ─── */}
        {lesson.quizQuestions && lesson.quizQuestions.length > 0 && (
          <div className="mt-16 pt-8 border-t border-white/10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Knowledge Check</h3>
                <p className="text-sm text-slate-400">Answer {lesson.quizQuestions.length} questions to complete this lesson.</p>
              </div>
            </div>

            <div className="space-y-8">
              {lesson.quizQuestions.map((q, qIdx) => {
                const isCorrect = showQuizResults && selectedAnswers[qIdx] === q.correct_index;
                const isWrong = showQuizResults && selectedAnswers[qIdx] !== undefined && selectedAnswers[qIdx] !== q.correct_index;

                return (
                  <div key={qIdx} className={`p-6 rounded-2xl border transition-all ${isCorrect ? 'bg-emerald-500/5 border-emerald-500/20' : isWrong ? 'bg-red-500/5 border-red-500/20' : 'bg-[#0f0f0f] border-white/5'}`}>
                    <h4 className="text-base font-bold text-white mb-4">
                      <span className="text-emerald-500 mr-2">{qIdx + 1}.</span> {q.question}
                    </h4>
                    
                    <div className="space-y-3">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = selectedAnswers[qIdx] === oIdx;
                        const showCorrectHighlight = showQuizResults && oIdx === q.correct_index;
                        const showWrongHighlight = showQuizResults && isSelected && oIdx !== q.correct_index;

                        return (
                          <button
                            key={oIdx}
                            disabled={showQuizResults}
                            onClick={() => setSelectedAnswers(prev => ({ ...prev, [qIdx]: oIdx }))}
                            className={`w-full text-left p-4 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20
                              ${showCorrectHighlight ? 'bg-emerald-500/20 border-emerald-500/50 text-white font-medium' : 
                                showWrongHighlight ? 'bg-red-500/20 border-red-500/50 text-white font-medium' : 
                                isSelected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium' : 
                                'bg-black/20 border-white/10 text-slate-300 hover:bg-white/5 hover:border-white/20'
                              }
                            `}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {showQuizResults && q.explanation && (
                      <div className={`mt-4 p-4 rounded-xl text-sm ${isCorrect ? 'bg-emerald-500/10 text-emerald-200' : 'bg-red-500/10 text-red-200'}`}>
                        <strong>Explanation:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!showQuizResults && (
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleQuizSubmit}
                  disabled={!allQuestionsAnswered}
                  className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Verify Answers
                </button>
              </div>
            )}
            
            {showQuizResults && !isQuizPassed() && (
              <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
                <div className="text-red-400 font-medium">Some answers are incorrect. Please review the material and try again.</div>
                <button 
                  onClick={() => { setShowQuizResults(false); setSelectedAnswers({}); }}
                  className="px-4 py-2 bg-red-500/20 text-red-200 font-bold rounded-lg hover:bg-red-500/30 transition-colors pointer-events-auto"
                >
                  Retry Quiz
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── PREV / NEXT NAVIGATION ─── */}
        <div className="mt-20 pt-8 border-t border-white/5">
          <div className="flex items-center justify-between">
            {/* Chapters link */}
            {lesson.moduleId && (
              <Link
                to={`/learn/module/${lesson.moduleId}`}
                className="text-sm font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                ← Chapters
              </Link>
            )}
            
            <div className="flex items-center gap-6 ml-auto">
              {prevLesson && (
                <Link
                  to={`/learn/${lesson.trackId}/${prevLesson.id}`}
                  className="flex items-center gap-2 text-sm font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  <ArrowLeft size={16} /> Previous
                </Link>
              )}
              {nextLesson && (
                <Link
                  to={`/learn/${lesson.trackId}/${nextLesson.id}`}
                  className="flex items-center gap-2 text-sm font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  Next <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ─── COMPLETE BUTTON ─── */}
        {!isCompleted && (
          <div className="mt-12">
            <button
              onClick={handleComplete}
              disabled={!isQuizPassed()}
              className={`group w-full py-4 rounded-2xl font-bold text-base shadow-lg flex items-center justify-center gap-3 transition-all ${
                isQuizPassed() 
                  ? 'text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/15 hover:shadow-xl hover:shadow-emerald-500/20 active:scale-[0.98]' 
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
              }`}
            >
              <CheckCircle2 size={20} />
              {lesson.quizQuestions?.length > 0 && !isQuizPassed() 
                ? 'Pass Quiz to Complete Lesson' 
                : `Mark as Completed — Earn ${lesson.xpReward} XP`
              }
            </button>
          </div>
        )}
        
        {/* XP Completion toast */}
        {showCompleted && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center animate-in fade-in">
            <p className="text-emerald-400 font-bold flex items-center justify-center gap-2">
              <Award size={18} /> +{lesson.xpReward} XP earned! Great work! 🎉
            </p>
          </div>
        )}

        {isCompleted && !showCompleted && (
          <div className="mt-12 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-center">
            <p className="text-sm text-emerald-400/80 font-medium flex items-center justify-center gap-2">
              <CheckCircle2 size={16} /> You've completed this lesson
            </p>
          </div>
        )}

        {/* ─── COMMENTS SECTION ─── */}
        <div className="mt-20 pt-8 border-t border-white/5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-8">
            <MessageCircle size={20} className="text-emerald-500" />
            <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded text-sm mr-1">{comments.length}</span>
            comments
          </h3>

          {/* Comment input */}
          <div className="flex gap-3 mb-8">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              Y
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your thoughts on this chapter..."
                rows={3}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 resize-none transition-all"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  <Send size={14} /> Post Comment
                </button>
              </div>
            </div>
          </div>

          {/* Comments list */}
          <div className="space-y-6">
            {comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400 font-bold text-sm flex-shrink-0 border border-white/5">
                  {comment.author.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-bold text-white">{comment.author}</span>
                    <span className="text-xs text-slate-500">{comment.timestamp}</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed mb-2">{comment.text}</p>
                  <button
                    onClick={() => handleLike(comment.id)}
                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                      comment.liked ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <ThumbsUp size={12} /> {comment.likes}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom spacer */}
        <div className="h-20" />
      </div>
    </div>
  );
}
