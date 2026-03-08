import { Outlet } from 'react-router-dom';
const AuthLayout = () => {
    return (
        <div className="flex flex-row min-h-screen w-full bg-[#050505] font-geist selection:bg-blue-500/30">
            {/* Left Side - Form */}
            <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:w-1/2 xl:px-24 relative overflow-hidden">
                <div className="mx-auto w-full max-w-sm lg:w-96 relative z-10">
                    <Outlet />
                </div>
            </div>

            {/* Right Side - Visual */}
            <div className="relative hidden w-0 flex-1 lg:flex bg-[#0A101D] border-l border-white/10 items-center justify-center overflow-hidden">

                {/* Abstract subtle glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#111C3A] rounded-full blur-[120px] pointer-events-none" />

                <div className="relative z-10">
                    <div className="w-[420px] text-center bg-[#0C1424] p-10 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">

                        <div className="mb-6 flex justify-center">
                            <div className="h-[72px] w-[72px] rounded-2xl bg-[#4A72FF] flex items-center justify-center shadow-[0_0_40px_rgba(74,114,255,0.4)]">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-white">
                                    <path d="M3 3v18h18" />
                                    <path d="m19 9-5 5-4-4-3 3" />
                                </svg>
                            </div>
                        </div>

                        <h2 className="text-3xl font-extrabold tracking-tight text-white mb-4">
                            Master the Markets
                        </h2>

                        <p className="text-[15px] text-slate-400 leading-relaxed px-2">
                            "TradeSim gives you the professional edge.<br />Real-time simulation, advanced analytics, and<br />a risk-free environment to perfect your<br />strategy."
                        </p>

                        <div className="mt-10 flex items-center justify-center gap-3 text-[13px] font-medium text-slate-500">
                            <div className="flex -space-x-2">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-7 w-7 rounded-full border-2 border-[#0C1424] bg-slate-700/80" />
                                ))}
                            </div>
                            <span>Joined by 10,000+ Traders</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
