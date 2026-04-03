import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Shield, AlertCircle, ArrowLeft, Calendar, Mail, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { PremiumDatePicker } from '@/components/ui/PremiumDatePicker';
import OtpInput from '@/components/ui/OtpInput';
import type { OtpInputRef } from '@/components/ui/OtpInput';

const PinVerification: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Try to get email from Login redirect state
  const initialEmail = location.state?.email || '';

  const [mode, setMode] = useState<'verify' | 'forgot'>('verify');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  
  // Verify State
  const [email, setEmail] = useState(initialEmail);
  const [pin, setPin] = useState('');
  
  // Forgot State
  const [dob, setDob] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const pinRef = useRef<OtpInputRef>(null);

  const calculateAge = (dobString: string) => {
    if (!dobString) return 0;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  useEffect(() => {
    if (!initialEmail && mode === 'verify') {
      setError('Session email not found. Please enter your email manually or log in again.');
    }
  }, [initialEmail, mode]);

  const handleVerify = async (e: React.FormEvent, overridePin?: string) => {
    e.preventDefault();
    const finalPin = overridePin || pin;
    setError(null);
    setSuccess(null);
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.verifyEmail = 'Email is required';
    if (!finalPin) {
      errs.pin = 'Security PIN is required';
    } else if (finalPin.length !== 4 || !/^\d+$/.test(finalPin)) {
      errs.pin = 'PIN must be exactly 4 digits';
    }
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      await axios.post('/auth/verify-pin', { email, pin: finalPin });
      let from = location.state?.from || '/trade';
      // If we came from home or landing, stay there
      if (from === '/' || from === '/landing') {
        from = from; 
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Please enter correct security pin');
      pinRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.forgotEmail = 'Email is required';
    if (!dob) {
      errs.dob = 'Date of Birth is required';
    } else if (calculateAge(dob) < 12) {
      errs.dob = 'You must be at least 12 years old';
    }
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      await axios.post('/auth/verify-identity', { email, dob });
      setSuccess('Identity verified! Please create your new PIN.');
      setForgotStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid Date of Birth or Email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const errs: Record<string, string> = {};
    if (!newPin) {
      errs.newPin = 'New PIN is required';
    } else if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      errs.newPin = 'New PIN must be exactly 4 digits';
    }
    if (!confirmPin) {
      errs.confirmPin = 'Please confirm your PIN';
    } else if (newPin !== confirmPin) {
      errs.confirmPin = 'PINs do not match';
    }
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      await axios.post('/auth/reset-pin', { email, dob, new_pin: newPin });
      setSuccess('PIN reset successfully! Please verify using your new PIN.');
      setMode('verify');
      setForgotStep(1);
      setPin('');
      setNewPin('');
      setConfirmPin('');
      setDob('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset PIN. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0E11] p-4 relative overflow-hidden font-inter">
      {/* Decorative background elements matching Login & Signup */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-tv-primary rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10 transition-all duration-300">
        <div className="bg-white/80 dark:bg-[#1E222D]/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-8 md:p-10">
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-tv-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-tv-primary/20">
              <Shield className="text-tv-primary" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
              {mode === 'verify' ? 'Security PIN' : 'Reset PIN'}
            </h1>
            <p className="text-slate-500 dark:text-gray-400">
              {mode === 'verify' 
                ? 'Enter your 4-digit security PIN to continue' 
                : 'Verify your identity to create a new PIN'}
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 p-3.5 rounded-xl flex items-center gap-3 text-sm animate-shake">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 text-green-600 dark:text-green-400 p-3.5 rounded-xl flex items-center gap-3 text-sm">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {mode === 'verify' ? (
            <form onSubmit={handleVerify} className="space-y-6">
              {!initialEmail && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Email Address</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setFieldErrors((p: Record<string, string>) => { const n = {...p}; delete n['verifyEmail']; return n; }); }}
                      className={`block w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-white/5 border rounded-xl leading-5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all sm:text-sm ${ fieldErrors.verifyEmail ? 'border-red-500 focus:ring-red-500/50' : 'border-slate-200 dark:border-white/10 focus:ring-tv-primary/50 focus:border-tv-primary' }`}
                      placeholder="name@example.com"
                    />
                  </div>
                  {fieldErrors.verifyEmail && <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1"><AlertCircle size={12}/>{fieldErrors.verifyEmail}</p>}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Enter PIN</label>
                  <button 
                    type="button" 
                    onClick={() => { setMode('forgot'); setError(null); setSuccess(null); }}
                    className="text-xs text-tv-primary hover:underline transition-all font-medium focus:outline-none"
                  >
                    Forgot PIN?
                  </button>
                </div>
                <div className="flex justify-center pt-2">
                  <OtpInput 
                    ref={pinRef}
                    length={4} 
                    type="password"
                    disabled={loading}
                    onComplete={(code) => {
                      setPin(code);
                      const submitEvent = { preventDefault: () => {} } as React.FormEvent;
                      setTimeout(() => handleVerify(submitEvent, code), 100);
                    }} 
                  />
                </div>
                {fieldErrors.pin && <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1"><AlertCircle size={12}/>{fieldErrors.pin}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-tv-primary hover:bg-tv-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tv-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-4"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span>Verify Identity</span>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={forgotStep === 1 ? handleVerifyIdentity : handleResetPin} className="space-y-5">
              {forgotStep === 1 ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setFieldErrors((p: Record<string, string>) => { const n = {...p}; delete n['forgotEmail']; return n; }); }}
                        className={`block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border rounded-xl leading-5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all sm:text-sm ${ fieldErrors.forgotEmail ? 'border-red-500 focus:ring-red-500/50' : 'border-slate-200 dark:border-white/10 focus:ring-tv-primary/50 focus:border-tv-primary' }`}
                        placeholder="name@example.com"
                      />
                    </div>
                    {fieldErrors.forgotEmail && <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1"><AlertCircle size={12}/>{fieldErrors.forgotEmail}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Date of Birth</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                        <Calendar size={18} />
                      </div>
                      <PremiumDatePicker
                        value={dob}
                        onChange={(val) => { setDob(val); setFieldErrors((p: Record<string, string>) => { const n = {...p}; delete n['dob']; return n; }); }}
                        placeholder="Select Date of Birth"
                      />
                    </div>
                    {fieldErrors.dob && <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1"><AlertCircle size={12}/>{fieldErrors.dob}</p>}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">New PIN</label>
                    <div className="relative">
                      <input
                        type={showNewPin ? "text" : "password"}
                        maxLength={4}
                        value={newPin}
                        onChange={(e) => { setNewPin(e.target.value); setFieldErrors((p: Record<string, string>) => { const n = {...p}; delete n['newPin']; return n; }); }}
                        className={`block w-full pl-4 pr-10 py-2.5 bg-slate-100 dark:bg-white/5 border rounded-xl leading-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all text-center tracking-[0.5em] font-mono ${ fieldErrors.newPin ? 'border-red-500 focus:ring-red-500/50' : 'border-slate-200 dark:border-white/10 focus:ring-tv-primary/50 focus:border-tv-primary' }`}
                        placeholder="••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPin(!showNewPin)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
                      >
                        {showNewPin ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fieldErrors.newPin && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12}/>{fieldErrors.newPin}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Confirm PIN</label>
                    <div className="relative">
                      <input
                        type={showConfirmPin ? "text" : "password"}
                        maxLength={4}
                        value={confirmPin}
                        onChange={(e) => { setConfirmPin(e.target.value); setFieldErrors((p: Record<string, string>) => { const n = {...p}; delete n['confirmPin']; return n; }); }}
                        className={`block w-full pl-4 pr-10 py-2.5 bg-slate-100 dark:bg-white/5 border rounded-xl leading-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all text-center tracking-[0.5em] font-mono ${ fieldErrors.confirmPin ? 'border-red-500 focus:ring-red-500/50' : 'border-slate-200 dark:border-white/10 focus:ring-tv-primary/50 focus:border-tv-primary' }`}
                        placeholder="••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPin(!showConfirmPin)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
                      >
                        {showConfirmPin ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fieldErrors.confirmPin && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12}/>{fieldErrors.confirmPin}</p>}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-tv-primary hover:bg-tv-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tv-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-4"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span>{forgotStep === 1 ? 'Verify Identity' : 'Reset Security PIN'}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (forgotStep === 2) {
                    setForgotStep(1);
                    setError(null);
                    setSuccess(null);
                  } else {
                    setMode('verify');
                    setError(null);
                    setSuccess(null);
                  }
                }}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all focus:outline-none"
              >
                <ArrowLeft size={16} />
                <span>{forgotStep === 2 ? 'Back' : 'Back to Login'}</span>
              </button>
            </form>
          )}
        </div>
        
        {/* Helper footer */}
        {mode === 'verify' && (
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500 dark:text-gray-500 flex items-center justify-center gap-2">
              <Link to="/login" className="hover:text-slate-700 dark:hover:text-gray-300 transition-colors inline-flex items-center gap-1">
                <ArrowLeft size={14} /> Log in to a different account
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PinVerification;
