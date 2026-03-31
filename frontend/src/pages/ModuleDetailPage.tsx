import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLearnStore } from '../store/useLearnStore';
import { ArrowLeft, BookOpen, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import './LearnPage.css';

interface ModuleLesson {
  id: string;
  title: string;
  lessonNumber: string;
  description: string;
  subModuleTitle: string | null;
  duration: number;
  type: string;
}

interface ModuleDetail {
  id: string;
  title: string;
  description: string;
  moduleNumber: string;
  trackId: string;
  trackTitle: string;
  lessons: ModuleLesson[];
  totalLessons: number;
}

export default function ModuleDetailPage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
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
      <div className="flex flex-1 items-center justify-center min-h-[600px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading Module...</p>
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center p-8 min-h-[600px]">
        <BookOpen className="w-16 h-16 text-slate-400 mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-white mb-2">Module Not Found</h2>
        <button onClick={() => navigate('/learn')} className="text-emerald-500 hover:text-emerald-400 font-bold flex items-center gap-2 mt-4">
          <ArrowLeft size={16} /> Back to Learning Tracks
        </button>
      </div>
    );
  }

  const completedCount = module.lessons.filter(l => completedLessons.includes(l.id)).length;
  const progressPct = module.totalLessons > 0 ? Math.round((completedCount / module.totalLessons) * 100) : 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      {/* Clean top bar */}
      <div className="border-b border-white/5 bg-[#0a0a0a]/60 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/learn')}
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 font-medium"
          >
            <ArrowLeft size={14} /> Back to Learning Tracks
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full px-6 py-12">
        {/* Module Header - Varsity style */}
        <div className="mb-16">
          <div className="flex items-baseline gap-4 mb-2">
            {module.moduleNumber && (
              <span className="text-7xl font-black text-white/10">{module.moduleNumber}</span>
            )}
          </div>
          <div className="w-20 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full mb-4" />
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">{module.title}</h1>
          {module.trackTitle && (
            <p className="text-sm text-slate-400 font-medium">{module.trackTitle}</p>
          )}
          
          {/* Progress bar */}
          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-sm font-bold text-emerald-400">{completedCount}/{module.totalLessons} completed</span>
          </div>
        </div>

        {/* Chapter listing */}
        <div className="space-y-1">
          {module.lessons.map((lesson, index) => {
            const isCompleted = completedLessons.includes(lesson.id);
            return (
              <Link
                key={lesson.id}
                to={`/learn/${module.trackId}/${lesson.id}`}
                className="group block"
              >
                <div className={`flex items-start gap-5 py-6 px-2 border-b border-white/5 transition-all hover:bg-white/[0.02] rounded-lg hover:px-4 ${
                  isCompleted ? 'opacity-70' : ''
                }`}>
                  {/* Number or Check */}
                  <div className="flex-shrink-0 pt-0.5">
                    {isCompleted ? (
                      <CheckCircle2 size={22} className="text-emerald-500" />
                    ) : (
                      <span className="text-lg font-black text-emerald-500">{index + 1}.</span>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-lg font-bold mb-1 transition-colors ${
                      isCompleted
                        ? 'text-emerald-400'
                        : 'text-white group-hover:text-emerald-400'
                    }`}>
                      {lesson.title}
                    </h3>
                    {lesson.description && (
                      <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">
                        {lesson.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock size={12} /> {lesson.duration} min read
                      </span>
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <div className="flex-shrink-0 pt-1">
                    <ChevronRight size={18} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {module.lessons.length === 0 && (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">No published chapters yet.</p>
            <p className="text-xs text-slate-500 mt-1">Add and publish lessons from the Admin CMS.</p>
          </div>
        )}
      </div>
    </div>
  );
}
