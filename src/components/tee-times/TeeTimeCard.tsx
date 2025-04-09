// src/components/tee-times/TeeTimeCard.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { formatDistance, format } from 'date-fns';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Typography';
import { TeeTime, TeeTimeStatus } from '@/types/tee-times';
import { UserProfile } from '@/types/auth';

interface TeeTimeCardProps {
  teeTime: TeeTime;
  creator?: UserProfile;
  onJoinRequest?: (teeTimeId: string) => Promise<void>;
  currentUserId?: string;
}

export function TeeTimeCard({ 
  teeTime, 
  creator, 
  onJoinRequest,
  currentUserId
}: TeeTimeCardProps) {
  const router = useRouter();
  const isCreator = currentUserId === teeTime.creatorId;
  const hasJoined = teeTime.players?.some(player => 
    player.userId === currentUserId && ['confirmed', 'pending'].includes(player.status)
  );
  
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
        return <Badge variant="success">Open</Badge>;
      case 'full':
        return <Badge>Full</Badge>;
      case 'cancelled':
        return <Badge variant="error">Cancelled</Badge>;
      default:
        return null;
    }
  };
  
  const handleViewDetails = () => {
    router.push(`/tee-times/${teeTime.id}`);
  };
  
  const handleJoinRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onJoinRequest) {
      await onJoinRequest(teeTime.id);
    }
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleViewDetails}>
      <CardContent className="pt-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-lg font-semibold">{teeTime.courseName}</h3>
            <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
              <span>{formattedDate}</span>
              <span>•</span>
              <span>{formattedTime}</span>
            </div>
          </div>
          <div className="flex space-x-2">
            {getStatusBadge()}
            {teeTime.visibility === 'followers' && (
              <Badge variant="outline">Followers Only</Badge>
            )}
            {teeTime.visibility === 'private' && (
              <Badge variant="outline">Private</Badge>
            )}
          </div>
        </div>
        
        {teeTime.description && (
          <Text className="mb-3 line-clamp-2">{teeTime.description}</Text>
        )}
        
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="text-sm">
              <span className="font-medium">{teeTime.currentPlayers}</span>
              <span className="text-gray-500 dark:text-gray-400">/{teeTime.maxPlayers} players</span>
            </div>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {timeRemaining}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="border-t border-gray-100 dark:border-gray-800 pt-3 pb-3">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center">
            {creator && (
              <>
                <Avatar 
                  src={creator.photoURL} 
                  alt={creator.displayName || 'User'} 
                  size="sm" 
                />
                <span className="ml-2 text-sm font-medium">
                  {creator.displayName}
                </span>
              </>
            )}
          </div>
          
          <div>
            {!isCreator && !hasJoined && teeTime.status === 'open' && (
              <Button size="sm" onClick={handleJoinRequest}>
                Request to Join
              </Button>
            )}
            {hasJoined && !isCreator && (
              <Badge variant="success">Joined</Badge>
            )}
            {isCreator && (
              <Badge variant="outline">You're hosting</Badge>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}