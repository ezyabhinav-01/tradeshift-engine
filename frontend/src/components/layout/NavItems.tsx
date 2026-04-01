import { Link, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Newspaper, LineChart, History, Briefcase, LayoutDashboard, GraduationCap } from 'lucide-react';

const navItems = [
    { name: 'Trade', path: '/trade', icon: LineChart },
    { name: 'Markets', path: '/markets', icon: LayoutDashboard },
    { name: 'Portfolio', path: '/portfolio', icon: Briefcase },
    { name: 'Screener', path: '/screener', icon: History },
    { name: 'Learn', path: '/learn', icon: GraduationCap },
];

export const NavItems = ({ isMobile, onItemClick }: { isMobile?: boolean, onItemClick?: () => void }) => {
    const location = useLocation();
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsMoreOpen(false);w
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleItemClick = () => {
        if (onItemClick) {
            onItemClick();
        }
    };

    return (
        <nav className={isMobile ? "flex flex-col gap-4 w-full" : "hidden lg:flex items-center gap-6"}>
            {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        onClick={handleItemClick}
                        className={`text-sm font-semibold transition-colors duration-200 ${isActive
                                ? 'text-tv-primary'
                                : 'text-tv-text-secondary hover:text-tv-text-primary'
                            }`}
                    >
                        {item.name}
                    </Link>
                );
            })}

            {/* More Dropdown */}
            <div className={`relative ${isMobile ? 'w-full' : ''}`} ref={dropdownRef}>
                <button 
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className={`flex items-center gap-1 text-sm font-semibold text-tv-text-secondary hover:text-tv-text-primary transition-colors outline-none ${isMobile ? 'justify-between w-full' : ''}`}
                >
                    More <ChevronDown size={14} className={`transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMoreOpen && (
                    <div className={`${isMobile ? 'static flex flex-col gap-2 mt-3 pl-2 border-l-2 border-slate-200 dark:border-white/10 w-full' : 'absolute right-0 top-full mt-2 z-[100] min-w-[200px] bg-white dark:bg-[#1e222d] rounded-xl p-1.5 shadow-2xl border border-slate-200 dark:border-[#2a2e39] animate-in fade-in zoom-in-95 duration-200'}`}>
                        <Link
                            to="/news"
                            onClick={() => { setIsMoreOpen(false); handleItemClick(); }}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors outline-none cursor-pointer ${isMobile ? 'w-full' : ''}`}
                        >
                            <Newspaper size={16} className="text-tv-primary" />
                            News & AI Insights
                        </Link>

                        <Link
                            to="/community"
                            onClick={() => { setIsMoreOpen(false); handleItemClick(); }}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors outline-none cursor-pointer ${isMobile ? 'w-full' : ''}`}
                        >
                            <LayoutDashboard size={16} className="text-tv-primary" />
                            Community
                        </Link>

                        <Link
                            to="/help"
                            onClick={() => { setIsMoreOpen(false); handleItemClick(); }}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors outline-none cursor-pointer ${isMobile ? 'w-full' : ''}`}
                        >
                            <History size={16} className="text-tv-primary" />
                            Help & Support
                        </Link>
                        
                        {!isMobile && <div className="h-[1px] bg-slate-100 dark:bg-white/5 my-1" />}
                        
                        <div className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-400 dark:text-slate-500 rounded-lg cursor-not-allowed ${isMobile ? 'w-full' : ''}`}>
                            Technical Analysis (Soon)
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
};
