import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center pb-20">
      {/* 
        pt-[env(safe-area-inset-top)] handles the iOS notch/status bar area 
        when the app is running in 'black-translucent' standalone mode.
        We add extra pt-6 as base padding.
      */}
      <div className="w-full max-w-lg px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        {children}
      </div>
    </div>
  );
};