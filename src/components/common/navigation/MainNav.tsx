// src/components/common/navigation/MainNav.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { cn } from '@/lib/utils/cn';
import { FaGolfBall, FaBars, FaTimes, FaChartBar, FaEdit, FaUsers, FaShoppingCart } from 'react-icons/fa';
import { TopNav } from '@/components/common/navigation/TopNav';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const mainNavItems: NavItem[] = [
  { 
    label: 'Feed', 
    href: '/feed',
    icon: <FaUsers className="h-5 w-5" />
  },
  { 
    label: 'Scorecard', 
    href: '/scorecard',
    icon: <FaEdit className="h-5 w-5" />
  },
  { 
    label: 'Tee Times', 
    href: '/tee-times',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    )
  },
  { 
    label: 'Stats', 
    href: '/stats',
    icon: <FaChartBar className="h-5 w-5" />
  },
  { 
    label: 'Marketplace', 
    href: '/marketplace',
    icon: <FaShoppingCart className="h-5 w-5" />
  },
];

export function MainNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="w-full pl-4 pr-4 md:pr-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and brand */}
          <div className="flex items-center">
            <Link href={user ? "/dashboard" : "/"} className="flex items-center">
              <span className="text-[#22c55e]">
                <FaGolfBall className="h-8 w-8" />
              </span>
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">Bunkr</span>
            </Link>

            {/* Main navigation - desktop only */}
            <nav className="hidden md:flex items-center ml-8">
              {mainNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'mx-2 px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center',
                    pathname === item.href || pathname?.startsWith(`${item.href}/`)
                      ? 'text-green-600 font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500'
                  )}
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* TopNav (User Features) */}
          <TopNav />

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none"
            onClick={toggleMobileMenu}
          >
            {isMobileMenuOpen ? (
              <FaTimes className="h-6 w-6" />
            ) : (
              <FaBars className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div 
        className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden ${
          isMobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 py-2 space-y-1 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-inner">
          {mainNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center px-3 py-2 rounded-md text-base font-medium',
                pathname === item.href || pathname?.startsWith(`${item.href}/`)
                  ? 'text-green-600 dark:text-green-500 bg-gray-100 dark:bg-gray-700'
                  : 'text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span className="mr-3">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}