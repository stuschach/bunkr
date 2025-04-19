// src/app/(app)/tee-times/[id]/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, isPast, formatDistance } from 'date-fns';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { useUsers } from '@/lib/hooks/useUsers'; // Added useUsers hook
import { useNotificationCreator } from '@/lib/hooks/useNotificationCreator';
import { useToast } from '@/lib/hooks/useToast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { TeeTimePlayersList } from '@/components/tee-times/TeeTimePlayersList';
import { TeeTime, TeeTimePlayer } from '@/types/tee-times';
import { UserProfile } from '@/types/auth';
import { 
  InfoIcon, 
  Bell, 
  CalendarIcon, 
  ClockIcon, 
  MapPinIcon, 
  UsersIcon,
  AlertTriangle,
  Check,
  X,
  Users,
  Clock,
  Calendar,
  Mail 
} from 'lucide-react';
import { TeeTimeDetail } from '@/components/tee-times/TeeTimeDetail';

// New component: Activity Feed for tee time 
const TeeTimeActivityFeed = ({ activities }: { activities: {
  type: string;
  actor: string;
  timestamp: Date;
  message: string;
}[] }) => {
  if (activities.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
      {activities.map((activity, index) => (
        <div key={index} className="flex items-start border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mr-3 flex-shrink-0">
            <Bell className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{activity.message}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {formatDistance(activity.timestamp, new Date(), { addSuffix: true })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// New component: Bulk Invite Modal
const BulkInviteModal = ({ isOpen, onClose, onInvite, teeTimeId }: {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (userIds: string[]) => Promise<void>;
  teeTimeId: string;
}) => {
  // Use useUsers hook for more reliable user searching
  const { searchUsers: searchUsersHook, loading: searchLoading } = useUsers();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  
  // Search for users
  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    
    try {
      // Use the hook's search function
      const results = await searchUsersHook(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch();
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Toggle user selection
  const toggleUserSelection = (user: UserProfile) => {
    if (selectedUsers.some(u => u.uid === user.uid)) {
      setSelectedUsers(selectedUsers.filter(u => u.uid !== user.uid));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };
  
  // Handle bulk invite
  const handleBulkInvite = async () => {
    if (selectedUsers.length === 0) return;
    
    setIsInviting(true);
    try {
      await onInvite(selectedUsers.map(u => u.uid));
      onClose();
    } catch (error) {
      console.error('Error inviting users:', error);
    } finally {
      setIsInviting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Invite Multiple Friends</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Friends
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent focus:ring-2 focus:ring-green-500"
              />
              {searchLoading && (
                <div className="absolute right-3 top-2.5">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Results
            </label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  {searchQuery.length < 2 ? 'Type to search for friends' : 'No results found'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {searchResults.map(user => (
                    <div
                      key={user.uid}
                      className={`flex items-center p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                        selectedUsers.some(u => u.uid === user.uid) ? 'bg-green-50 dark:bg-green-900/20' : ''
                      }`}
                      onClick={() => toggleUserSelection(user)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.some(u => u.uid === user.uid)}
                        onChange={() => {}}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 mr-2"
                      />
                      <div className="flex-grow">
                        <div className="font-medium">{user.displayName || 'Unknown User'}</div>
                        {user.homeCourse && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">Home: {user.homeCourse}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Selected Friends ({selectedUsers.length})
            </label>
            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border border-gray-200 dark:border-gray-700 rounded-md">
              {selectedUsers.map(user => (
                <Badge 
                  key={user.uid}
                  className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex items-center"
                >
                  {user.displayName || 'Unknown User'}
                  <button 
                    className="ml-1.5 hover:text-red-500 dark:hover:text-red-400"
                    onClick={() => toggleUserSelection(user)}
                  >
                    &times;
                  </button>
                </Badge>
              ))}
              {selectedUsers.length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  No friends selected
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isInviting}>
          Cancel
        </Button>
        <Button 
          onClick={handleBulkInvite} 
          disabled={selectedUsers.length === 0 || isInviting}
          isLoading={isInviting}
        >
          Invite {selectedUsers.length} {selectedUsers.length === 1 ? 'Friend' : 'Friends'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

export default function TeeTimeDetails() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const notificationCreator = useNotificationCreator();
  
  // Use the tee time hook and users hook
  const { respondToInvitation, pendingOperations } = useTeeTime();
  const { getUsersByIds } = useUsers();

  // Get the tee time ID from params
  const teeTimeId = params.id as string;
  
  // Simply use the TeeTimeDetail component which now has useUsers hook implemented
  return <TeeTimeDetail teeTimeId={teeTimeId} />;
}