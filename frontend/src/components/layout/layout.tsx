import { Outlet } from 'react-router-dom';
import Topbar from './Header';
import Sidebar from './Sidebar';

const Layout = () => {
    return (
        <main className="h-screen w-screen flex flex-col overflow-hidden bg-tv-bg-base text-tv-text-primary">
            <Topbar />
            <div className="flex-1 flex overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
                    <Outlet />
                </div>
            </div>
        </main>
    );
};
export default Layout;
