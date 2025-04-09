// src/components/feed/SuggestedUsers.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, limit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatHandicapIndex } from '@/lib/utils/formatting';
import { UserProfile } from '@/types/auth';

export function SuggestedUsers() {
  const { user } = useAuth();
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestedUsers = async () => {
      if (!user) return;

      try {
        setLoading(true);
        
        // In a real app, you'd have a more sophisticated suggestion algorithm
        // For now, just get a few random users
        const usersQuery = query(
          collection(db, 'users'),
          where('uid', '!=', user.uid),
          limit(3)
        );
        
        const querySnapshot = await getDocs(usersQuery);
        
        const users = querySnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        } as UserProfile));
        
        setSuggestedUsers(users);
      } catch (error) {
        console.error('Error fetching suggested users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestedUsers();
  }, [user]);

  if (loading || suggestedUsers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md">Suggested For You</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          {suggestedUsers.map((suggestedUser) => (
            <div key={suggestedUser.uid} className="flex justify-between items-center">
              <Link href={`/profile/${suggestedUser.uid}`} className="flex items-center">
                <Avatar
                  src={suggestedUser.photoURL}
                  alt={suggestedUser.displayName || 'User'}
                  size="sm"
                  className="mr-2"
                />
                <div>
                  <div className="font-medium text-sm">
                    {suggestedUser.displayName}
                    {suggestedUser.handicapIndex !== null && (
                      <Badge variant="outline" className="ml-1 text-xs">
                        {formatHandicapIndex(suggestedUser.handicapIndex)}
                      </Badge>
                    )}
                  </div>
                  {suggestedUser.homeCourse && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {suggestedUser.homeCourse}
                    </div>
                  )}
                </div>
              </Link>
              <Button size="sm" variant="outline">
                Follow
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3 text-center">
          <Link href="/discover/golfers" className="text-sm text-green-500 hover:text-green-600">
            See More
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}