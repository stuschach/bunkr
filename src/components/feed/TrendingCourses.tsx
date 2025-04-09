// src/components/feed/TrendingCourses.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface TrendingCourse {
  id: string;
  name: string;
  location: string;
  recentRounds: number;
  averageScore: number;
  par: number;
}

export function TrendingCourses() {
  const [trendingCourses, setTrendingCourses] = useState<TrendingCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrendingCourses = async () => {
      try {
        setLoading(true);
        
        // In a real app, you'd have a more sophisticated trending algorithm
        // For now, just get a few random courses
        const coursesQuery = query(
          collection(db, 'courses'),
          orderBy('popularity', 'desc'),
          limit(3)
        );
        
        const querySnapshot = await getDocs(coursesQuery);
        
        // Mock data since we don't have real data
        const mockTrendingCourses: TrendingCourse[] = [
          {
            id: '1',
            name: 'Pebble Beach Golf Links',
            location: 'Pebble Beach, CA',
            recentRounds: 24,
            averageScore: 78,
            par: 72
          },
          {
            id: '2',
            name: 'Torrey Pines Golf Course',
            location: 'La Jolla, CA',
            recentRounds: 18,
            averageScore: 83,
            par: 72
          },
          {
            id: '3',
            name: 'Bethpage Black Course',
            location: 'Farmingdale, NY',
            recentRounds: 12,
            averageScore: 86,
            par: 71
          }
        ];
        
        setTrendingCourses(mockTrendingCourses);
      } catch (error) {
        console.error('Error fetching trending courses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingCourses();
  }, []);

  if (loading || trendingCourses.length === 0) {
    return null;
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
                {course.location}
              </div>
              <div className="flex items-center text-xs">
                <Badge variant="secondary" className="mr-2">
                  {course.recentRounds} recent rounds
                </Badge>
                <span className="text-gray-500 dark:text-gray-400">
                  Avg: {course.averageScore}
                </span>
              </div>
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