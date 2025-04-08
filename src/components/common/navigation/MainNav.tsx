'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTheme } from '@/lib/contexts/ThemeContext';
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
  { label: 'Stats', href: '/stats' },
  { label: 'Groups', href: '/groups' },
  { label: 'Marketplace', href: '/marketplace' },
];

export function MainNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="flex items-center mr-8">
            <span className="text-xl font-bold text-green-fairway">Bunkr</span>
          </Link>

          {/* Main navigation - desktop only */}
          <nav className="hidden md:flex items-center space-x-6">
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-green-fairway',
                  pathname === item.href || pathname?.startsWith(`${item.href}/`)
                    ? 'text-green-fairway'
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
              <DropdownItem onClick={() => window.location.href = `/profile/${user.uid}`}>
                My Profile
              </DropdownItem>
              <DropdownItem onClick={() => window.location.href = '/stats'}>
                My Stats
              </DropdownItem>
              <DropdownItem onClick={() => window.location.href = '/settings'}>
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
                className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-green-fairway"
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