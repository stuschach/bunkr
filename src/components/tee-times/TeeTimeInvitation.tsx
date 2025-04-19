// src/components/tee-times/TeeTimeInvitation.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Text } from '@/components/ui/Typography';
import { TeeTime } from '@/types/tee-times';
import { UserProfile } from '@/types/auth';
import { useUsers } from '@/lib/hooks/useUsers'; // Added useUsers hook
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { 
  CheckCircle, 
  XCircle, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  Mail,
  User
} from 'lucide-react';

interface TeeTimeInvitationProps {
  teeTime: TeeTime;
  creatorProfile: UserProfile | null;
  onAccept: () => void;
  onDecline: () => void;
  isLoading?: boolean;
}

export function TeeTimeInvitation({ 
  teeTime, 
  creatorProfile: initialCreatorProfile, 
  onAccept, 
  onDecline, 
  isLoading = false 
}: TeeTimeInvitationProps) {
  const teeTimeDate = teeTime.dateTime ? new Date(teeTime.dateTime) : new Date();
  
  // Use the useUsers hook to fetch the creator profile if not provided
  const { getUserById, loading: userLoading } = useUsers();
  const [creatorProfile, setCreatorProfile] = React.useState<UserProfile | null>(initialCreatorProfile);
  
  // Track if we've attempted to fetch the creator profile
  const creatorFetchAttemptedRef = useRef(false);
  
  // Fetch creator profile if not provided
  useEffect(() => {
    const fetchCreator = async () => {
      if (!creatorProfile && teeTime.creatorId && !creatorFetchAttemptedRef.current) {
        // Mark as attempted so we don't try again in this render cycle
        creatorFetchAttemptedRef.current = true;
        
        try {
          const profile = await getUserById(teeTime.creatorId);
          if (profile && !Array.isArray(profile)) {
            setCreatorProfile(profile);
          }
        } catch (error) {
          console.error('Error fetching creator profile for invitation:', error);
        }
      }
    };
    
    fetchCreator();
  }, [teeTime.creatorId, creatorProfile, getUserById]);
  
  // Format date and time for display
  const formattedDate = format(teeTimeDate, 'EEEE, MMMM d, yyyy');
  const formattedTime = format(teeTimeDate, 'h:mm a');

  // Render creator information
  const renderCreator = () => {
    if (creatorProfile) {
      return (
        <div className="mr-3">
          <Avatar className="h-10 w-10 border-2 border-amber-200 dark:border-amber-800">
            <AvatarImage src={creatorProfile.photoURL || undefined} />
            <AvatarFallback>
              {creatorProfile.displayName?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
      );
    } else if (userLoading[teeTime.creatorId]) {
      return (
        <div className="mr-3">
          <div className="h-10 w-10 border-2 border-amber-200 dark:border-amber-800 rounded-full flex items-center justify-center bg-amber-50 dark:bg-amber-900/30">
            <LoadingSpinner size="sm" className="text-amber-500" />
          </div>
        </div>
      );
    } else {
      return (
        <div className="mr-3">
          <div className="h-10 w-10 border-2 border-amber-200 dark:border-amber-800 rounded-full flex items-center justify-center bg-amber-50 dark:bg-amber-900/30">
            <User className="h-5 w-5 text-amber-500" />
          </div>
        </div>
      );
    }
  };

  return (
    <Card className="mb-4 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-amber-100 dark:bg-amber-900/40 p-3 flex items-center border-b border-amber-200 dark:border-amber-800">
          <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2" />
          <Text className="font-medium text-amber-800 dark:text-amber-200">
            You've been invited to join this tee time
          </Text>
        </div>
        
        <div className="p-4">
          <div className="flex items-center mb-4">
            {renderCreator()}
            <div>
              <Text className="text-amber-800 dark:text-amber-200">
                <span className="font-semibold">
                  {creatorProfile?.displayName || (userLoading[teeTime.creatorId] ? 'Loading...' : 'Someone')}
                </span> has invited you to join their tee time at <span className="font-semibold">{teeTime.courseName}</span>
              </Text>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-sm">
            <div className="flex items-center text-amber-700 dark:text-amber-300">
              <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center text-amber-700 dark:text-amber-300">
              <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{formattedTime}</span>
            </div>
            <div className="flex items-center text-amber-700 dark:text-amber-300">
              <Users className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{teeTime.currentPlayers} of {teeTime.maxPlayers} players</span>
            </div>
          </div>
          
          <div className="flex space-x-3 mt-4 justify-end">
            <Button
              variant="outline"
              onClick={onDecline}
              disabled={isLoading}
              className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Decline
            </Button>
            <Button
              onClick={onAccept}
              disabled={isLoading}
              isLoading={isLoading}
              className="bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Accept & Join
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}