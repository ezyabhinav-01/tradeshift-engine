import { LayoutDashboard, History, Settings, TrendingUp, Activity, Briefcase } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/' || path === '/terminal') return 'terminal';
    if (path.startsWith('/markets')) return 'markets';
    if (path.startsWith('/screener')) return 'screener';
    if (path.startsWith('/history')) return 'history';
    if (path.startsWith('/portfolio')) return 'portfolio';
    if (path.startsWith('/settings')) return 'settings';
    return 'terminal';
  };

  const activeTab = getActiveTab();

  const NavItem = ({ p, icon: Icon, label, path }: { p: string, icon: any, label: string; path: string; }) => (
    <button
      onClick={() => navigate(path)}
      className={`w-full p-4 flex flex-col items-center gap-2 transition-all duration-300 group relative
        ${activeTab === p
          ? 'text-sidebar-primary'
          : 'text-sidebar-foreground/60 hover:text-sidebar-primary'
        }
      `}
    >
      {/* Active Indicator Line (Animated) */}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-sidebar-primary transition-all duration-300 
        ${activeTab === p ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}
      `} />

      {/* Icon with Hover Animation */}
      <div className={`transition-transform duration-300 group-hover:scale-110 group-active:scale-95`}>
        <Icon size={24} />
      </div>

      {/* Label */}
      <span className="text-[10px] font-bold tracking-wide opacity-80">{label}</span>
    </button>
  );

  return (
    <div className="w-20 border-r border-sidebar-border bg-sidebar flex flex-col h-full z-20 transition-colors duration-300">

      {/* Logo Area */}
      <div className="h-16 flex items-center justify-center border-b border-sidebar-border mb-4">
        <Link to="/landing" className="bg-sidebar-primary/10 p-2 rounded-xl transition-transform hover:rotate-12 border border-sidebar-primary/20">
          <TrendingUp className="text-sidebar-primary" size={24} />
        </Link>
      </div>

      <NavItem p="terminal" icon={LayoutDashboard} label="Trade" path="/" />
      <NavItem p="markets" icon={Activity} label="Markets" path="/markets" />
      <NavItem p="portfolio" icon={Briefcase} label="Portfolio" path="/portfolio" />
      <NavItem p="screener" icon={TrendingUp} label="Screener" path="/screener" />
      <NavItem p="history" icon={History} label="History" path="/history" />
      <NavItem p="settings" icon={Settings} label="Config" path="/settings" />
    </div>
  );
};

export default Sidebar;