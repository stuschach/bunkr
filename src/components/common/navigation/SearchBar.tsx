// src/components/common/navigation/SearchBar.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';

// User search result type
interface UserSearchResult {
  uid: string;
  displayName: string;
  photoURL?: string;
}

// Props for the SearchBar component
interface SearchBarProps {
  className?: string;
  placeholder?: string;
  onClose?: () => void;
  isMobile?: boolean;
}

// Placeholder search function - replace with your API implementation
async function searchUsers(query: string): Promise<UserSearchResult[]> {
  try {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search failed');
    return await response.json();
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

export function SearchBar({ 
  className = '', 
  placeholder = 'Search users...', 
  onClose,
  isMobile = false
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Handle search input
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim().length >= 2) {
      try {
        const results = await searchUsers(query);
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
    }
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle user selection
  const handleUserSelect = () => {
    setIsSearchFocused(false);
    setSearchQuery('');
    if (onClose) onClose();
  };

  return (
    <div ref={searchRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          className="w-full py-2 pl-10 pr-4 border-0 rounded-full focus:ring-2 focus:ring-white/50 text-white placeholder-white/70 bg-transparent"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => setIsSearchFocused(true)}
        />
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
      </div>
      
      {/* Search results dropdown */}
      {isSearchFocused && searchResults.length > 0 && (
        <div className={`absolute top-full left-0 right-0 mt-1 bg-white dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg shadow-lg ${isMobile ? 'z-50' : 'z-20'} max-h-60 overflow-y-auto`}>
          {searchResults.map((user) => (
            <Link
              key={user.uid}
              href={`/profile/${user.uid}`}
              className="flex items-center px-4 py-3 hover:bg-green-50 dark:hover:bg-green-800 transition-colors"
              onClick={handleUserSelect}
            >
              <Avatar 
                src={user.photoURL} 
                alt={user.displayName} 
                fallback={user.displayName?.charAt(0) || 'U'} 
                size="sm"
              />
              <span className="ml-3 font-medium dark:text-white">{user.displayName}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}