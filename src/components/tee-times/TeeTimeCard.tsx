// src/components/tee-times/TeeTimeCard.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistance, format } from 'date-fns';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Typography';
import { Tooltip } from '@/components/ui/Tooltip';
import { TeeTime, TeeTimeStatus } from '@/types/tee-times';
import { UserProfile } from '@/types/auth';
import { 
  Clock, 
  MapPin, 
  Users, 
  ChevronRight, 
  AlertCircle,
  Mail,
  Info,
  Check
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';

interface TeeTimeCardProps {
  teeTime: TeeTime;
  creator?: UserProfile;
  onJoinRequest?: (teeTimeId: string) => Promise<void>;
  currentUserId?: string;
  showDetails?: boolean;
}

export function TeeTimeCard({ 
  teeTime, 
  creator, 
  onJoinRequest,
  currentUserId,
  showDetails = true
}: TeeTimeCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  
  // Use the tee time hook directly in the component
  const { joinTeeTime, pendingOperations } = useTeeTime();
  
  // Local state
  const [joinRequestLoading, setJoinRequestLoading] = useState(false);
  
  // Determine if the current user is the creator
  const isCreator = user?.uid === teeTime.creatorId;
  
  // Check if the current user has been invited
  const isInvited = user?.uid && teeTime.players?.some(player => 
    player.userId === user.uid && 
    player.status === 'pending' && 
    player.requestType === 'invitation'
  );
  
  // Check if the current user has a pending request
  const hasPendingRequest = user?.uid && teeTime.players?.some(player => 
    player.userId === user.uid && 
    player.status === 'pending' && 
    (!player.requestType || player.requestType === 'join_request')
  );
  
  // Determine if the current user has joined
  const hasJoined = teeTime.players?.some(player => 
    player.userId === user?.uid && player.status === 'confirmed'
  );
  
  // Determine if user can join this tee time
  const canJoin = !isCreator && !hasJoined && !hasPendingRequest && !isInvited && teeTime.status === 'open';
  
  // Calculate time remaining until tee time
  const timeRemaining = teeTime.dateTime ? formatDistance(
    new Date(teeTime.dateTime),
    new Date(),
    { addSuffix: true }
  ) : '';
  
  // Format date and time
  const formattedDate = teeTime.dateTime ? format(
    new Date(teeTime.dateTime),
    'EEE, MMM d, yyyy'
  ) : '';
  
  const formattedTime = teeTime.dateTime ? format(
    new Date(teeTime.dateTime),
    'h:mm a'
  ) : '';

  const getStatusBadge = () => {
    switch(teeTime.status) {
      case 'open':
        return <Badge className="bg-green-500 text-white hover:bg-green-600">Open</Badge>;
      case 'full':
        return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Full</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500 text-white hover:bg-red-600">Cancelled</Badge>;
      default:
        return null;
    }
  };
  
  const handleViewDetails = () => {
    if (!showDetails) return;
    router.push(`/tee-times/${teeTime.id}`);
  };
  
  const handleJoinRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If a custom join handler is provided, use it
    if (onJoinRequest) {
      await onJoinRequest(teeTime.id);
      return;
    }
    
    // Otherwise use the built-in join handler
    if (!user) {
      router.push('/login?returnUrl=/tee-times');
      return;
    }
    
    setJoinRequestLoading(true);
    
    try {
      await joinTeeTime(teeTime.id);
    } catch (error) {
      console.error('Error joining tee time:', error);
    } finally {
      setJoinRequestLoading(false);
    }
  };

  // Determine if the tee time is today
  const isToday = teeTime.dateTime ? 
    new Date(teeTime.dateTime).toDateString() === new Date().toDateString() : 
    false;
    
  // Check if any join operation is in progress for this tee time
  const isJoining = joinRequestLoading || pendingOperations[`join_${teeTime.id}`];

  return (
    <Card 
      className={`cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg border-gray-200 dark:border-gray-800 hover:border-green-300 dark:hover:border-green-700 ${!showDetails ? 'pointer-events-none' : ''}`}
      onClick={handleViewDetails}
    >
      <div className="relative">
        {/* Course banner/image placeholder - replace with actual course image if available */}
        <div className="h-32 bg-gradient-to-r from-green-400 to-green-600 relative">
          {isToday && (
            <div className="absolute top-4 left-4 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide shadow-md">
              Today
            </div>
          )}
          <div className="absolute top-4 right-4 flex space-x-2">
            {getStatusBadge()}
            {teeTime.visibility === 'followers' && (
              <Badge className="bg-gray-600 text-white hover:bg-gray-700">Followers Only</Badge>
            )}
            {teeTime.visibility === 'private' && (
              <Badge className="bg-gray-700 text-white hover:bg-gray-800">Private</Badge>
            )}
          </div>
        </div>
        
        {/* Course name overlay */}
        <div className="absolute -bottom-5 left-4">
          <div className="bg-white dark:bg-gray-900 rounded-full px-4 py-2 shadow-md">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white truncate max-w-[240px]">
              {teeTime.courseName}
            </h3>
          </div>
        </div>
      </div>
      
      <CardContent className="pt-8 pb-4 px-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4 mr-2 text-green-500" />
            <span className="text-sm">{formattedDate} • {formattedTime}</span>
          </div>
          
          <div className="flex items-center text-gray-600 dark:text-gray-400 justify-end">
            <Users className="h-4 w-4 mr-2 text-green-500" />
            <span className="text-sm font-medium">{teeTime.currentPlayers}/{teeTime.maxPlayers}</span>
          </div>
        </div>
        
        {teeTime.description && (
          <Text className="mb-4 line-clamp-2 text-gray-600 dark:text-gray-300 text-sm">
            {teeTime.description}
          </Text>
        )}
        
        <div className="flex justify-between items-center mt-2">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
            <span className="inline-flex items-center text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4 mr-1" />
              {timeRemaining}
            </span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center">
            {creator ? (
              <>
                <Avatar 
                  src={creator.photoURL} 
                  alt={creator.displayName || 'User'} 
                  size="sm" 
                  className="border-2 border-white dark:border-gray-900"
                />
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {creator.displayName || 'Anonymous User'}
                </span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Loading host...
                </span>
              </>
            )}
          </div>
          
          <div onClick={e => e.stopPropagation()}>
            {canJoin && (
              <Button 
                size="sm" 
                onClick={handleJoinRequest}
                isLoading={isJoining}
                disabled={isJoining}
                className="bg-green-500 hover:bg-green-600 text-white font-medium rounded-full px-4 flex items-center"
              >
                {isJoining ? 'Joining...' : 'Join Group'}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {hasPendingRequest && (
              <Tooltip content="Your request to join is pending approval from the host">
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 px-3 py-1">
                  <span className="flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Pending
                  </span>
                </Badge>
              </Tooltip>
            )}
            {isInvited && (
              <Tooltip content="You've been invited to join this tee time">
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 px-3 py-1">
                  <span className="flex items-center">
                    <Mail className="h-3 w-3 mr-1" />
                    Invited
                  </span>
                </Badge>
              </Tooltip>
            )}
            {hasJoined && !isCreator && (
              <Tooltip content="You're confirmed for this tee time">
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 px-3 py-1">
                  <span className="flex items-center">
                    <Check className="h-3 w-3 mr-1" />
                    Joined
                  </span>
                </Badge>
              </Tooltip>
            )}
            {isCreator && (
              <Tooltip content="You're hosting this tee time">
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 px-3 py-1">
                  <span className="flex items-center">
                    <Users className="h-3 w-3 mr-1" />
                    Hosting
                  </span>
                </Badge>
              </Tooltip>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}