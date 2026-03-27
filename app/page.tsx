'use client';

import React, { useState, useEffect } from 'react';
// Using a standard dynamic import with a relative path to ensure resolution
import dynamic from 'next/dynamic';

// We disable SSR to prevent "window is not defined" during the Vercel build
const AppContent = dynamic(() => import('../components/App'), { 
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        <div className="animate-pulse text-xl font-medium text-indigo-400">
          Initializing Neural Link...
        </div>
      </div>
    </div>
  )
});

export default function Home() {
  const [mounted, setMounted] = useState(false);

  // This double-check ensures the component only renders on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950" />
    );
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <AppContent />
    </main>
  );
}
