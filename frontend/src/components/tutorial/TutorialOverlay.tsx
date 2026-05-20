import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '../../context/TutorialContext';
import {
  X,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  MousePointer2,
  Activity,
} from 'lucide-react';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const TutorialOverlay: React.FC = () => {
  const { isActive, currentStep, currentStepIndex, totalSteps, nextStep, prevStep, skipTour } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute position of target element and keep it visible as the tour moves between pages.
  useEffect(() => {
    if (!isActive || !currentStep) return;

    if (!currentStep.targetId) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.querySelector(`[data-tutorial="${currentStep.targetId}"]`);
      if (el) {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    const timers = [200, 550, 900].map((delay) => window.setTimeout(updateRect, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [isActive, currentStep, windowSize, currentStep?.route]);

  if (!isActive || !currentStep) return null;

  const PADDING = 12;
  const borderRadius = 20;

  // Mask dimensions
  const x = targetRect ? targetRect.left - PADDING : 0;
  const y = targetRect ? targetRect.top - PADDING : 0;
  const width = targetRect ? targetRect.width + PADDING * 2 : 0;
  const height = targetRect ? targetRect.height + PADDING * 2 : 0;

  const cardWidth = Math.min(440, windowSize.width - 32);
  const cardHeight = Math.min(430, windowSize.height - 32);

  // Tooltip positioning logic. The card must always remain fully reachable.
  const getTooltipPosition = () => {
    const margin = 16;
    const gap = 18;
    if (!targetRect || !currentStep.targetId) {
      return {
        top: Math.max(margin, (windowSize.height - cardHeight) / 2),
        left: Math.max(margin, (windowSize.width - cardWidth) / 2),
      };
    }

    const available = {
      top: y - margin - gap,
      bottom: windowSize.height - (y + height) - margin - gap,
      left: x - margin - gap,
      right: windowSize.width - (x + width) - margin - gap,
    };

    let placement = currentStep.placement || 'bottom';
    const hasVerticalRoom =
      (placement === 'top' && available.top >= cardHeight) ||
      (placement === 'bottom' && available.bottom >= cardHeight);
    const hasHorizontalRoom =
      (placement === 'left' && available.left >= cardWidth) ||
      (placement === 'right' && available.right >= cardWidth);

    if ((placement === 'top' || placement === 'bottom') && !hasVerticalRoom) {
      placement = available.top > available.bottom ? 'top' : 'bottom';
    }

    if ((placement === 'left' || placement === 'right') && !hasHorizontalRoom) {
      if (available.right >= cardWidth) placement = 'right';
      else if (available.left >= cardWidth) placement = 'left';
      else placement = available.top > available.bottom ? 'top' : 'bottom';
    }

    let top = margin;
    let left = margin;

    if (placement === 'bottom') {
      top = y + height + gap;
      left = x + width / 2 - cardWidth / 2;
    } else if (placement === 'top') {
      top = y - cardHeight - gap;
      left = x + width / 2 - cardWidth / 2;
    } else if (placement === 'left') {
      top = y + height / 2 - cardHeight / 2;
      left = x - cardWidth - gap;
    } else if (placement === 'right') {
      top = y + height / 2 - cardHeight / 2;
      left = x + width + gap;
    }

    return {
      top: clamp(top, margin, windowSize.height - cardHeight - margin),
      left: clamp(left, margin, windowSize.width - cardWidth - margin),
    };
  };

  const tooltipPos = getTooltipPosition();
  const sentimentTone = currentStepIndex % 3 === 1 ? 'bearish' : currentStepIndex % 3 === 2 ? 'neutral' : 'bullish';
  const coachMetric = sentimentTone === 'bearish' ? '-0.84%' : sentimentTone === 'neutral' ? 'Risk Check' : '+1.26%';

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none font-sans">
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 pointer-events-auto"
          >
            {/* SVG Mask for the Spotlight */}
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <mask id="tutorial-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {targetRect && (
                    <motion.rect
                      fill="black"
                      rx={borderRadius}
                      initial={false}
                      animate={{ x, y, width, height }}
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.7 }}
                    />
                  )}
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(2, 6, 23, 0.88)"
                mask="url(#tutorial-mask)"
              />
            </svg>

            {/* Glowing Border around target */}
            {targetRect && (
              <motion.div
                initial={false}
                animate={{ x, y, width, height }}
                transition={{ type: 'spring', bounce: 0.15, duration: 0.7 }}
                className="absolute border-[3px] border-tv-primary/60 rounded-[22px]"
                style={{
                  boxShadow: '0 0 30px rgba(41, 98, 255, 0.4), inset 0 0 15px rgba(41, 98, 255, 0.2)'
                }}
              />
            )}

            {targetRect && (
              <motion.div
                initial={false}
                animate={{
                  x: clamp(x + width - 28, 16, windowSize.width - 56),
                  y: clamp(y + height - 18, 16, windowSize.height - 56),
                }}
                transition={{ type: 'spring', bounce: 0.35, duration: 0.7 }}
                className="absolute flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white text-slate-950 shadow-[0_12px_35px_rgba(0,0,0,0.35)]"
              >
                <motion.div
                  animate={{ y: [0, -5, 0], rotate: [-10, -2, -10] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <MousePointer2 size={22} />
                </motion.div>
              </motion.div>
            )}

            {/* Tooltip Card - Premium Glassmorphism */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                top: tooltipPos.top, 
                left: tooltipPos.left,
              }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
              className="absolute overflow-hidden bg-slate-950/95 dark:bg-black/90 backdrop-blur-2xl border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.55)] rounded-3xl text-white"
              style={{ pointerEvents: 'auto', width: cardWidth, maxHeight: cardHeight }}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-tv-primary via-cyan-400 to-emerald-400" />
              <div className="absolute top-0 right-0 w-40 h-40 bg-tv-primary/10 blur-3xl -mr-20 -mt-20 pointer-events-none" />
              
              <button 
                onClick={skipTour}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                aria-label="Skip tutorial"
              >
                <X size={18} />
              </button>

              <div className="max-h-[inherit] overflow-y-auto p-6 sm:p-7">
              <div className="mb-5 flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0">
                  <motion.div
                    animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.8, 0.45] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 rounded-full bg-tv-primary/25"
                  />
                  <div className="absolute inset-2 overflow-hidden rounded-full border border-tv-primary/30 bg-gradient-to-br from-slate-800 to-black shadow-[0_0_30px_rgba(41,98,255,0.22)]">
                    <div className="absolute inset-x-3 top-3 h-2 rounded-full bg-emerald-400/40" />
                    <div className="absolute bottom-0 left-1/2 h-7 w-9 -translate-x-1/2 rounded-t-full bg-tv-primary/70" />
                    <div className="absolute left-1/2 top-5 h-4 w-4 -translate-x-1/2 rounded-full bg-slate-200" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-tv-primary/80">
                    {currentStep.focusLabel || 'Guide Insight'}
                  </h4>
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1 rounded-full transition-all duration-300 ${i === currentStepIndex ? 'w-4 bg-tv-primary' : 'w-1 bg-white/20'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-3 gap-2">
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
                  className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3"
                >
                  <TrendingUp size={16} className="mb-2 text-emerald-300" />
                  <div className="text-[10px] font-black uppercase text-emerald-200">Profit</div>
                  <div className="mt-1 text-xs font-black text-white">+2.4k</div>
                </motion.div>
                <motion.div
                  animate={{ y: [0, 3, 0] }}
                  transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
                  className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3"
                >
                  <TrendingDown size={16} className="mb-2 text-red-300" />
                  <div className="text-[10px] font-black uppercase text-red-200">Loss</div>
                  <div className="mt-1 text-xs font-black text-white">-0.8k</div>
                </motion.div>
                <motion.div
                  animate={{ opacity: [0.72, 1, 0.72] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3"
                >
                  <Activity size={16} className="mb-2 text-cyan-300" />
                  <div className="text-[10px] font-black uppercase text-cyan-200">Sentiment</div>
                  <div className="mt-1 text-xs font-black text-white">{coachMetric}</div>
                </motion.div>
              </div>
              
              <h3 className="text-xl font-black mb-3 text-white tracking-tight">{currentStep.title}</h3>
              <p className="text-[14px] text-slate-300 mb-7 leading-relaxed font-medium">
                {currentStep.content}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between mt-auto">
                <button
                  onClick={skipTour}
                  className="text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest px-2 text-left"
                >
                  Skip
                </button>
                <div className="flex gap-3 justify-end">
                  {currentStepIndex > 0 && (
                    <button
                      onClick={prevStep}
                      className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all active:scale-90 border border-white/10"
                      aria-label="Previous tutorial step"
                    >
                      <ChevronLeft size={20} />
                    </button>
                  )}
                  <button
                    onClick={nextStep}
                    className="flex items-center gap-2 px-6 h-10 rounded-2xl bg-tv-primary hover:bg-blue-600 text-white text-[13px] font-black transition-all active:scale-95 shadow-lg shadow-tv-primary/30"
                  >
                    {currentStepIndex === totalSteps - 1 ? 'Start Exploring' : 'Next Insight'}
                    <ChevronRight size={18} className={currentStepIndex === totalSteps - 1 ? 'hidden' : ''} />
                  </button>
                </div>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
