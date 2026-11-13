import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);

  return (
    <div className="flex h-dvh bg-slate-200/50 dark:bg-[#070b14] overflow-hidden text-slate-800 dark:text-slate-100 transition-colors">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex flex-col flex-1 overflow-hidden p-0 sm:p-3 md:p-5 bg-slate-200/50 dark:bg-[#070b14] transition-colors">
        <div className="bg-white/80 dark:bg-[#0e1726]/90 backdrop-blur-md border-0 sm:border border-white dark:border-slate-800/80 rounded-none sm:rounded-3xl md:rounded-[32px] shadow-sm flex-1 flex flex-col overflow-hidden transition-colors">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="flex-1 overflow-y-auto p-3 sm:p-5 pb-20 md:pb-6 scrollbar-hide flex flex-col min-h-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
