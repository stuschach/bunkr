// src/components/feed/UpcomingEvents.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { format } from 'date-fns';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { TeeTime, TeeTimeFilters } from '@/types/tee-times';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Timestamp } from 'firebase/firestore';

export function UpcomingEvents() {
  const { getPublicTeeTimesList, isLoading } = useTeeTime();
  const [upcomingTeeTimes, setUpcomingTeeTimes] = useState<TeeTime[]>([]);
  const [loadingTeeTimes, setLoadingTeeTimes] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchUpcomingTeeTimes = async () => {
      try {
        setLoadingTeeTimes(true);
        
        // Create filters - use the same format as in your tee-times page
        const filters: TeeTimeFilters = {
          status: 'open',
          date: null
        };
        
        // Get tee times
        const result = await getPublicTeeTimesList(filters, null, 3);
        
        if (!isMounted) return;
        
        // Set the tee times directly
        setUpcomingTeeTimes(result.teeTimes.slice(0, 3));
      } catch (error) {
        console.error('Error fetching upcoming tee times:', error);
        // Set empty array on error
        setUpcomingTeeTimes([]);
      } finally {
        if (isMounted) {
          setLoadingTeeTimes(false);
        }
      }
    };

    fetchUpcomingTeeTimes();
    
    return () => {
      isMounted = false;
    };
  }, [getPublicTeeTimesList]);

  // Format the dateTime field
  const formatDateTime = (dateTime: Date | Timestamp | string): string => {
    try {
      let date: Date;
      
      if (dateTime instanceof Date) {
        date = dateTime;
      } else if (typeof dateTime === 'object' && dateTime !== null && 'toDate' in dateTime) {
        date = (dateTime as Timestamp).toDate();
      } else {
        date = new Date(dateTime);
      }
      
      // Format date as "MMM d • h:mm a" (e.g. "Apr 15 • 2:30 PM")
      return format(date, 'MMM d • h:mm a');
    } catch (e) {
      console.error('Error formatting dateTime:', e);
      return 'Date pending';
    }
  };

  // Show loading state
  if (loadingTeeTimes || isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md">Upcoming Tee Times</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center p-4">
          <LoadingSpinner size="sm" color="primary" />
        </CardContent>
      </Card>
    );
  }

  // Always show the card, even if no tee times are available
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md">Upcoming Tee Times</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {upcomingTeeTimes.length > 0 ? (
          <>
            <div className="space-y-3">
              {upcomingTeeTimes.map((teeTime) => (
                <Link 
                  key={teeTime.id} 
                  href={`/tee-times/${teeTime.id}`}
                  className="block p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
                >
                  <div className="font-medium">{teeTime.courseName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDateTime(teeTime.dateTime)}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant={teeTime.visibility === 'private' ? 'secondary' : 'success'}>
                      {teeTime.visibility === 'private' ? 'Private' : 'Public'}
                    </Badge>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {teeTime.currentPlayers || (teeTime.players?.length || 0)}/{teeTime.maxPlayers} joined
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              No upcoming tee times
            </p>
          </div>
        )}
        <div className="mt-3 text-center">
          <Link href="/tee-times" className="text-sm text-green-500 hover:text-green-600">
            {upcomingTeeTimes.length > 0 ? "View All Tee Times" : "Create a Tee Time"}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}