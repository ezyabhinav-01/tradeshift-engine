import { useState, useEffect } from 'react';
import {
  Sun, Moon, Monitor,
  User, Shield, Lock, Key,
  ChevronRight, Loader2,
  Mail, Phone, Calendar, MapPin, Briefcase, GraduationCap
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

type TabType = 'basic' | 'security' | 'appearance';

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [isSaving, setIsSaving] = useState(false);

  // Profile Data
  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    phone_number: user?.phone_number || '',
    dob: user?.dob || '',
    city: user?.city || '',
    experience_level: user?.experience_level || 'Beginner',
    occupation: user?.occupation || ''
  });

  // PIN Reset State
  const [pinStep, setPinStep] = useState<'request' | 'verify' | 'confirm'>('request');
  const [otpCode, setOtpCode] = useState('');
  const [pinData, setPinData] = useState({
    new_pin: '',
    confirm_pin: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
        dob: user.dob || '',
        city: user.city || '',
        experience_level: user.experience_level || 'Beginner',
        occupation: user.occupation || ''
      });
    }
  }, [user]);

  // Masking helpers
  const maskEmail = (email: string) => {
    if (!email) return '';
    const [name, domain] = email.split('@');
    if (name.length <= 3) return email;
    return `${name.substring(0, 3)}${'*'.repeat(name.length - 4)}${name.slice(-1)}@${domain}`;
  };

  const maskPhone = (phone: string) => {
    if (!phone) return '';
    return '*'.repeat(phone.length - 5) + phone.slice(-5);
  };

  const maskDOB = (dob: string) => {
    if (!dob) return '';
    const parts = dob.split('-');
    if (parts.length !== 3) return dob;
    return `**/**/${parts[0]}`;
  };


  // PIN Reset Handlers
  const handleRequestOtp = async () => {
    try {
      setIsSaving(true);
      await axios.post('/auth/pin-reset/request', { email: user?.email });
      setPinStep('verify');
      toast.success("Verification code sent to your email");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to send OTP");
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setIsSaving(true);
      await axios.post('/auth/pin-reset/verify', { email: user?.email, otp_code: otpCode });
      setPinStep('confirm');
      toast.success("Code verified");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Invalid code");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmPin = async () => {
    if (pinData.new_pin !== pinData.confirm_pin) {
      toast.error("PINs do not match");
      return;
    }
    try {
      setIsSaving(true);
      await axios.post('/auth/pin-reset/confirm', {
        email: user?.email,
        otp_code: otpCode,
        new_pin: pinData.new_pin
      });
      toast.success("Security PIN updated successfully");
      setPinStep('request');
      setOtpCode('');
      setPinData({ new_pin: '', confirm_pin: '' });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to update PIN");
    } finally {
      setIsSaving(false);
    }
  };

  const SidebarItem = ({ id, label, icon: Icon }: { id: TabType, label: string, icon: any; }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center justify-between px-6 py-4 transition-all ${activeTab === id
        ? 'bg-[#00d09c]/10 text-[#00d09c] border-r-4 border-[#00d09c] font-bold'
        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
        }`}
    >
      <span className="flex items-center gap-4 text-sm tracking-wide">
        <Icon size={18} /> {label}
      </span>
      <ChevronRight size={16} className={activeTab === id ? 'opacity-100' : 'opacity-0'} />
    </button>
  );

  const DetailRow = ({ label, value, icon: Icon, required = false }: { label: string, value: string, icon?: any, required?: boolean; }) => (
    <div className="group border-b border-slate-100 dark:border-white/5 py-6 last:border-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
            {label} {required && <span className="text-[#f23645] ml-0.5">*</span>}
          </p>
          <div className="flex items-center gap-3">
            {Icon && <Icon size={16} className="text-slate-400" />}
            <span className="text-sm font-bold text-slate-800 dark:text-white">{value || 'Not provided'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent dark:bg-[#0b0e11] font-sans pb-20">
      <div className="max-w-6xl mx-auto px-4 pt-8 md:pt-12">

        <div className="mb-10 text-center md:text-left">
          <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">Settings</h2>
          <p className="text-slate-500 dark:text-gray-400 mt-1">Manage your account preferences and security.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-start">

          {/* GROWW STYLE SIDEBAR */}
          <div className="w-full md:w-72 bg-white dark:bg-[#1e222d] rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-white/5 sticky top-8">
            <div className="p-8 text-center border-b border-slate-100 dark:border-white/5">
              <div className="w-24 h-24 rounded-full bg-linear-to-br from-[#00d09c] to-[#00a37b] mx-auto mb-4 flex items-center justify-center text-3xl font-black text-white shadow-lg ring-4 ring-[#00d09c]/20">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">{user?.full_name}</h3>
              <p className="text-xs text-[#00d09c] font-black mt-1 tracking-widest uppercase">Verified Account</p>
            </div>
            <nav className="py-2">
              <SidebarItem id="basic" label="Basic Details" icon={User} />
              <SidebarItem id="security" label="Change Security PIN" icon={Shield} />
              <SidebarItem id="appearance" label="Appearance" icon={Sun} />
            </nav>
          </div>

          {/* CONTENT AREA */}
          <div className="flex-1 w-full bg-white dark:bg-[#1e222d] rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 p-8 md:p-10 min-h-[600px]">

            {activeTab === 'basic' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">Personal Details</h3>
                  <p className="text-sm text-slate-400">Review your identity and contact information.</p>
                </div>

                <div className="space-y-1">
                  <DetailRow label="Full Name" value={profileData.full_name} required icon={User} />

                  <DetailRow label="Date of Birth" value={maskDOB(profileData.dob)} required icon={Calendar} />

                  <DetailRow label="Mobile Number" value={maskPhone(profileData.phone_number)} required icon={Phone} />

                  <DetailRow label="Email Address" value={maskEmail(user?.email || '')} required icon={Mail} />

                  <DetailRow label="City" value={profileData.city} icon={MapPin} />

                  <DetailRow label="Occupation" value={profileData.occupation} icon={Briefcase} />

                  <DetailRow label="Experience" value={profileData.experience_level} icon={GraduationCap} />
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">Security & PIN</h3>
                  <p className="text-sm text-slate-400">Update your 4-digit security PIN for sensitive actions.</p>
                </div>

                <div className="max-w-md mx-auto mt-12 bg-slate-50 dark:bg-white/2 p-8 rounded-3xl border border-slate-100 dark:border-white/5">
                  <div className="text-center mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-[#f23645]/10 text-[#f23645] flex items-center justify-center mx-auto mb-4">
                      <Lock size={32} />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white">Reset 4-Digit PIN</h4>
                    <p className="text-xs text-slate-500 mt-1">Verification required via registered email</p>
                  </div>

                  {pinStep === 'request' && (
                    <Button
                      onClick={handleRequestOtp}
                      disabled={isSaving}
                      className="w-full h-14 rounded-2xl bg-[#00d09c] hover:bg-[#00b386] text-white font-black tracking-wide gap-2 shadow-lg shadow-[#00d09c]/20"
                    >
                      {isSaving ? <Loader2 className="animate-spin" /> : <Key size={18} />}
                      SEND VERIFICATION CODE
                    </Button>
                  )}

                  {pinStep === 'verify' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest text-center block">Enter 6-Digit Code</label>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="000000"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          className="w-full h-16 bg-white dark:bg-white/5 border-2 border-slate-200 dark:border-white/10 rounded-2xl text-center text-3xl font-black tracking-[0.5em] focus:border-[#00d09c] outline-none transition-all dark:text-white"
                        />
                      </div>
                      <Button
                        onClick={handleVerifyOtp}
                        disabled={isSaving || otpCode.length !== 6}
                        className="w-full h-14 rounded-2xl bg-[#00d09c] hover:bg-[#00b386] text-white font-black"
                      >
                        {isSaving ? <Loader2 className="animate-spin" /> : "VERIFY CODE"}
                      </Button>
                      <button onClick={() => setPinStep('request')} className="w-full text-xs text-slate-400 font-bold hover:text-[#00d09c]">Didn't receive code? Resend</button>
                    </div>
                  )}

                  {pinStep === 'confirm' && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase text-center block">New PIN</label>
                          <input
                            type="password"
                            maxLength={4}
                            placeholder="••••"
                            value={pinData.new_pin}
                            onChange={(e) => setPinData({ ...pinData, new_pin: e.target.value })}
                            className="w-full h-14 bg-white dark:bg-white/5 border-2 border-slate-200 dark:border-white/10 rounded-2xl text-center text-2xl font-black tracking-widest focus:border-[#00d09c] outline-none dark:text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase text-center block">Confirm</label>
                          <input
                            type="password"
                            maxLength={4}
                            placeholder="••••"
                            value={pinData.confirm_pin}
                            onChange={(e) => setPinData({ ...pinData, confirm_pin: e.target.value })}
                            className="w-full h-14 bg-white dark:bg-white/5 border-2 border-slate-200 dark:border-white/10 rounded-2xl text-center text-2xl font-black tracking-widest focus:border-[#00d09c] outline-none dark:text-white"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleConfirmPin}
                        disabled={isSaving || pinData.new_pin.length !== 4}
                        className="w-full h-14 rounded-2xl bg-[#00d09c] hover:bg-[#00b386] text-white font-black"
                      >
                        {isSaving ? <Loader2 className="animate-spin" /> : "UPDATE PIN"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">Appearance</h3>
                  <p className="text-sm text-slate-400">Customize how TradeShift looks in your browser.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    onClick={() => setTheme('light')}
                    className={`h-32 rounded-3xl flex-col gap-4 border-2 transition-all ${theme === 'light' ? 'bg-[#00d09c] border-[#00d09c] hover:bg-[#00b386]' : 'border-slate-100'}`}
                  >
                    <div className={`p-4 rounded-2xl ${theme === 'light' ? 'bg-white/20' : 'bg-slate-100'}`}>
                      <Sun size={24} />
                    </div>
                    <span className="font-black text-xs uppercase tracking-widest">Light Mode</span>
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    onClick={() => setTheme('dark')}
                    className={`h-32 rounded-3xl flex-col gap-4 border-2 transition-all ${theme === 'dark' ? 'bg-[#1e222d] border-[#00d09c] text-white' : 'border-slate-100'}`}
                  >
                    <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'}`}>
                      <Moon size={24} />
                    </div>
                    <span className="font-black text-xs uppercase tracking-widest">Dark Mode</span>
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    onClick={() => setTheme('system')}
                    className={`h-32 rounded-3xl flex-col gap-4 border-2 transition-all ${theme === 'system' ? 'bg-[#00d09c] border-[#00d09c] text-white' : 'border-slate-100'}`}
                  >
                    <div className={`p-4 rounded-2xl ${theme === 'system' ? 'bg-white/20' : 'bg-slate-100'}`}>
                      <Monitor size={24} />
                    </div>
                    <span className="font-black text-xs uppercase tracking-widest">System</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;