import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, Lock, KeyRound, ArrowLeft, AlertCircle, CheckCircle2, ShieldCheck, RefreshCw, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { Toaster, toast } from 'sonner';

const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState(1); // 1: Email/Phone, 2: OTP, 3: New Password
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    phone_number: '',
    otp_code: '',
    new_password: '',
    confirm_password: ''
  });

  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.phone_number) {
      setError('Please enter both email and phone number.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`/auth/forgot-password`, {
        email: formData.email,
        phone_number: `+91${formData.phone_number.replace(/[- ]/g, '')}`
      });
      toast.success(res.data.message || 'OTP sent to your email');
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Account not found or details mismatch.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.otp_code.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`/auth/verify-otp`, {
        email: formData.email,
        otp_code: formData.otp_code
      });
      toast.success(res.data.message || 'OTP verified successfully');
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.new_password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.new_password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`/auth/reset-password`, {
        email: formData.email,
        otp_code: formData.otp_code,
        new_password: formData.new_password
      });
      toast.success('Password updated successfully! Redirecting...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0E11] p-4 relative overflow-hidden font-inter">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tv-primary rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/80 dark:bg-[#1E222D]/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-8 transition-all duration-300">
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-tv-primary/10 text-tv-primary mb-4 transform transition-transform hover:scale-110">
              {step === 1 && <RefreshCw size={32} />}
              {step === 2 && <ShieldCheck size={32} />}
              {step === 3 && <KeyRound size={32} />}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
              {step === 1 && 'Forgot Password?'}
              {step === 2 && 'Verify Your Identity'}
              {step === 3 && 'New Password'}
            </h1>
            <p className="text-slate-500 dark:text-gray-400 text-sm">
              {step === 1 && "No worries! Enter your details to recover your account."}
              {step === 2 && `Enter the 6-digit code sent to ${formData.email}`}
              {step === 3 && "Secure your account with a strong new password."}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl flex items-center gap-3 text-sm mb-6 animate-shake">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 ml-1 uppercase tracking-wider">Registered Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm"
                    placeholder="name@gmail.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 ml-1 uppercase tracking-wider">Phone Number</label>
                <div className="relative group flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                    <Phone size={18} />
                    <span className="ml-2 pl-2 pr-2 border-r border-slate-200 dark:border-white/10 text-sm font-medium text-slate-600 dark:text-slate-300">
                      +91
                    </span>
                  </div>
                  <input
                    name="phone_number"
                    type="tel"
                    maxLength={10}
                    required
                    value={formData.phone_number}
                    onChange={handleChange}
                    className="block w-full pl-24 pr-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-2xl shadow-lg text-sm font-bold text-white bg-tv-primary hover:bg-tv-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tv-primary disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Send Verification Code"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="space-y-2 text-center">
                <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">6-Digit Code</label>
                <input
                  name="otp_code"
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={formData.otp_code}
                  onChange={handleChange}
                  className="block w-full px-4 py-4 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white text-center text-3xl font-bold tracking-[12px] focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all"
                  placeholder="000000"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-2xl shadow-lg text-sm font-bold text-white bg-tv-primary hover:bg-tv-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tv-primary disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Verify & Proceed"}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-slate-500 dark:text-gray-400 text-xs font-semibold hover:text-tv-primary transition-colors"
              >
                Didn't receive code? Try again
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 ml-1 uppercase tracking-wider">New Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    name="new_password"
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={formData.new_password}
                    onChange={handleChange}
                    className="block w-full pl-11 pr-11 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 ml-1 uppercase tracking-wider">Confirm Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    name="confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={formData.confirm_password}
                    onChange={handleChange}
                    className="block w-full pl-11 pr-11 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-2xl shadow-lg text-sm font-bold text-white bg-tv-primary hover:bg-tv-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tv-primary disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Reset Password"}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10 text-center">
            <Link to="/login" className="text-sm text-slate-500 dark:text-gray-400 font-bold hover:text-tv-primary transition-colors inline-flex items-center gap-2 group">
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
