'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { useMessages } from '@/lib/contexts/MessagesContext';
import { SimplifiedUserProfile } from '@/types/messages';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

interface NewMessageDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewMessageDialog({ 
  open, 
  onClose
}: NewMessageDialogProps) {
  const router = useRouter();
  const { searchUsers, startChatWithUser, isSearchingUsers } = useMessages();
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SimplifiedUserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserIndex, setSelectedUserIndex] = useState<number>(-1);
  
  // Ref for the search input
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    
    // Clear existing timeout
    const timeoutId = setTimeout(async () => {
      try {
        setError(null);
        const results = await searchUsers(searchQuery);
        setSearchResults(results);
        
        if (results.length === 0) {
          setError(`No users found matching "${searchQuery}"`);
        }
        
        // Reset selected index when results change
        setSelectedUserIndex(-1);
      } catch (err) {
        console.error('Error searching users:', err);
        setError('Failed to search users. Please try again.');
        setSearchResults([]);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchUsers]);
  
  // Focus the search input when dialog opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open]);
  
  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      setSelectedUserIndex(-1);
    }
  }, [open]);
  
  // Handle user selection
  const handleUserSelect = async (userId: string): Promise<void> => {
    try {
      const chatId = await startChatWithUser(userId);
      
      if (chatId) {
        // Close the dialog
        onClose();
        
        // Navigate to the chat
        router.push(`/messages?chat=${chatId}`);
      } else {
        setError('Failed to start conversation');
      }
    } catch (err) {
      console.error('Error starting chat:', err);
      setError('Failed to start conversation');
    }
  };
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedUserIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedUserIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      
      case 'Enter':
        e.preventDefault();
        if (selectedUserIndex >= 0 && searchResults[selectedUserIndex]) {
          handleUserSelect(searchResults[selectedUserIndex].uid);
        } else if (
          e.target instanceof HTMLInputElement && 
          e.target === searchInputRef.current && 
          searchQuery.trim().length >= 2
        ) {
          // If enter is pressed in the search input, select the first result if available
          if (searchResults.length > 0) {
            handleUserSelect(searchResults[0].uid);
          }
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
        
      default:
        break;
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>New Message</DialogTitle>
      </DialogHeader>
      
      <DialogContent>
        <div onKeyDown={handleKeyDown} className="outline-none" tabIndex={-1}>
          <div className="mb-4 flex">
            <Input
              ref={searchInputRef}
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
              className="flex-grow"
              data-testid="user-search-input"
              aria-label="Search for users"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          <div 
            className="overflow-y-auto max-h-64 rounded-md"
            role="listbox"
            aria-label="Search results"
          >
            {isSearchingUsers ? (
              <div className="flex justify-center items-center py-8">
                <LoadingSpinner size="md" color="primary" />
                <span className="ml-2 text-gray-500">Searching for users...</span>
              </div>
            ) : searchResults.length > 0 ? (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {searchResults.map((user, index) => (
                  <li
                    key={user.uid}
                    onClick={() => handleUserSelect(user.uid)}
                    className={cn(
                      "py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md cursor-pointer",
                      selectedUserIndex === index && "bg-gray-100 dark:bg-gray-800"
                    )}
                    role="option"
                    aria-selected={selectedUserIndex === index}
                    tabIndex={0}
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        size="md"
                      />
                      <div>
                        <p className="font-medium">{user.displayName || 'User'}</p>
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
            ) : searchQuery.trim().length >= 2 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No users found matching "{searchQuery}"</p>
                <p className="text-sm mt-2">Try a different name or search term</p>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Search for users to message</p>
                <p className="text-sm mt-2">Enter a name or username above (at least 2 characters)</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}