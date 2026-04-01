import { useState, useEffect } from 'react';
import { 
  Activity, Sun, Moon, Monitor, 
  User, Shield,  
  ChevronRight, Lock, Save, Loader2, Check
} from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const SettingsPage = () => {
  const { speed, setSpeed, resetSimulation, userSettings, updateUserSettings } = useGame();
  const { theme, setTheme } = useTheme();
  const { user, checkAuth } = useAuth();
  
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    phone_number: user?.phone_number || '',
    dob: user?.dob || '',
    city: user?.city || '',
    experience_level: user?.experience_level || 'Beginner',
    investment_goals: user?.investment_goals || '',
    occupation: user?.occupation || ''
  });

  const [pinData, setPinData] = useState({
    dob: user?.dob || '',
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
        investment_goals: user.investment_goals || '',
        occupation: user.occupation || ''
      });
      setPinData(prev => ({ ...prev, dob: user.dob || '' }));
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await axios.patch('/auth/update-profile', profileData);
      await checkAuth();
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinData.new_pin !== pinData.confirm_pin) {
      toast.error("PINs do not match");
      return;
    }
    try {
      setIsSaving(true);
      await axios.post('/auth/reset-pin', {
        email: user?.email,
        dob: pinData.dob,
        new_pin: pinData.new_pin
      });
      toast.success("Security PIN reset successfully");
      setPinData(prev => ({ ...prev, new_pin: '', confirm_pin: '' }));
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to reset PIN. Check your DOB.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto font-sans pb-20">
      <div className="mb-10">
        <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Settings</h2>
        <p className="text-slate-500 dark:text-gray-400 mt-1">Manage your profile, security, and trading preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Navigation Sidebar */}
        <div className="space-y-1">
          <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-tv-primary/10 text-tv-primary font-bold text-sm text-left">
            <span className="flex items-center gap-3">
              <User size={18} /> Profile & Identity
            </span>
            <ChevronRight size={16} />
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-gray-400 font-medium text-sm text-left transition-colors">
            <span className="flex items-center gap-3">
              <Shield size={18} /> Security & PIN
            </span>
            <ChevronRight size={16} />
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-gray-400 font-medium text-sm text-left transition-colors">
            <span className="flex items-center gap-3">
              <Sun size={18} /> Appearance
            </span>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Content Area */}
        <div className="md:col-span-2 space-y-10">
          
          {/* 1. Profile Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-white/10">
              <User className="text-tv-primary" size={20} />
              <h3 className="font-bold text-slate-800 dark:text-white">Profile Details</h3>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest px-1">Full Name</label>
                  <input 
                    type="text" 
                    value={profileData.full_name}
                    onChange={(e) => setProfileData({...profileData, full_name: e.target.value})}
                    className="w-full h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-semibold dark:text-white outline-none focus:border-tv-primary/50 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest px-1">Phone Number</label>
                  <input 
                    type="text" 
                    value={profileData.phone_number}
                    onChange={(e) => setProfileData({...profileData, phone_number: e.target.value})}
                    className="w-full h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-semibold dark:text-white outline-none focus:border-tv-primary/50 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest px-1">Date of Birth</label>
                  <input 
                    type="date" 
                    value={profileData.dob}
                    onChange={(e) => setProfileData({...profileData, dob: e.target.value})}
                    className="w-full h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-semibold dark:text-white outline-none focus:border-tv-primary/50 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest px-1">City</label>
                  <input 
                    type="text" 
                    value={profileData.city}
                    onChange={(e) => setProfileData({...profileData, city: e.target.value})}
                    className="w-full h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-semibold dark:text-white outline-none focus:border-tv-primary/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest px-1">Experience Level</label>
                <select 
                  value={profileData.experience_level}
                  onChange={(e) => setProfileData({...profileData, experience_level: e.target.value})}
                  className="w-full h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-semibold dark:text-white outline-none focus:border-tv-primary/50 transition-colors"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Pro">Pro / Institutional</option>
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  type="submit" 
                  disabled={isSaving}
                  className="rounded-xl h-12 px-8 font-bold gap-2 active:scale-95 transition-transform"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Profile
                </Button>
              </div>
            </form>
          </section>

          {/* 2. Security (PIN Reset) Section */}
          <section className="space-y-6 pt-6">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-white/10">
              <Shield className="text-[#f23645]" size={20} />
              <h3 className="font-bold text-slate-800 dark:text-white">Security / Reset PIN</h3>
            </div>
            
            <form onSubmit={handleResetPin} className="space-y-4 p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2.5 rounded-lg bg-[#f23645]/10 text-[#f23645]">
                  <Lock size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold dark:text-white">4-Digit Security PIN</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Used for trade confirmations and high-value actions.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest px-1">Verify Date of Birth</label>
                  <input 
                    type="date" 
                    value={pinData.dob}
                    onChange={(e) => setPinData({...pinData, dob: e.target.value})}
                    className="w-full h-11 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-semibold dark:text-white outline-none focus:border-tv-primary/50 transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest px-1">New PIN</label>
                    <input 
                      type="password" 
                      maxLength={4}
                      placeholder="••••"
                      value={pinData.new_pin}
                      onChange={(e) => setPinData({...pinData, new_pin: e.target.value})}
                      className="w-full h-11 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-center tracking-widest font-mono font-bold text-lg dark:text-white outline-none focus:border-tv-primary/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest px-1">Confirm PIN</label>
                    <input 
                      type="password" 
                      maxLength={4}
                      placeholder="••••"
                      value={pinData.confirm_pin}
                      onChange={(e) => setPinData({...pinData, confirm_pin: e.target.value})}
                      className="w-full h-11 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-center tracking-widest font-mono font-bold text-lg dark:text-white outline-none focus:border-tv-primary/50 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  type="submit" 
                  variant="outline"
                  disabled={isSaving || !pinData.new_pin || pinData.new_pin.length !== 4}
                  className="rounded-xl h-11 px-8 font-bold transition-all border-slate-200 dark:border-white/10 hover:border-[#f23645] hover:text-[#f23645]"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  Reset PIN
                </Button>
              </div>
            </form>
          </section>

          {/* 3. Appearance Section */}
          <section className="space-y-6 pt-6">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-white/10">
              <Sun className="text-tv-primary" size={20} />
              <h3 className="font-bold text-slate-800 dark:text-white">Appearance</h3>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                onClick={() => setTheme('light')}
                className="flex-1 gap-2 rounded-xl h-12 font-bold"
              >
                <Sun size={18} /> Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                onClick={() => setTheme('dark')}
                className="flex-1 gap-2 rounded-xl h-12 font-bold"
              >
                <Moon size={18} /> Dark
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                onClick={() => setTheme('system')}
                className="flex-1 gap-2 rounded-xl h-12 font-bold"
              >
                <Monitor size={18} /> System
              </Button>
            </div>
          </section>

          {/* 4. Simulation & Risk Section */}
          <section className="space-y-6 pt-6">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-white/10">
              <Activity className="text-tv-primary" size={20} />
              <h3 className="font-bold text-slate-800 dark:text-white">Simulation & Risk</h3>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-3">
                  <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">Max Order Quantity (Lots)</label>
                  <input 
                    type="number" 
                    value={userSettings?.max_order_quantity}
                    onChange={(e) => updateUserSettings({ max_order_quantity: parseInt(e.target.value) })}
                    className="w-full h-11 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-bold dark:text-white outline-none focus:border-tv-primary/50 transition-colors"
                  />
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-3">
                  <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">Replay Speed</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min={1} max={20}
                      value={speed}
                      onChange={(e) => setSpeed(parseInt(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-tv-primary"
                    />
                    <span className="text-sm font-mono font-bold dark:text-white">{speed}x</span>
                  </div>
                </div>
              </div>

               <div className="p-6 rounded-2xl bg-[#f23645]/5 border border-[#f23645]/10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-[#f23645]">Danger Zone</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Clear all local trade logs and reset balance.</p>
                </div>
                <Button 
                  variant="outline"
                  onClick={resetSimulation}
                  className="rounded-xl border-[#f23645]/20 text-[#f23645] hover:bg-[#f23645] hover:text-white font-bold"
                >
                  Reset All Data
                </Button>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default SettingsPage;