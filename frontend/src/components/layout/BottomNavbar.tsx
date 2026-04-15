import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Search, LineChart, Briefcase, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';


const navItems = [
    { name: 'Markets', path: '/markets', icon: LayoutDashboard },
    { name: 'Screener', path: '/screener', icon: Search },
    { name: 'Trade', path: '/trade', icon: LineChart },
    { name: 'Portfolio', path: '/portfolio', icon: Briefcase },
    { name: 'Learn', path: '/learn', icon: GraduationCap },
];

export const BottomNavbar = () => {
    const location = useLocation();
    const { user } = useAuth();


    // Filter items based on user/path if needed
    const visibleItems = navItems.filter(item => {
        if (item.name === 'Trade' && (!user || location.pathname === '/')) return false;
        return true;
    });

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 lg:hidden pb-safe">
            <div className="flex items-center justify-around h-16 px-2">
                {visibleItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            data-tutorial={`nav-${item.name.toLowerCase()}`}
                            className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 group"
                        >
                            <div className={`relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300 ${isActive ? 'bg-tv-primary/15' : 'group-active:scale-90'}`}>
                                <Icon
                                    size={22}
                                    className={`transition-colors duration-300 ${isActive ? 'text-tv-primary' : 'text-tv-text-secondary'}`}
                                />
                                {isActive && (
                                    <motion.div
                                        layoutId="bottom-nav-indicator"
                                        className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-tv-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                    />
                                )}
                            </div>
                            <span className={`text-[10px] font-bold tracking-tight uppercase ${isActive ? 'text-tv-primary font-black' : 'text-tv-text-secondary/60'}`}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNavbar;
