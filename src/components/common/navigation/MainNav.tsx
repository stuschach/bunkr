'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useStore } from '@/store';
import { cn } from '@/lib/utils/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Toggle } from '@/components/ui/Toggle';

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

const mainNavItems: NavItem[] = [
  { label: 'Feed', href: '/feed' },
  { label: 'Scorecard', href: '/scorecard' },
  { label: 'Tee Times', href: '/tee-times' },
  { label: 'Stats', href: '/stats' },
  { label: 'Groups', href: '/groups' },
  { label: 'Marketplace', href: '/marketplace' },
];

export function MainNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const unreadMessageCount = useStore(state => state.unreadMessageCount);
  const theme = useStore(state => state.theme);
  const setTheme = useStore(state => state.setTheme);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="flex items-center mr-8">
            <span className="text-xl font-bold text-green-500">Bunkr</span>
          </Link>

          {/* Main navigation - desktop only */}
          <nav className="hidden md:flex items-center space-x-6">
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-green-500',
                  pathname === item.href || pathname?.startsWith(`${item.href}/`)
                    ? 'text-green-500'
                    : 'text-gray-700 dark:text-gray-300'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          {/* Theme toggle */}
          <div className="hidden md:flex items-center">
            <Toggle 
              pressed={theme === 'dark'} 
              onPressedChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
          </div>

          {/* Messages icon */}
          {user && (
            <Link
              href="/messages"
              className={cn(
                'relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
                pathname === '/messages' || pathname?.startsWith('/messages/')
                  ? 'text-green-500'
                  : 'text-gray-700 dark:text-gray-300'
              )}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                className="w-5 h-5"
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {/* Notification badge */}
              {unreadMessageCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-green-500 rounded-full">
                  {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                </span>
              )}
            </Link>
          )}

          {/* User menu */}
          {user ? (
            <Dropdown
              trigger={
                <button className="flex items-center space-x-2">
                  <Avatar 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    fallback={user.displayName?.charAt(0) || 'U'} 
                    size="sm"
                  />
                  <span className="hidden md:inline-block text-sm font-medium">
                    {user.displayName}
                  </span>
                </button>
              }
              align="right"
            >
              <DropdownItem onClick={() => router.push(`/profile/${user.uid}`)}>
                My Profile
              </DropdownItem>
              <DropdownItem onClick={() => router.push('/stats')}>
                My Stats
              </DropdownItem>
              <DropdownItem onClick={() => router.push('/tee-times/my')}>
                My Tee Times
              </DropdownItem>
              <DropdownItem onClick={() => router.push('/messages')}>
                Messages
                {unreadMessageCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                    {unreadMessageCount}
                  </span>
                )}
              </DropdownItem>
              <DropdownItem onClick={() => router.push('/settings')}>
                Settings
              </DropdownItem>
              <DropdownItem onClick={() => logout()}>
                Sign Out
              </DropdownItem>
            </Dropdown>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-green-500"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}