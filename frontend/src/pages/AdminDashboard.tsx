import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, Activity, LayoutDashboard, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Basic admin check - assuming admin@gmail.com is the admin for now
    if (!user || user.email !== 'admin@gmail.com') {
      navigate('/');
      return;
    }

    const fetchActiveUsers = async () => {
      try {
        const res = await axios.get('/api/admin/active-learn-users');
        setActiveUsers(res.data.active_users);
      } catch (error) {
        console.error("Failed to fetch active users", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveUsers();
    // Refresh every 10 seconds
    const interval = setInterval(fetchActiveUsers, 10000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  if (!user || user.email !== 'admin@gmail.com') {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#111] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="text-indigo-500" />
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Active Users Card */}
          <div className="bg-white dark:bg-[#151515] rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Users size={20} />
              </div>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Active Learn Users</h2>
            </div>
            
            <div className="flex items-end gap-3">
              {loading ? (
                <div className="h-12 w-16 bg-slate-200 dark:bg-white/10 animate-pulse rounded-lg" />
              ) : (
                <span className="text-5xl font-black text-slate-900 dark:text-white">{activeUsers}</span>
              )}
              <div className="flex items-center gap-1 text-emerald-500 text-sm font-bold mb-1 bg-emerald-500/10 px-2 py-1 rounded-full">
                <Activity size={14} className="animate-pulse" /> Live
              </div>
            </div>
            
            <p className="text-sm text-slate-400 mt-4">
              Users currently active on the learning platform within the last 2 minutes. Includes both registered and guest users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
