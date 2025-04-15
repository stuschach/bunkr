// src/components/common/navigation/TopNav.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useStore } from '@/store';
import { cn } from '@/lib/utils/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Toggle } from '@/components/ui/Toggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { FaGolfBall, FaSearch, FaBell, FaEnvelope, FaUser, FaCog, FaUserCircle, FaChartBar, 
  FaEdit, FaClipboard, FaCheck, FaTimes, FaUserFriends, FaUserPlus, FaSpinner, 
  FaUsers, FaAt, FaHeart, FaComment, FaExclamationCircle, FaShoppingCart } from 'react-icons/fa';

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  
  // Get unread message count from the global store
  const unreadMessageCount = useStore(state => state.unreadMessageCount);
  
  // Theme state from store
  const theme = useStore(state => state.theme);
  const setTheme = useStore(state => state.setTheme);

  // State for search
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [profileImageError, setProfileImageError] = useState(false);
  
  // Toggle theme
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Toggle mobile search
  const toggleMobileSearch = () => {
    setShowMobileSearch(!showMobileSearch);
  };

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search_results?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowMobileSearch(false);
    }
  };

  // Handle profile image error
  const handleProfileImageError = () => {
    setProfileImageError(true);
  };

  // Get user initials for fallback avatar
  const getUserInitials = () => {
    if (!user?.displayName) return 'B';
    
    const nameParts = user.displayName.split(' ');
    if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();
    
    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <div className="flex items-center">
      {/* Search Icon and Form (Desktop) */}
      <div className="hidden md:flex relative mr-4">
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            placeholder="Search golfers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="py-1.5 pl-9 pr-3 w-48 focus:w-64 transition-all duration-300 ease-in-out rounded-full text-sm bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 focus:outline-none focus:ring-1 focus:ring-green-500 text-green-900 dark:text-green-50 placeholder-green-500/50 dark:placeholder-green-400/50"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="h-4 w-4 text-green-500" />
          </div>
        </form>
      </div>

      {/* Mobile Search Button */}
      <button 
        onClick={toggleMobileSearch}
        className="md:hidden p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mr-1"
        aria-label="Search"
      >
        <FaSearch className="h-5 w-5" />
      </button>

      {/* Theme toggle */}
      <div className="hidden md:flex items-center">
        <Toggle 
          pressed={theme === 'dark'} 
          onPressedChange={toggleTheme}
          aria-label="Toggle dark mode"
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 p-2 rounded-full"
        />
      </div>

      {/* Notifications bell - Using your existing NotificationBell component */}
      {user && (
        <NotificationBell 
          className={cn(
            "p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mx-3",
            pathname === '/notifications' && 'text-green-600 dark:text-green-500'
          )}
        />
      )}

      {/* Messages icon */}
      {user && (
        <Link
          href="/messages"
          className={cn(
            'relative p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
            pathname === '/messages' || pathname?.startsWith('/messages/')
              ? 'text-green-600 dark:text-green-500'
              : ''
          )}
        >
          <FaEnvelope className="w-5 h-5" />
          {/* Notification badge */}
          {unreadMessageCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold leading-none text-white bg-red-500 transform translate-x-1/2 -translate-y-1/2">
              {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
            </span>
          )}
        </Link>
      )}

      {/* Settings/Gear Icon */}
      {user && (
        <Link
          href="/settings"
          className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-2"
        >
          <FaCog className="h-5 w-5" />
        </Link>
      )}

      {/* Profile Link with avatar */}
      {user ? (
        <Link 
          href="/profile" 
          className="ml-3 flex items-center cursor-pointer"
        >
          {profileImageError || !user.photoURL ? (
            <div className="h-8 w-8 rounded-full bg-green-600 flex items-center justify-center text-white font-medium">
              {getUserInitials()}
            </div>
          ) : (
            <img
              src={user.photoURL}
              alt="Profile"
              className="h-8 w-8 rounded-full"
              onError={handleProfileImageError}
            />
          )}
        </Link>
      ) : (
        <div className="flex space-x-2 ml-2">
          <Link 
            href="/auth/login"
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
          >
            Sign In
          </Link>
          <Link 
            href="/auth/register"
            className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 cursor-pointer"
          >
            Sign Up
          </Link>
        </div>
      )}

      {/* Mobile Search Bar */}
      {showMobileSearch && (
        <div className="sm:hidden fixed top-16 left-0 right-0 bg-white dark:bg-gray-800 p-3 border-t border-gray-200 z-40">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="mobile-search"
                name="search"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                placeholder="Search for golfers..."
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={toggleMobileSearch}
              >
                <span className="text-gray-500 text-sm">Cancel</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}