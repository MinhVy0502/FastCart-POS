import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);

  return (
    <div className="flex h-screen bg-slate-200/50 dark:bg-[#070b14] overflow-hidden text-slate-800 dark:text-slate-100 transition-colors">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex flex-col flex-1 overflow-hidden p-2 sm:p-4 md:p-6 bg-slate-200/50 dark:bg-[#070b14] transition-colors">
        <div className="bg-white/70 dark:bg-[#0e1726]/90 backdrop-blur-md border border-white dark:border-slate-800/80 rounded-3xl md:rounded-[32px] shadow-sm flex-1 flex flex-col overflow-hidden transition-colors">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide flex flex-col min-h-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
