import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Mail, Lock, User, Target, Shield, Briefcase, 
  UserPlus, AlertCircle, ArrowLeft, Calendar, 
  BarChart3, Layers, MapPin, KeyRound
} from 'lucide-react';

const Signup: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    dob: '',
    experience_level: 'Beginner',
    investment_goals: 'Learn',
    preferred_instruments: [] as string[],
    risk_tolerance: 'Moderate',
    occupation: 'Student',
    city: '',
    security_pin: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.security_pin.length !== 4 || !/^\d+$/.test(formData.security_pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    setLoading(true);

    try {
      // Convert array to comma-separated string for backend
      const submissionData = {
        ...formData,
        preferred_instruments: formData.preferred_instruments.join(', ')
      };
      await register(submissionData);
      const from = location.state?.from || '/trade';
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create account. Please try again.');
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
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
              Join <span className="text-tv-primary">TradeShift</span>
            </h1>
            <p className="text-slate-500 dark:text-gray-400">
              Start your professional trading journey with AI-powered insights
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl flex items-center gap-3 text-sm animate-shake">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

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
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl leading-5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm"
                      placeholder="John Doe"
                      required
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
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl leading-5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm"
                      placeholder="name@gmail.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Date of Birth</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                      <Calendar size={18} />
                    </div>
                    <input
                      name="dob"
                      type="date"
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl leading-5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">City</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                      <MapPin size={18} />
                    </div>
                    <input
                      name="city"
                      type="text"
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl leading-5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm"
                      placeholder="Mumbai"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* --- Section 2: Experience & Preferences --- */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Experience Level</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <BarChart3 size={18} />
                    </div>
                    <select
                      name="experience_level"
                      value={formData.experience_level}
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm appearance-none"
                    >
                      <option className="bg-white dark:bg-[#1E222D]" value="Beginner">Beginner</option>
                      <option className="bg-white dark:bg-[#1E222D]" value="Intermediate">Intermediate</option>
                      <option className="bg-white dark:bg-[#1E222D]" value="Advance">Advance</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Investment Goals</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Target size={18} />
                    </div>
                    <select
                      name="investment_goals"
                      value={formData.investment_goals}
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm appearance-none"
                    >
                      <option className="bg-white dark:bg-[#1E222D]" value="Learn">Learn</option>
                      <option className="bg-white dark:bg-[#1E222D]" value="Growth">Growth</option>
                      <option className="bg-white dark:bg-[#1E222D]" value="Income">Income</option>
                      <option className="bg-white dark:bg-[#1E222D]" value="Speculation">Speculation</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Risk Profile</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Shield size={18} />
                    </div>
                    <select
                      name="risk_tolerance"
                      value={formData.risk_tolerance}
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm appearance-none"
                    >
                      <option className="bg-white dark:bg-[#1E222D]" value="Low">Low</option>
                      <option className="bg-white dark:bg-[#1E222D]" value="Moderate">Moderate</option>
                      <option className="bg-white dark:bg-[#1E222D]" value="High">High</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Occupation</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Briefcase size={18} />
                    </div>
                    <select
                      name="occupation"
                      value={formData.occupation}
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm appearance-none"
                    >
                      <option className="bg-white dark:bg-[#1E222D]" value="Student">Student</option>
                      <option className="bg-white dark:bg-[#1E222D]" value="Job">Job</option>
                      <option className="bg-white dark:bg-[#1E222D]" value="Retired">Retired</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* --- Full Width Field: Preferred Instruments --- */}
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
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                        formData.preferred_instruments.includes(inst)
                          ? 'bg-tv-primary border-tv-primary text-white shadow-lg shadow-tv-primary/20'
                          : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:border-tv-primary/50'
                      }`}
                    >
                      {inst}
                    </button>
                  ))}
                </div>
              </div>

              {/* --- Section 3: Security --- */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      name="password"
                      type="password"
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl leading-5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 ml-1">Security PIN (4-Digits)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-tv-primary transition-colors">
                      <KeyRound size={18} />
                    </div>
                    <input
                      name="security_pin"
                      type="text"
                      maxLength={4}
                      onChange={handleChange}
                      className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl leading-5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tv-primary/50 focus:border-tv-primary transition-all sm:text-sm text-center tracking-widest font-mono"
                      placeholder="1234"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-tv-primary hover:bg-tv-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tv-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <UserPlus size={20} />
                  <span>Create Professional Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10 text-center">
            <p className="text-sm text-slate-500 dark:text-gray-400 flex items-center justify-center gap-2">
              Already have an account?{' '}
              <Link to="/login" state={{ from: location.state?.from }} className="text-tv-primary font-bold hover:text-tv-primary-hover transition-colors inline-flex items-center gap-1 group">
                Login here
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform rotate-180" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
