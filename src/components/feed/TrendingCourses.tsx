// src/components/feed/TrendingCourses.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { formatDistance } from 'date-fns';

interface TrendingCourse {
  id: string;
  name: string;
  location: string;
  recentRounds: number;
  lastPlayed: Date;
  playedByFollowing: string[];
}

interface RoundPost {
  id: string;
  authorId: string;
  courseName?: string;
  courseId?: string;
  postType: string;
  location?: {
    name?: string;
  };
  course?: {
    name?: string;
  };
  round?: {
    courseName?: string;
  };
  createdAt: Timestamp | { toDate?: () => Date; seconds?: number; nanoseconds?: number } | Date;
  date?: string | Timestamp | { toDate?: () => Date; seconds?: number; nanoseconds?: number };
}

export function TrendingCourses() {
  const { user } = useAuth();
  const [trendingCourses, setTrendingCourses] = useState<TrendingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noFollowing, setNoFollowing] = useState(false);
  const [debugMode] = useState(process.env.NODE_ENV === 'development');

  // Helper to safely convert any timestamp-like object to a Date
  const safelyGetDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    
    try {
      // Handle Firestore Timestamp objects
      if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }
      
      // Handle timestamp-like objects with seconds
      if (timestamp.seconds !== undefined) {
        return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
      }
      
      // Handle Date objects
      if (timestamp instanceof Date) {
        return timestamp;
      }
      
      // Handle ISO date strings
      if (typeof timestamp === 'string') {
        return new Date(timestamp);
      }
      
      // Default fallback
      return new Date();
    } catch (e) {
      console.error("Error parsing date:", e);
      return new Date();
    }
  };

  // Function to fetch courses played by followed users
  const fetchTrendingCourses = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      setNoFollowing(false);
      
      if (debugMode) console.log("🐛 Starting trending courses fetch for user", user.uid);
      
      // Direct approach to get all round posts
      // This gets ALL recent round posts, then we'll filter by followed users
      // This is more reliable when testing with few users
      const allRoundsQuery = query(
        collection(db, 'posts'),
        where('postType', '==', 'round'),
        orderBy('createdAt', 'desc'),
        limit(50) // Get enough to ensure we capture relevant rounds
      );
      
      const roundsSnapshot = await getDocs(allRoundsQuery);
      
      // Now get following list to filter these posts
      const followingQuery = query(
        collection(db, 'users', user.uid, 'connections'),
        where('type', '==', 'following'),
        where('active', '==', true)
      );
      
      const followingSnapshot = await getDocs(followingQuery);
      
      // Extract the IDs of users being followed
      const followingIds = followingSnapshot.docs.map(doc => doc.data().userId as string);
      
      if (debugMode) {
        console.log(`🐛 Following ${followingIds.length} users:`, followingIds);
        console.log(`🐛 Found ${roundsSnapshot.docs.length} total rounds`);
      }
      
      if (followingIds.length === 0) {
        // No users being followed - set flag and return empty
        if (debugMode) console.log("🐛 No followed users found");
        setNoFollowing(true);
        setTrendingCourses([]);
        setLoading(false);
        return;
      }
      
      // Filter rounds by followed users
      const followedUserRounds: RoundPost[] = roundsSnapshot.docs
        .map((doc: QueryDocumentSnapshot<DocumentData>) => ({
          id: doc.id,
          ...doc.data()
        } as RoundPost))
        .filter((round: RoundPost) => followingIds.includes(round.authorId));
      
      if (debugMode) {
        console.log(`🐛 After filtering, found ${followedUserRounds.length} rounds from followed users`);
        followedUserRounds.forEach((round, i) => {
          console.log(`🐛 Round ${i + 1}:`, {
            id: round.id,
            authorId: round.authorId,
            courseName: round.courseName,
            postType: round.postType
          });
        });
      }

      // If no rounds from followed users, show the empty state
      if (followedUserRounds.length === 0) {
        if (debugMode) console.log("🐛 No rounds from followed users");
        setTrendingCourses([]);
        setLoading(false);
        return;
      }
      
      // Process rounds to extract course information
      const courseMap = new Map<string, TrendingCourse>();
      
      // For each round, try multiple ways to get the course name
      followedUserRounds.forEach(round => {
        // Try different possible locations for course name
        const courseName = round.courseName || 
                          (round.round?.courseName) || 
                          (round.location?.name) || 
                          (round.course?.name) || '';
        
        if (debugMode) {
          console.log(`🐛 Processing round ${round.id} by ${round.authorId}:`);
          console.log(`🐛   - courseName: ${round.courseName || 'undefined'}`);
          console.log(`🐛   - location?.name: ${round.location?.name || 'undefined'}`);
          console.log(`🐛   - Used courseName: ${courseName || 'undefined'}`);
        }
        
        // Skip if we can't determine a course name
        if (!courseName) {
          if (debugMode) console.log(`🐛 Skipping round ${round.id} - no course name found`);
          return;
        }
        
        // Use courseId if available, otherwise generate one from name
        const courseId = round.courseId || `name:${courseName}`;
        
        // Parse date with our safe helper
        const roundDate = safelyGetDate(round.createdAt || round.date);
        
        if (courseMap.has(courseId)) {
          // Update existing course data
          const courseData = courseMap.get(courseId)!;
          courseData.recentRounds++;
          
          // Update most recent play date if this round is more recent
          if (roundDate > courseData.lastPlayed) {
            courseData.lastPlayed = roundDate;
          }
          
          // Add user to played by list if not already included
          if (!courseData.playedByFollowing.includes(round.authorId)) {
            courseData.playedByFollowing.push(round.authorId);
          }
        } else {
          // Create new course entry
          courseMap.set(courseId, {
            id: round.courseId || courseId,
            name: courseName,
            location: round.location?.name || '',
            recentRounds: 1,
            lastPlayed: roundDate,
            playedByFollowing: [round.authorId]
          });
        }
      });
      
      if (debugMode) {
        console.log("🐛 Processed courses:", Array.from(courseMap.entries()));
      }
      
      // Sort courses by number of plays and then by recency
      const sortedCourses = Array.from(courseMap.values())
        .sort((a, b) => {
          // First by number of rounds (descending)
          const roundsDiff = b.recentRounds - a.recentRounds;
          if (roundsDiff !== 0) return roundsDiff;
          
          // Then by recency (descending)
          return b.lastPlayed.getTime() - a.lastPlayed.getTime();
        });
      
      setTrendingCourses(sortedCourses);
      
    } catch (error) {
      console.error('Error fetching trending courses:', error);
      setError('Failed to load trending courses');
      setTrendingCourses([]);
    } finally {
      setLoading(false);
    }
  }, [user, debugMode]);

  useEffect(() => {
    fetchTrendingCourses();
  }, [fetchTrendingCourses]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md">Trending Courses</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center p-4">
          <LoadingSpinner size="sm" color="primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md">Trending Courses</CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-sm text-red-500">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (noFollowing) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md">Trending Courses</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Follow golfers to see which courses are trending in your network
            </p>
            <Link href="/discover/golfers">
              <Button size="sm" className="bg-green-500 hover:bg-green-600">
                Find Golfers
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trendingCourses.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md">Trending Courses</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              No recent course activity from golfers you follow
            </p>
            <Link href="/discover/golfers">
              <Button size="sm" className="bg-green-500 hover:bg-green-600">
                Follow More Golfers
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md">Trending Courses</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          {trendingCourses.map((course) => (
            <Link 
              key={course.id} 
              href={`/courses/${course.id}`}
              className="block p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
            >
              <div className="font-medium">{course.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {course.location || 'No location data'}
              </div>
              <div className="flex items-center text-xs">
                <Badge variant="secondary" className="mr-2">
                  {course.recentRounds} recent {course.recentRounds === 1 ? 'round' : 'rounds'}
                </Badge>
                <span className="text-gray-500 dark:text-gray-400">
                  Last played {formatDistance(course.lastPlayed, new Date(), { addSuffix: true })}
                </span>
              </div>
              {course.playedByFollowing.length > 0 && (
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Played by {course.playedByFollowing.length} {course.playedByFollowing.length === 1 ? 'golfer' : 'golfers'} you follow
                </div>
              )}
            </Link>
          ))}
        </div>
        <div className="mt-3 text-center">
          <Link href="/courses" className="text-sm text-green-500 hover:text-green-600">
            Explore Courses
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}