import { Outlet, useLocation } from 'react-router-dom';
import Topbar from './Header';
import { GlobalTicker } from '../market/GlobalTicker';

const Layout = () => {
    const location = useLocation();
    const isChartRoute = location.pathname === '/' || location.pathname === '/terminal';

    return (
        /* 1. Main Container */
        <main className={`relative h-screen w-screen flex flex-col overflow-hidden text-tv-text-primary bg-background transition-colors duration-300`}>
            
            {/* Conditional Fancy Background layers — dark mode only */}
            {!isChartRoute && (
                <>
                    {/* 2. Blue Glow (dark mode only) */}
                    <div className="absolute -top-[10%] -left-[10%] h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none hidden dark:block"></div>
                    
                    {/* 3. Dark gradient overlay (dark mode only) */}
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/50 pointer-events-none hidden dark:block"></div>

                    {/* 4. Dot Grid (dark mode only) */}
                    <div className="absolute inset-0 h-full w-full bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none hidden dark:block"></div>
                </>
            )}

            {/* 5. Actual Content (z-index ensures it stays above the background) */}
            <div className="relative z-10 flex flex-col h-full w-full">
                <Topbar />
                <div className="w-full bg-transparent border-none">
                    <GlobalTicker />
                </div>
                
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
                        <Outlet />
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Layout;