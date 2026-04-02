import React from 'react';
import { X, Lock, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AccessRestrictedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccessRestrictedModal: React.FC<AccessRestrictedModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#050505]/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        
        {/* Top Accent Gradient */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-tv-primary to-purple-600"></div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-all z-10"
        >
          <X size={20} />
        </button>

        <div className="p-8 pt-10 flex flex-col items-center text-center">
          
          {/* Icon Area */}
          <div className="relative mb-8">
            <div className="w-20 h-20 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-600/20 rotate-12 group-hover:rotate-0 transition-transform duration-500">
              <Lock size={32} className="text-tv-primary -rotate-12" />
            </div>
            <div className="absolute -top-2 -right-2 bg-amber-500 rounded-lg p-1.5 shadow-lg animate-bounce">
              <Sparkles size={16} className="text-white" />
            </div>
          </div>

          {/* Text Content */}
          <h2 className="text-2xl font-black text-white tracking-tight leading-tight mb-4 px-2">
            Unlock Full Trading <span className="text-tv-primary italic">Potential</span>
          </h2>
          
          <p className="text-slate-400 font-medium text-sm leading-relaxed mb-8 px-4">
            Sign up to unlock full access and start your trading journey anytime, anywhere. Experience real-time execution, AI-powered insights, and community-driven strategies.
          </p>

          {/* Benefits Grid */}
          <div className="grid grid-cols-2 gap-3 w-full mb-8">
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
              <ShieldCheck size={14} className="text-green-500" />
              <span className="text-[10px] font-black uppercase text-white/60">Live Trading</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
              <ShieldCheck size={14} className="text-blue-500" />
              <span className="text-[10px] font-black uppercase text-white/60">AI Analysis</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full">
            <button 
              onClick={() => { onClose(); navigate('/signup'); }}
              className="w-full py-4 bg-tv-primary hover:bg-tv-primary/90 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-tv-primary/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              Start Journey
              <ArrowRight size={18} />
            </button>
            
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-xs text-slate-500 font-medium">Already have an account?</span>
              <button 
                onClick={() => { onClose(); navigate('/login'); }}
                className="text-xs text-tv-primary font-black uppercase tracking-wider hover:underline"
              >
                Log In
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-8 py-4 bg-white/[0.02] border-t border-white/5 text-[10px] text-white/20 font-bold uppercase tracking-tighter text-center">
            Zero friction • 100% Secure • Professional Grade
        </div>
      </div>
    </div>
  );
};
