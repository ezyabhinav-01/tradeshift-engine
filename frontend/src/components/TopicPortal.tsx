import { useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTopicTags } from '../hooks/useTopicTags';

/* ─────────────────────────────────────────────
   TopicPortal — Inline tag renderer
   Renders text with #tag-name as interactive links
───────────────────────────────────────────── */

interface TopicTagInlineProps {
  tagName: string;
  children: string;
}

function TopicTagInline({ tagName, children }: TopicTagInlineProps) {
  const navigate = useNavigate();
  const { resolveTag, resolveTagDetail, recordClick } = useTopicTags();
  const [hovered, setHovered] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const tag = resolveTag(tagName);
  const isRegistered = !!tag;

  const handleMouseEnter = useCallback(async () => {
    clearTimeout(timeoutRef.current);
    setHovered(true);
    if (!detail && !loadingDetail) {
      setLoadingDetail(true);
      const d = await resolveTagDetail(tagName);
      setDetail(d);
      setLoadingDetail(false);
    }
  }, [tagName, detail, loadingDetail, resolveTagDetail]);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setHovered(false), 200);
  }, []);

  const handleClick = useCallback(() => {
    if (isRegistered && detail?.navigateTo) {
      if (tag) recordClick(tag.id);
      navigate(detail.navigateTo);
    } else if (isRegistered && tag) {
      // Fallback navigation based on tag data
      const routes: Record<string, string> = {
        track: `/learn/track/${tag.targetId}`,
        module: `/learn/module/${tag.targetId}`,
        chapter: `/learn/chapter/${tag.targetId}`,
        lesson: `/learn/chapter/${tag.targetId}`,
      };
      recordClick(tag.id);
      navigate(routes[tag.targetType] || '/learn');
    }
  }, [isRegistered, detail, tag, navigate, recordClick]);

  return (
    <span className="relative inline-block" ref={ref}>
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`
          inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold text-[0.9em] cursor-pointer
          transition-all duration-300 select-none
          ${isRegistered
            ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/40 hover:shadow-[0_0_20px_-5px_rgba(99,102,241,0.4)]'
            : 'text-zinc-500 bg-zinc-800/30 border border-zinc-700/30 hover:bg-zinc-800/50 cursor-default'
          }
        `}
        style={{ 
          animation: isRegistered ? 'tagPulse 3s ease-in-out infinite' : 'none' 
        }}
      >
        {isRegistered && tag?.iconEmoji && (
          <span className="text-[0.85em] opacity-70">{tag.iconEmoji}</span>
        )}
        <span>{children}</span>
        {!isRegistered && (
          <span className="text-[0.7em] opacity-50 ml-0.5">?</span>
        )}
      </span>

      {/* ─── HOVER PREVIEW CARD ─── */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={() => clearTimeout(timeoutRef.current)}
            onMouseLeave={handleMouseLeave}
            className="absolute z-[999] left-0 top-full mt-2 w-80"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="bg-[#0d0d0d]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden">
              {isRegistered ? (
                <>
                  {/* Header */}
                  <div className="px-5 pt-5 pb-3">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{tag?.iconEmoji || '📘'}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black text-white tracking-tight truncate">
                          {detail?.displayName || tag?.displayName || tagName}
                        </h4>
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">
                          {detail?.targetType || tag?.targetType || 'Topic'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Summary */}
                    {(detail?.shortSummary || tag?.shortSummary) ? (
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {detail?.shortSummary || tag?.shortSummary}
                      </p>
                    ) : loadingDetail ? (
                      <div className="h-8 bg-zinc-800/50 rounded-lg animate-pulse" />
                    ) : (
                      <p className="text-xs text-zinc-600 italic">No description available</p>
                    )}
                  </div>

                  {/* Breadcrumb */}
                  {detail?.breadcrumb && (
                    <div className="px-5 py-2 border-t border-white/5">
                      <p className="text-[10px] text-zinc-500 font-medium truncate">
                        📍 {detail.breadcrumb}
                      </p>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02]">
                    <button
                      onClick={handleClick}
                      className="w-full py-2 bg-indigo-600 text-white text-xs font-black rounded-lg hover:bg-indigo-500 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                    >
                      Jump to Deep Dive →
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-5 text-center space-y-2">
                  <span className="text-2xl">🔍</span>
                  <p className="text-xs font-bold text-zinc-400">Tag not found</p>
                  <p className="text-[10px] text-zinc-600">
                    <span className="text-indigo-400 font-bold">#{tagName}</span> is not a registered topic in the Academy
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

/* ─────────────────────────────────────────────
   parseTextWithTags — Converts raw text with #tags into React elements
   Used for: comment content, any plain text
───────────────────────────────────────────── */

const TAG_REGEX = /#([a-zA-Z0-9][-a-zA-Z0-9]*)/g;

export function parseTextWithTags(text: string): ReactNode[] {
  if (!text) return [text];
  
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(TAG_REGEX.source, 'g');
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const tagName = match[1]; // capture group without #
    parts.push(
      <TopicTagInline key={`${match.index}-${tagName}`} tagName={tagName}>
        {`#${tagName}`}
      </TopicTagInline>
    );
    
    lastIndex = regex.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

/* ─────────────────────────────────────────────
   TopicPortalHydrator — Post-render DOM scanner for HTML content
   Finds <span class="topic-tag"> elements from tiptap_to_html
   and hydrates them with React portals for hover behavior
───────────────────────────────────────────── */

export function useTopicPortalHydrator(containerRef: React.RefObject<HTMLElement | null>) {
  const navigate = useNavigate();
  const { resolveTag, resolveTagDetail, recordClick } = useTopicTags();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const tagSpans = container.querySelectorAll('.topic-tag');
    
    tagSpans.forEach((span) => {
      const el = span as HTMLElement;
      const tagName = el.dataset.tag || '';
      const tag = resolveTag(tagName);
      const isRegistered = !!tag;

      // Style the span
      el.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.9em;
        cursor: ${isRegistered ? 'pointer' : 'default'};
        transition: all 0.3s;
        color: ${isRegistered ? '#818cf8' : '#71717a'};
        background: ${isRegistered ? 'rgba(99,102,241,0.1)' : 'rgba(39,39,42,0.3)'};
        border: 1px solid ${isRegistered ? 'rgba(99,102,241,0.2)' : 'rgba(63,63,70,0.3)'};
      `;

      if (isRegistered && tag) {
        // Add prefix emoji
        if (tag.iconEmoji) {
          const existingEmoji = el.querySelector('.tag-emoji');
          if (!existingEmoji) {
            const emojiSpan = document.createElement('span');
            emojiSpan.className = 'tag-emoji';
            emojiSpan.style.fontSize = '0.85em';
            emojiSpan.style.opacity = '0.7';
            emojiSpan.textContent = tag.iconEmoji;
            el.prepend(emojiSpan);
          }
        }

        // Hover glow
        el.addEventListener('mouseenter', () => {
          el.style.background = 'rgba(99,102,241,0.2)';
          el.style.borderColor = 'rgba(99,102,241,0.4)';
          el.style.boxShadow = '0 0 20px -5px rgba(99,102,241,0.4)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.background = 'rgba(99,102,241,0.1)';
          el.style.borderColor = 'rgba(99,102,241,0.2)';
          el.style.boxShadow = 'none';
        });

        // Click navigation
        el.addEventListener('click', async () => {
          recordClick(tag.id);
          const detail = await resolveTagDetail(tagName);
          if (detail?.navigateTo) {
            navigate(detail.navigateTo);
          } else {
            const routes: Record<string, string> = {
              track: `/learn/track/${tag.targetId}`,
              module: `/learn/module/${tag.targetId}`,
              chapter: `/learn/chapter/${tag.targetId}`,
              lesson: `/learn/chapter/${tag.targetId}`,
            };
            navigate(routes[tag.targetType] || '/learn');
          }
        });
      } else {
        // Unregistered tag indicator
        const existingQ = el.querySelector('.tag-unknown');
        if (!existingQ) {
          const qSpan = document.createElement('span');
          qSpan.className = 'tag-unknown';
          qSpan.style.fontSize = '0.7em';
          qSpan.style.opacity = '0.5';
          qSpan.style.marginLeft = '2px';
          qSpan.textContent = '?';
          el.append(qSpan);
        }
      }
    });
  }, [containerRef, resolveTag, resolveTagDetail, recordClick, navigate]);
}

export { TopicTagInline };
export default TopicTagInline;
