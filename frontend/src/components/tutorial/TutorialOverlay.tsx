import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '../../context/TutorialContext';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

export const TutorialOverlay: React.FC = () => {
  const { isActive, currentStep, currentStepIndex, nextStep, prevStep, skipTour, endTour, currentTour } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute position of target element
  useEffect(() => {
    if (!isActive || !currentStep) return;

    if (!currentStep.targetId) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const elements = document.querySelectorAll(`[data-tutorial="${currentStep.targetId}"]`);
      // Find the first visible element (width > 0)
      const el = Array.from(elements).find(e => {
        const rect = e.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        // If element not found, fallback to center or retry
        setTargetRect(null);
      }
    };

    updateRect();
    // Re-check after a brief delay in case of layout shifts
    const timer = setTimeout(updateRect, 300);
    return () => clearTimeout(timer);
  }, [isActive, currentStep, windowSize]);

  if (!isActive || !currentStep) return null;

  const PADDING = 8;
  const borderRadius = 12;

  // Mask dimensions
  const x = targetRect ? targetRect.left - PADDING : 0;
  const y = targetRect ? targetRect.top - PADDING : 0;
  const width = targetRect ? targetRect.width + PADDING * 2 : 0;
  const height = targetRect ? targetRect.height + PADDING * 2 : 0;

  // Tooltip positioning logic
  const getTooltipPosition = () => {
    if (!targetRect || !currentStep.targetId) {
      return { top: '50%', left: '50%', x: '-50%', y: '-50%' };
    }

    const placement = currentStep.placement || 'bottom';
    if (placement === 'bottom') {
      return { top: y + height + 16, left: x + width / 2, x: '-50%', y: '0%' };
    } else if (placement === 'top') {
      return { top: y - 16, left: x + width / 2, x: '-50%', y: '-100%' };
    } else if (placement === 'left') {
      return { top: y + height / 2, left: x - 16, x: '-100%', y: '-50%' };
    } else if (placement === 'right') {
      return { top: y + height / 2, left: x + width + 16, x: '0%', y: '-50%' };
    } else {
      return { top: '50%', left: '50%', x: '-50%', y: '-50%' }; // center fallback
    }
  };

  const tooltipPos = getTooltipPosition();

  // If tooltip goes out of bounds horizontally, adjust it (simplistic approach)
  let clampedLeft = tooltipPos.left;
  if (typeof clampedLeft === 'number') {
      if (clampedLeft < 150) clampedLeft = 150; // min distance from left edge
      if (clampedLeft > windowSize.width - 150) clampedLeft = windowSize.width - 150;
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 pointer-events-auto"
          >
            {/* SVG Mask for the Spotlight */}
            <svg
              className="absolute inset-0 w-full h-full"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <mask id="tutorial-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {targetRect && (
                    <motion.rect
                      fill="black"
                      rx={borderRadius}
                      initial={false}
                      animate={{ x, y, width, height }}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.7)"
                mask="url(#tutorial-mask)"
                onClick={skipTour} // Clicking outside skips/closes
              />
            </svg>

            {/* Pulsing ring around target */}
            {targetRect && (
              <motion.div
                initial={false}
                animate={{ x, y, width, height }}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                className="absolute border-2 border-tv-primary rounded-xl"
                style={{
                  boxShadow: '0 0 0 4px rgba(41, 98, 255, 0.2), 0 0 20px rgba(41, 98, 255, 0.4)'
                }}
              />
            )}

            {/* Tooltip Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                top: tooltipPos.top, 
                left: clampedLeft,
                x: tooltipPos.x,
                y: tooltipPos.y
              }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
              className="absolute w-[320px] bg-[#1E222D] border border-white/10 shadow-2xl rounded-2xl p-5 text-white"
              style={{ pointerEvents: 'auto' }}
            >
              <button 
                onClick={skipTour}
                className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-tv-primary bg-tv-primary/10 px-2 py-0.5 rounded-full">
                  Step {currentStepIndex + 1}
                </span>
              </div>
              
              <h3 className="text-lg font-bold mb-2">{currentStep.title}</h3>
              <p className="text-sm text-white/70 mb-6 leading-relaxed">
                {currentStep.content}
              </p>

              <div className="flex items-center justify-between">
                <button
                  onClick={skipTour}
                  className="text-xs font-bold text-white/40 hover:text-white transition-colors uppercase tracking-wider"
                >
                  Skip
                </button>
                <div className="flex gap-2">
                  {currentStepIndex > 0 && (
                    <button
                      onClick={prevStep}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                  <button
                    onClick={nextStep}
                    className="flex items-center gap-1 px-4 h-8 rounded-full bg-tv-primary hover:bg-blue-600 text-white text-xs font-bold transition-colors"
                  >
                    {/* Checking if it's the last step. Using a hacky way since we don't have total steps length easily available without passing it */}
                    {currentTour === 'global' && currentStepIndex === 4 ? 'Finish' : 'Next'}
                    <ChevronRight size={16} className="-mr-1" />
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
