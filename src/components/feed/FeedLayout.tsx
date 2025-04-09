'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { cn } from '@/lib/utils/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatHandicapIndex } from '@/lib/utils/formatting';

interface FeedLayoutProps {
  main: React.ReactNode;
  sidebar: React.ReactNode;
}

export function FeedLayout({ main, sidebar }: FeedLayoutProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Navigation items
  const navItems = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      label: 'Feed',
      href: '/feed',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      label: 'Profile',
      href: '/profile',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      label: 'Scorecard',
      href: '/scorecard',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      label: 'Stats',
      href: '/stats',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656.126-1.283.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      label: 'Groups',
      href: '/groups',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      label: 'Marketplace',
      href: '/marketplace',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      label: 'Settings',
      href: '/settings',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Navigation Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-30">
        <Button
          variant="ghost"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          className="p-2"
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </Button>
      </div>

      {/* Mobile Navigation Drawer */}
      <div
        className={cn(
          "fixed inset-0 z-20 bg-black/50 backdrop-blur-sm transition-opacity md:hidden",
          mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileMenuOpen(false)}
      >
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-950 shadow-xl transition-transform duration-300 ease-in-out",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Menu Content */}
          <div className="flex flex-col h-full overflow-y-auto pb-20">
            {user && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center space-x-3">
                  <Avatar
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    size="md"
                  />
                  <div>
                    <div className="font-medium">{user.displayName}</div>
                    {user.handicapIndex !== undefined && user.handicapIndex !== null && (
                      <div className="text-xs text-gray-500">
                        <Badge variant="outline" className="mt-1">
                          {formatHandicapIndex(user.handicapIndex)}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="p-2 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="mr-3">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex mx-auto max-w-7xl">
        {/* Left Sidebar - Navigation (hidden on mobile) */}
        <aside className="hidden md:block w-64 flex-shrink-0 sticky top-0 h-screen overflow-y-auto py-8 px-4 border-r border-gray-200 dark:border-gray-800">
          {user && (
            <div className="flex items-center space-x-3 mb-8 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Link href={`/profile/${user.uid}`} className="flex items-center space-x-3 w-full">
                <Avatar
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  size="md"
                />
                <div>
                  <div className="font-medium truncate">{user.displayName}</div>
                  {user.handicapIndex !== undefined && user.handicapIndex !== null && (
                    <Badge variant="outline" className="mt-1">
                      {formatHandicapIndex(user.handicapIndex)}
                    </Badge>
                  )}
                </div>
              </Link>
            </div>
          )}

          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <span className="mr-3">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Footer area for the sidebar */}
          <div className="mt-auto pt-6 border-t border-gray-200 dark:border-gray-800 mt-8">
            <div className="text-xs text-center text-gray-500 dark:text-gray-400">
              &copy; {new Date().getFullYear()} Bunkr
              <div className="mt-1">The Golf Social Network</div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 py-8 px-4">
          <div className="max-w-2xl mx-auto">
            {main}
          </div>
        </main>

        {/* Right Sidebar (hidden on small screens) */}
        <aside className="hidden lg:block w-80 flex-shrink-0 sticky top-0 h-screen overflow-y-auto py-8 px-4 border-l border-gray-200 dark:border-gray-800">
          <div className="space-y-6">
            {sidebar}
          </div>
        </aside>
      </div>
    </div>
  );
}