'use client';

import React from 'react';
import { MainNav } from '@/components/common/navigation/MainNav';
import { MobileNav } from '@/components/common/navigation/MobileNav';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AppLayout({ children, requireAuth = true }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // If authentication is required but user is not logged in and not loading
    if (requireAuth && !loading && !user) {
      router.push(`/login?returnUrl=${encodeURIComponent(pathname || '/')}`);
    }
  }, [user, loading, requireAuth, router, pathname]);

  // Handle authentication check
  if (requireAuth && !mounted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-green-fairway"></div>
      </div>
    );
  }

  // If auth is required and still loading or user doesn't exist, show loading
  if (requireAuth && (loading || !user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-green-fairway"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <MainNav />
      <main className="flex-grow container mx-auto px-4 py-6 pb-20 md:pb-6">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}