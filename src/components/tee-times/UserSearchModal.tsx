// src/components/tee-times/UserSearchModal.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Typography';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { useUsers } from '@/lib/hooks/useUsers'; // Make sure this is imported
import { UserProfile } from '@/types/auth';
import { 
  Search, 
  X, 
  AlertCircle, 
  User,
  Users,
  MapPin,
  Trophy
} from 'lucide-react';

interface UserSearchModalProps {
  onClose: () => void;
  onSelectUser: (userId: string) => Promise<void>;
  excludeUserIds?: string[];
  title?: string;
  description?: string;
  maxSelections?: number;
}

export function UserSearchModal({
  onClose,
  onSelectUser,
  excludeUserIds = [],
  title = "Invite Player",
  description = "Search for players to invite to your tee time",
  maxSelections = 1
}: UserSearchModalProps) {
  // FIXED: Ensure we're using useUsers hook properly
  const { searchUsers, loading: usersLoading } = useUsers();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noResultsMessage, setNoResultsMessage] = useState('');
  const [error, setError] = useState('');
  
  // Enhanced search with debounce
  const handleSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setNoResultsMessage('');
      return;
    }
    
    try {
      setIsSearching(true);
      setNoResultsMessage('');
      setError('');
      
      // FIXED: Make sure searchUsers exists before calling
      if (!searchUsers) {
        throw new Error('Search functionality is not available');
      }
      
      const results = await searchUsers(query, { maxResults: 20 });
      
      if (!results || results.length === 0) {
        setNoResultsMessage(`No users found matching "${query}"`);
        setSearchResults([]);
        return;
      }
      
      // Filter out excluded users
      const filteredResults = results.filter(user => 
        !excludeUserIds.includes(user.uid)
      );
      
      if (filteredResults.length === 0) {
        setNoResultsMessage('All matching users are already part of this tee time');
      }
      
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      setError('Failed to search for users. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchUsers, excludeUserIds]);
  
  // Handle user selection
  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setError('');
  };
  
  // Handle invitation submit
  const handleSubmit = async () => {
    if (!selectedUser) {
      setError('Please select a user to invite');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      await onSelectUser(selectedUser.uid);
      // onClose will be called by the parent component
    } catch (error) {
      console.error('Error inviting user:', error);
      setError(error instanceof Error ? error.message : 'Failed to invite user. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Update search results when query changes (with debounce)
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
        setNoResultsMessage('');
      }
    }, 300);
    
    return () => clearTimeout(delaySearch);
  }, [searchQuery, handleSearch]);

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      
      <DialogContent>
        <div className="space-y-4">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {description}
          </Text>
          
          <div className="relative">
            <Input
              label="Search Players"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type a name to search..."
              rightIcon={isSearching ? <LoadingSpinner size="sm" /> : <Search className="h-4 w-4" />}
              disabled={isSearching || isSubmitting}
            />
            {searchQuery.length > 0 && !isSearching && (
              <button
                type="button"
                className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setNoResultsMessage('');
                }}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {noResultsMessage && (
            <div className="flex items-center p-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-md">
              <AlertCircle className="h-4 w-4 mr-2 text-gray-400" />
              {noResultsMessage}
            </div>
          )}
          
          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <div className="flex items-center p-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-md">
              <AlertCircle className="h-4 w-4 mr-2 text-gray-400" />
              Please enter at least 2 characters to search
            </div>
          )}
          
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded border border-gray-200 dark:border-gray-700">
              {searchResults.map((user) => (
                <div 
                  key={user.uid}
                  className={`flex items-center p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    selectedUser?.uid === user.uid ? 'bg-gray-100 dark:bg-gray-800' : ''
                  }`}
                  onClick={() => handleSelectUser(user)}
                >
                  <Avatar 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    size="sm" 
                  />
                  <div className="ml-2 flex-1">
                    <p className="font-medium">{user.displayName || 'Anonymous User'}</p>
                    <div className="flex flex-wrap gap-2 mt-0.5">
                      {user.handicapIndex !== null && (
                        <Badge variant="outline" className="text-xs">
                          <Trophy className="h-3 w-3 mr-1" />
                          Handicap: {user.handicapIndex}
                        </Badge>
                      )}
                      {user.homeCourse && (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          {user.homeCourse}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {selectedUser && (
            <div className="mt-4">
              <Text className="text-sm font-medium mb-2">Selected Player:</Text>
              <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                <Avatar 
                  src={selectedUser.photoURL} 
                  alt={selectedUser.displayName || 'User'} 
                  size="sm" 
                />
                <div className="ml-3 flex-1">
                  <p className="font-medium">{selectedUser.displayName || 'Anonymous User'}</p>
                  <div className="flex flex-wrap gap-2 mt-0.5">
                    {selectedUser.handicapIndex !== null && (
                      <Badge variant="outline" className="text-xs">
                        Handicap: {selectedUser.handicapIndex}
                      </Badge>
                    )}
                    {selectedUser.homeCourse && (
                      <Badge variant="outline" className="text-xs">
                        Home: {selectedUser.homeCourse}
                      </Badge>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  onClick={() => setSelectedUser(null)}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex items-start p-3 text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-md">
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </DialogContent>
      
      <DialogFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          isLoading={isSubmitting}
          disabled={!selectedUser || isSubmitting}
        >
          Invite Player
        </Button>
      </DialogFooter>
    </Dialog>
  );
}