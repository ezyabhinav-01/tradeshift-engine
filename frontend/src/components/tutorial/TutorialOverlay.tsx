import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '../../context/TutorialContext';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

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

  // Tooltip positioning logic
  const getTooltipPosition = () => {
    const cardWidth = Math.min(420, windowSize.width - 32);

    if (!targetRect || !currentStep.targetId) {
      return { top: '50%', left: '50%', x: '-50%', y: '-50%' };
    }

    const placement = currentStep.placement || 'bottom';
    if (placement === 'bottom') {
      return { top: Math.min(y + height + 20, windowSize.height - 24), left: x + width / 2, x: '-50%', y: '0%' };
    } else if (placement === 'top') {
      return { top: Math.max(y - 20, 24), left: x + width / 2, x: '-50%', y: '-100%' };
    } else if (placement === 'left') {
      if (x < cardWidth + 48) return { top: y + height + 20, left: x + width / 2, x: '-50%', y: '0%' };
      return { top: y + height / 2, left: x - 20, x: '-100%', y: '-50%' };
    } else if (placement === 'right') {
      if (x + width + cardWidth + 48 > windowSize.width) return { top: y + height + 20, left: x + width / 2, x: '-50%', y: '0%' };
      return { top: y + height / 2, left: x + width + 20, x: '0%', y: '-50%' };
    } else {
      return { top: '50%', left: '50%', x: '-50%', y: '-50%' }; // center fallback
    }
  };

  const tooltipPos = getTooltipPosition();

  // If tooltip goes out of bounds horizontally, adjust it
  let clampedLeft = tooltipPos.left;
  const cardWidth = Math.min(420, windowSize.width - 32);
  if (typeof clampedLeft === 'number') {
      const halfWidth = cardWidth / 2 + 16;
      if (clampedLeft < halfWidth) clampedLeft = halfWidth; 
      if (clampedLeft > windowSize.width - halfWidth) clampedLeft = windowSize.width - halfWidth;
  }

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

            {/* Tooltip Card - Premium Glassmorphism */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                top: tooltipPos.top, 
                left: clampedLeft,
                x: tooltipPos.x,
                y: tooltipPos.y
              }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
              className="absolute max-h-[calc(100vh-2rem)] overflow-y-auto bg-slate-950/95 dark:bg-black/90 backdrop-blur-2xl border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.55)] rounded-3xl p-6 sm:p-7 text-white"
              style={{ pointerEvents: 'auto', width: cardWidth }}
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

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-tv-primary/20 flex items-center justify-center text-tv-primary border border-tv-primary/30 shadow-[0_0_24px_rgba(41,98,255,0.22)]">
                  <Sparkles size={18} />
                </div>
                <div>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
