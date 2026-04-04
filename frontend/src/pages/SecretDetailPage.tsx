import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLearnStore } from '../store/useLearnStore';
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, Sparkles, KeyRound, CheckCircle2, XCircle, Trophy, Zap } from 'lucide-react';

export default function SecretDetailPage() {
  const { secretId } = useParams();
  const navigate = useNavigate();
  const { fetchSecrets, secrets, submitSecretQuiz } = useLearnStore();
  const [loading, setLoading] = useState(secrets.length === 0);

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<{
    score: number;
    totalQuestions: number;
    xpEarned: number;
    correctAnswers: number[];
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showXpAnimation, setShowXpAnimation] = useState(false);

  useEffect(() => {
    if (secrets.length === 0) {
      fetchSecrets().finally(() => setLoading(false));
    }
  }, [secrets.length, fetchSecrets]);

  const currentIndex = useMemo(() => {
    if (!secretId || secrets.length === 0) return -1;
    return secrets.findIndex(s => s.id === parseInt(secretId, 10));
  }, [secrets, secretId]);

  const secret = currentIndex >= 0 ? secrets[currentIndex] : null;
  const prevSecret = currentIndex > 0 ? secrets[currentIndex - 1] : null;
  const nextSecret = currentIndex >= 0 && currentIndex < secrets.length - 1 ? secrets[currentIndex + 1] : null;

  // Reset quiz state when navigating to a different secret
  useEffect(() => {
    setSelectedAnswers({});
    setQuizResult(null);
    setShowXpAnimation(false);
  }, [secretId]);

  const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
    if (quizResult) return; // Don't allow changes after submission
    setSelectedAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const handleSubmitQuiz = async () => {
    if (!secret || !secret.quizQuestions) return;
    const totalQuestions = secret.quizQuestions.length;
    const answers = Array.from({ length: totalQuestions }, (_, i) => selectedAnswers[i] ?? -1);

    if (answers.includes(-1)) return; // All questions must be answered

    setSubmitting(true);
    const result = await submitSecretQuiz(secret.id, answers);
    setSubmitting(false);

    if (result) {
      setQuizResult(result);
      // Trigger XP animation
      setTimeout(() => setShowXpAnimation(true), 300);
    }
  };

  const allAnswered = secret?.quizQuestions
    ? Object.keys(selectedAnswers).length === secret.quizQuestions.length
    : false;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[600px]">
        <div className="flex flex-col items-center gap-4 text-purple-400">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm font-bold uppercase tracking-widest">Decrypting Secret...</p>
        </div>
      </div>
    );
  }

  if (!secret) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[600px] flex-col gap-6">
        <div className="w-24 h-24 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center">
          <KeyRound size={40} className="text-zinc-600" />
        </div>
        <h2 className="text-2xl font-black text-white">Secret Not Found</h2>
        <button
          onClick={() => navigate('/learn')}
          className="px-6 py-2 bg-purple-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-purple-400 transition"
        >
          <ArrowLeft size={16} /> Back to Academy
        </button>
      </div>
    );
  }

  if (!secret.isRevealed) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[600px] flex-col gap-6 p-4">
        <div className="relative group cursor-pointer" onClick={() => navigate('/learn')}>
          <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full group-hover:bg-purple-500/30 transition-all"></div>
          <div className="w-32 h-32 bg-[#0a0a0a] rounded-full border border-purple-500/20 flex flex-col items-center justify-center relative z-10 hover:border-purple-500/50 transition-all">
            <Lock size={40} className="text-purple-400 mb-2" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-black text-white mb-2">{secret.question}</h2>
          <p className="text-zinc-500 font-medium">This secret implies forbidden market knowledge. Reveal it from the Academy page first.</p>
        </div>
        <button
          onClick={() => navigate('/learn')}
          className="mt-4 px-6 py-3 bg-purple-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-purple-400 transition shadow-lg shadow-purple-500/20"
        >
          <ArrowLeft size={16} /> Return to Learn Page
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-black pb-20">
      {/* Header Overlay */}
      <div className="sticky top-0 z-40 bg-black/60 backdrop-blur-xl border-b border-zinc-800/80">
        <div className="max-w-4xl mx-auto w-full px-4 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/learn')}
            className="w-10 h-10 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-purple-400">
            <Sparkles size={14} /> Market Secret
          </div>
          <div className="w-10 h-10"></div> {/* Spacer for center alignment */}
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full px-4 lg:px-8 py-10 space-y-10">
        
        {/* Core Secret Focus Area */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 rounded-3xl blur-2xl opacity-50"></div>
          <div className="relative bg-[#0a0a0a] border border-purple-500/20 rounded-3xl p-8 sm:p-12 shadow-2xl">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 border-b border-purple-500/10 pb-8">
              <div>
                <span className="text-6xl block mb-6 drop-shadow-xl">{secret.iconEmoji}</span>
                <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight tracking-tight">
                  {secret.question}
                </h1>
              </div>
              <div className="shrink-0 self-start sm:self-center">
                <div className={`px-4 py-2 rounded-2xl border flex flex-col items-center justify-center gap-1 ${
                  secret.quizCompleted || !secret.hasQuiz
                    ? 'bg-purple-500/10 border-purple-500/20'
                    : 'bg-amber-500/10 border-amber-500/20'
                }`}>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    secret.quizCompleted || !secret.hasQuiz ? 'text-purple-400/80' : 'text-amber-400/80'
                  }`}>
                    {secret.quizCompleted || !secret.hasQuiz ? 'Reward Earned' : 'Complete Quiz for XP'}
                  </span>
                  <span className={`text-lg font-black ${
                    secret.quizCompleted || !secret.hasQuiz ? 'text-purple-400' : 'text-amber-400'
                  }`}>
                    {secret.quizCompleted ? `+${secret.xpEarned} XP` : !secret.hasQuiz ? `+${secret.xpReward} XP` : `Up to +${secret.xpReward} XP`}
                  </span>
                </div>
              </div>
            </div>

            {/* Answer Display */}
            <div className="prose prose-invert prose-purple max-w-none prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:text-base prose-strong:text-purple-300 prose-a:text-purple-400 cms-content">
              {secret.answerHtml ? (
                <div dangerouslySetInnerHTML={{ __html: secret.answerHtml }} />
              ) : (
                <p className="italic text-zinc-500">The market has hidden this answer...</p>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* QUIZ SECTION */}
        {/* ═══════════════════════════════════════════ */}
        {secret.hasQuiz && !secret.quizCompleted && secret.quizQuestions && secret.quizQuestions.length > 0 && (
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-3xl blur-2xl opacity-40"></div>
            <div className="relative bg-[#0a0a0a] border border-amber-500/20 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-8">
              
              {/* Quiz Header */}
              <div className="flex items-center gap-3 border-b border-amber-500/10 pb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Zap size={20} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Knowledge Check</h3>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">
                    Answer correctly to earn up to <span className="text-amber-400 font-bold">+{secret.xpReward} XP</span>
                  </p>
                </div>
              </div>

              {/* Questions */}
              {secret.quizQuestions.map((q, qIndex) => (
                <div key={qIndex} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-black text-zinc-400 shrink-0 mt-0.5">
                      {qIndex + 1}
                    </span>
                    <p className="text-base font-bold text-white leading-snug">{q.question}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-10">
                    {q.options.map((option, oIndex) => {
                      const isSelected = selectedAnswers[qIndex] === oIndex;
                      const isCorrect = quizResult && quizResult.correctAnswers[qIndex] === oIndex;
                      const isWrong = quizResult && isSelected && !isCorrect;

                      let optionStyle = 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white';
                      if (isSelected && !quizResult) {
                        optionStyle = 'bg-purple-500/10 border-purple-500/40 text-purple-300 ring-1 ring-purple-500/20';
                      }
                      if (quizResult && isCorrect) {
                        optionStyle = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300';
                      }
                      if (isWrong) {
                        optionStyle = 'bg-red-500/10 border-red-500/40 text-red-300';
                      }

                      return (
                        <button
                          key={oIndex}
                          onClick={() => handleSelectAnswer(qIndex, oIndex)}
                          disabled={!!quizResult}
                          className={`p-3 rounded-xl border text-left text-sm font-medium transition-all duration-200 flex items-center gap-3 ${optionStyle}`}
                        >
                          <span className={`w-6 h-6 rounded-md border flex items-center justify-center text-xs font-black shrink-0 transition-colors ${
                            isSelected && !quizResult
                              ? 'bg-purple-500 border-purple-400 text-white'
                              : quizResult && isCorrect
                                ? 'bg-emerald-500 border-emerald-400 text-white'
                                : isWrong
                                  ? 'bg-red-500 border-red-400 text-white'
                                  : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                          }`}>
                            {quizResult && isCorrect ? <CheckCircle2 size={14} /> :
                             isWrong ? <XCircle size={14} /> :
                             String.fromCharCode(65 + oIndex)}
                          </span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Submit Button or Results */}
              {!quizResult ? (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={!allAnswered || submitting}
                  className={`w-full py-4 rounded-2xl font-black text-base uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${
                    allAnswered
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20 cursor-pointer'
                      : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                  }`}
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Grading...
                    </>
                  ) : (
                    <>
                      <Zap size={18} />
                      {allAnswered ? 'Submit & Earn XP' : `Answer All ${secret.quizQuestions.length} Questions`}
                    </>
                  )}
                </button>
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 p-6">
                  {/* XP Float Animation */}
                  {showXpAnimation && quizResult.xpEarned > 0 && (
                    <div className="absolute top-2 right-6 xp-popup text-2xl font-black text-purple-400">
                      +{quizResult.xpEarned} XP
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                      <Trophy size={28} className="text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white mb-1">
                        {quizResult.score === quizResult.totalQuestions ? '🎯 Perfect Score!' :
                         quizResult.score > quizResult.totalQuestions / 2 ? '🔥 Great Job!' :
                         '📚 Keep Learning!'}
                      </h4>
                      <p className="text-sm text-zinc-400 font-medium">
                        You got <span className="text-emerald-400 font-bold">{quizResult.score}/{quizResult.totalQuestions}</span> correct
                        and earned <span className="text-purple-400 font-bold">+{quizResult.xpEarned} XP</span>
                      </p>
                    </div>
                  </div>

                  {/* Score Bar */}
                  <div className="mt-4">
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-out"
                        style={{ width: `${(quizResult.score / quizResult.totalQuestions) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quiz Completed Badge (for already completed quizzes) */}
        {secret.hasQuiz && secret.quizCompleted && !quizResult && (
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <span className="text-sm font-bold text-emerald-400">
              Quiz completed — You scored {secret.quizScore !== undefined ? `${secret.quizScore}` : '—'} and earned +{secret.xpEarned} XP
            </span>
          </div>
        )}

        {/* Navigation Controls */}
        <div className="flex items-center justify-between gap-4 pt-8 border-t border-zinc-900">
          {prevSecret ? (
            <Link
              to={`/learn/secret/${prevSecret.id}`}
              className="flex-1 flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-900 transition group"
            >
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white transition">
                <ChevronLeft size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Previous</div>
                <div className="text-sm font-bold text-zinc-300 truncate group-hover:text-white transition">{prevSecret.question}</div>
              </div>
            </Link>
          ) : (
            <div className="flex-1"></div>
          )}

          {nextSecret ? (
            <Link
              to={`/learn/secret/${nextSecret.id}`}
              className="flex-1 flex items-center justify-end gap-4 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-900 transition group text-right"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Next</div>
                <div className="text-sm font-bold text-zinc-300 truncate group-hover:text-white transition">{nextSecret.question}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white transition">
                <ChevronRight size={20} />
              </div>
            </Link>
          ) : (
            <div className="flex-1"></div>
          )}
        </div>

      </div>
    </div>
  );
}
