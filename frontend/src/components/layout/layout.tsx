import { Outlet, useLocation } from 'react-router-dom';
import Topbar from './Header';
import { GlobalTicker } from '../market/GlobalTicker';

const Layout = () => {
    const location = useLocation();
    const isChartRoute = location.pathname === '/' || location.pathname === '/terminal';

    return (
        /* 1. Main Container: Set the base dark color */
        <main className={`relative h-screen w-screen flex flex-col overflow-hidden text-tv-text-primary ${isChartRoute ? 'bg-[#121212]' : 'bg-[#020617]'}`}>
            
            {/* Conditional Fancy Background layers */}
            {!isChartRoute && (
                <>
                    {/* 2. The Blue Flash/Glow Effect (Top Left) */}
                    <div className="absolute -top-[10%] -left-[10%] h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none"></div>
                    
                    {/* 3. The Subtle Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/50 pointer-events-none"></div>

                    {/* 4. The Dot Grid Layer */}
                    <div className="absolute inset-0 h-full w-full bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
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