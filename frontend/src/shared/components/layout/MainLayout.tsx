import React, { useState } from 'react';
import { TopNavbar } from './TopNavbar';
import { RoleSidebar } from './RoleSidebar';
import { RightSidebar } from './RightSidebar';
import { MobileBottomNav } from './MobileBottomNav';

interface MainLayoutProps {
  children: React.ReactNode;
  showRightSidebar?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, showRightSidebar = true }) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* 1. Fixed Top Navbar */}
      <TopNavbar
        onToggleMobileSidebar={() => setMobileDrawerOpen(!mobileDrawerOpen)}
        isMobileSidebarOpen={mobileDrawerOpen}
      />

      {/* 2. Responsive App Shell Container (Fixed Viewport, Independent Column Scrolling) */}
      <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-3 sm:px-5 lg:px-6 flex gap-4 lg:gap-6 overflow-hidden">
        {/* Left Column: Fixed Desktop Sidebar */}
        <div className="hidden md:block w-56 lg:w-60 flex-shrink-0 h-full overflow-y-auto no-scrollbar py-4">
          <RoleSidebar />
        </div>

        {/* Center Column: Independent Scrollable Feed Area */}
        <main className={`flex-1 h-full overflow-y-auto no-scrollbar py-4 pb-24 md:pb-8 min-w-0 ${showRightSidebar ? 'max-w-3xl' : 'max-w-7xl'} mx-auto w-full`}>
          {children}
        </main>

        {/* Right Column: Fixed Social Widget Sidebar - Hidden on Tablet */}
        {showRightSidebar && (
          <div className="hidden xl:block w-68 lg:w-72 flex-shrink-0 h-full overflow-y-auto no-scrollbar py-4">
            <RightSidebar />
          </div>
        )}
      </div>

      {/* Mobile Drawer (Slide-Over) */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex animate-fade-in">
          <div className="w-72 bg-card h-full shadow-2xl p-4 flex flex-col border-r border-border">
            <RoleSidebar onItemClick={() => setMobileDrawerOpen(false)} />
          </div>
          <div className="flex-1" onClick={() => setMobileDrawerOpen(false)} />
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
};
