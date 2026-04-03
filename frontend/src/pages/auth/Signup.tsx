import React, { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Mail, Lock, User, Shield,
  UserPlus, AlertCircle,
  Layers, MapPin, Phone, Eye, EyeOff,
  Share2, Target
} from 'lucide-react';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { PremiumDatePicker } from '@/components/ui/PremiumDatePicker';
import OtpInput from '@/components/ui/OtpInput';
import type { OtpInputRef } from '@/components/ui/OtpInput';

const EXPERIENCE_OPTIONS = [
  { value: 'Beginner', label: 'Beginner' },
  { value: 'Intermediate', label: 'Intermediate' },
  { value: 'Advance', label: 'Advance' }
];
const GOAL_OPTIONS = [
  { value: 'Learn', label: 'Learn' },
  { value: 'Growth', label: 'Growth' },
  { value: 'Income', label: 'Income' },
  { value: 'Speculation', label: 'Speculation' }
];

const SOURCE_OPTIONS = [
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Google Search', label: 'Google Search' },
  { value: 'Friend/Family', label: 'Friend/Family' },
  { value: 'Advertisement', label: 'Advertisement' },
  { value: 'Other', label: 'Other' }
];

const Signup: React.FC = () => {
  const location = useLocation();
  const [step, setStep] = useState(location.state?.step || 1); // 1: Details, 2: OTP, 3: PIN
  const [formData, setFormData] = useState({
    email: location.state?.email || '',
    password: '',
    full_name: '',
    dob: '',
    phone_number: '',
    experience_level: 'Beginner',
    investment_goals: 'Learn',
    preferred_instruments: [] as string[],
    risk_tolerance: 'Moderate',
    occupation: 'Student',
    city: '',
    how_heard_about: 'Social Media',
    security_pin: ''
  });
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { register, verifySignupOtp, finalizeSignupPin } = useAuth();
  const navigate = useNavigate();
  const otpRef = useRef<OtpInputRef>(null);
  const pinRef = useRef<OtpInputRef>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev: Record<string, string>) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleInstrumentChange = (instrument: string) => {
    setFormData(prev => {
      const current = prev.preferred_instruments;
      if (current.includes(instrument)) {
        return { ...prev, preferred_instruments: current.filter(i => i !== instrument) };
      } else {
        return { ...prev, preferred_instruments: [...current, instrument] };
      }
    });
  };

  const calculateAge = (dobString: string) => {
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.full_name.trim()) errors.full_name = 'Full name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    if (!formData.dob) {
      errors.dob = 'Date of Birth is required';
    } else if (calculateAge(formData.dob) < 12) {
      errors.dob = 'You must be at least 12 years old';
    }
    if (!formData.phone_number.trim()) {
      errors.phone_number = 'Phone number is required';
    } else if (!/^[1-9]\d{9}$/.test(formData.phone_number.replace(/[- ]/g, ''))) {
      errors.phone_number = 'Please enter a valid 10-digit phone number';
    }
    if (!formData.city.trim()) errors.city = 'City is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegisterRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateStep1()) return;

    setLoading(true);
    try {
      const submissionData = {
        ...formData,
        phone_number: `+91${formData.phone_number.replace(/[- ]/g, '')}`,
        preferred_instruments: formData.preferred_instruments.join(', ')
      };
      await register(submissionData);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to initiate signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent, overrideOtp?: string) => {
    e.preventDefault();
    const finalOtp = overrideOtp || otp;
    if (finalOtp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await verifySignupOtp(formData.email, finalOtp);
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired code.');
      otpRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizePin = async (e: React.FormEvent, overridePin?: string) => {
    e.preventDefault();
    const finalPin = overridePin || formData.security_pin;
    if (finalPin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await finalizeSignupPin(formData.email, finalPin);
      let from = location.state?.from || '/trade';
      // If we came from home or landing, stay there
      if (from === '/' || from === '/landing') {
        from = from;
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to setup PIN.');
      pinRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  const instruments = ['Equity', 'Future', 'Options', 'Mutual funds'];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0E11] p-4 py-12 relative overflow-hidden font-inter">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tv-primary rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-3xl relative z-10">
        <div className="bg-white/80 dark:bg-[#1E222D]/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-8 md:p-10 transition-all duration-300">

          {/* Progress Header */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex flex-col items-center flex-1 relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all z-10 ${step === s ? 'bg-tv-primary text-white scale-110 shadow-lg shadow-tv-primary/30' :
                      step > s ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                    }`}>
                    {step > s ? '✓' : s}
                  </div>
                  <span className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${step >= s ? 'text-tv-primary' : 'text-slate-400'}`}>
                    {s === 1 ? 'Details' : s === 2 ? 'Verify' : 'Security'}
                  </span>
                  {s < 3 && (
                    <div className={`absolute top-5 left-1/2 w-full h-[2px] -z-0Transition-all ${step > s ? 'bg-green-500' : 'bg-slate-200 dark:bg-white/10'}`}></div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">
                {step === 1 ? 'Create Your Account' : step === 2 ? 'Verify Your Email' : 'Setup Security PIN'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-gray-400">
                {step === 1 ? 'Start your professional trading journey' :
                  step === 2 ? `We've sent a code to ${formData.email}` :
                    'Create a 4-digit PIN to protect your account'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl flex items-center gap-3 text-sm animate-shake">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleRegisterRequest} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                {/* --- Section 1: Basic Info --- */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Full Name</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                        <User size={18} />
                      </div>
                      <input
                        name="full_name"
                        type="text"
                        value={formData.full_name}
                        onChange={handleChange}
                        className={`block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border rounded-xl leading-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all sm:text-sm ${fieldErrors.full_name ? 'border-red-500' : 'border-slate-200 dark:border-white/10'
                          }`}
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                        <Mail size={18} />
                      </div>
                      <input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border rounded-xl leading-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all sm:text-sm ${fieldErrors.email ? 'border-red-500' : 'border-slate-200 dark:border-white/10'
                          }`}
                        placeholder="name@gmail.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Phone Number</label>
                    <div className="relative group flex items-center">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                        <Phone size={18} />
                        <span className="ml-2 pl-2 pr-2 border-r border-slate-200 dark:border-white/10 text-sm font-medium">+91</span>
                      </div>
                      <input
                        name="phone_number"
                        type="tel"
                        maxLength={10}
                        value={formData.phone_number}
                        onChange={handleChange}
                        className={`block w-full pl-24 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border rounded-xl leading-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all sm:text-sm ${fieldErrors.phone_number ? 'border-red-500' : 'border-slate-200 dark:border-white/10'
                          }`}
                        placeholder="9876543210"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Date of Birth</label>
                    <PremiumDatePicker
                      value={formData.dob}
                      onChange={(val) => {
                        setFormData(prev => ({ ...prev, dob: val }));
                        if (val && calculateAge(val) < 12) {
                          setFieldErrors(prev => ({ ...prev, dob: 'You must be at least 12 years old' }));
                        } else {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.dob;
                            return newErrors;
                          });
                        }
                      }}
                      placeholder="Select Date of Birth"
                      className={fieldErrors.dob ? 'border-red-500' : ''}
                    />
                    {fieldErrors.dob && (
                      <p className="text-red-500 text-xs mt-1 ml-1 animate-pulse font-medium">
                        {fieldErrors.dob}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">City</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                        <MapPin size={18} />
                      </div>
                      <input
                        name="city"
                        type="text"
                        value={formData.city}
                        onChange={handleChange}
                        className={`block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border rounded-xl leading-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all sm:text-sm ${fieldErrors.city ? 'border-red-500' : 'border-slate-200 dark:border-white/10'
                          }`}
                        placeholder="Mumbai"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1 flex items-center gap-2">
                      <Shield size={18} className="text-slate-400" />
                      Experience Level
                    </label>
                    <PremiumSelect
                      value={formData.experience_level}
                      onChange={(value) => setFormData({ ...formData, experience_level: value })}
                      options={EXPERIENCE_OPTIONS}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1 flex items-center gap-2">
                      <Target size={18} className="text-slate-400" />
                      Investment Goals
                    </label>
                    <PremiumSelect
                      value={formData.investment_goals}
                      onChange={(value) => setFormData({ ...formData, investment_goals: value })}
                      options={GOAL_OPTIONS}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Password</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                        <Lock size={18} />
                      </div>
                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={handleChange}
                        className={`block w-full pl-11 pr-11 py-2.5 bg-slate-100 dark:bg-white/5 border rounded-xl leading-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all sm:text-sm ${fieldErrors.password ? 'border-red-500' : 'border-slate-200 dark:border-white/10'
                          }`}
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1 flex items-center gap-2">
                      <Share2 size={18} className="text-slate-400" />
                      How did you hear about us?
                    </label>
                    <PremiumSelect
                      value={formData.how_heard_about}
                      onChange={(value) => setFormData({ ...formData, how_heard_about: value })}
                      options={SOURCE_OPTIONS}
                    />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-3">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1 flex items-center gap-2">
                    <Layers size={18} className="text-slate-400" />
                    Preferred Instruments
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {instruments.map(inst => (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => handleInstrumentChange(inst)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${formData.preferred_instruments.includes(inst)
                            ? 'bg-tv-primary border-tv-primary text-white'
                            : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400'
                          }`}
                      >
                        {inst}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-tv-primary hover:bg-tv-primary-hover disabled:opacity-50 transition-all active:scale-[0.98] mt-4"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
                  <>
                    <UserPlus size={20} />
                    <span>Create Account & Send OTP</span>
                  </>}
              </button>

              <div className="pt-4 border-t border-slate-200 dark:border-white/10 text-center">
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  Already verified? <Link to="/login" className="text-tv-primary font-bold">Login here</Link>
                </p>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-6 max-w-md mx-auto">
              <div className="space-y-8">
                <div className="flex justify-center">
                  <OtpInput
                    ref={otpRef}
                    length={6}
                    disabled={loading}
                    onComplete={(code) => {
                      setOtp(code);
                      const submitEvent = { preventDefault: () => { } } as React.FormEvent;
                      // small timeout for user to see the last digit
                      setTimeout(() => handleVerifyOtp(submitEvent, code), 100);
                    }}
                  />
                </div>
                <p className="text-center text-xs text-slate-500 dark:text-gray-400">
                  Enter the 6-digit code we sent to your inbox. It might take a minute to arrive.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-tv-primary hover:bg-tv-primary-hover text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Verify Email'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full py-3 text-slate-500 dark:text-gray-400 font-medium hover:text-slate-700 dark:hover:text-white transition-colors"
                >
                  Back to Edit Details
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleFinalizePin} className="space-y-6 max-w-md mx-auto">
              <div className="space-y-8">
                <div className="flex justify-center">
                  <OtpInput
                    ref={pinRef}
                    length={4}
                    type="password"
                    disabled={loading}
                    onComplete={(code) => {
                      setFormData(prev => ({ ...prev, security_pin: code }));
                      const submitEvent = { preventDefault: () => { } } as React.FormEvent;
                      setTimeout(() => handleFinalizePin(submitEvent, code), 100);
                    }}
                  />
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20">
                  <div className="flex gap-3">
                    <Shield className="text-blue-500 shrink-0" size={18} />
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                      Your Security PIN is required for every login. Choose a 4-digit combination that only you know. Avoid simple patterns like 1234 or 0000.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-tv-primary hover:bg-tv-primary-hover text-white rounded-xl font-bold shadow-lg shadow-tv-primary/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
                  <>
                    <Shield size={20} />
                    <span>Setup PIN & Complete Signup</span>
                  </>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Signup;
