'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/types/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

interface NewMessageDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
  onSearchUsers: (query: string) => Promise<UserProfile[]>;
}

export function NewMessageDialog({ 
  open, 
  onClose, 
  onSelectUser, 
  onSearchUsers 
}: NewMessageDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search handler
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const results = await onSearchUsers(searchQuery.trim());
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search users. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    onSelectUser(userId);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>New Message</DialogTitle>
      </DialogHeader>
      
      <DialogContent>
        <div className="mb-4">
          <Input
            placeholder="Search for users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            }
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="overflow-y-auto max-h-64">
          {isSearching ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" color="primary" />
            </div>
          ) : searchResults.length > 0 ? (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              {searchResults.map((user) => (
                <li
                  key={user.uid}
                  onClick={() => handleUserSelect(user.uid)}
                  className="py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      size="md"
                    />
                    <div>
                      <p className="font-medium">{user.displayName}</p>
                      {user.handicapIndex !== null && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Handicap: {user.handicapIndex}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : searchQuery.trim() ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No users found matching "{searchQuery}"
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Search for users to message
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}