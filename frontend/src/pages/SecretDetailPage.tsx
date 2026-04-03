import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLearnStore } from '../store/useLearnStore';
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, Sparkles, KeyRound } from 'lucide-react';

export default function SecretDetailPage() {
  const { secretId } = useParams();
  const navigate = useNavigate();
  const { fetchSecrets, secrets } = useLearnStore();
  const [loading, setLoading] = useState(secrets.length === 0);

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
                <div className="px-4 py-2 bg-purple-500/10 rounded-2xl border border-purple-500/20 flex flex-col items-center justify-center gap-1">
                  <span className="text-[10px] font-black uppercase text-purple-400/80 tracking-widest">Reward Earned</span>
                  <span className="text-lg font-black text-purple-400">+{secret.xpReward} XP</span>
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
