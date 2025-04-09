// src/components/feed/UpcomingEvents.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatShortDate } from '@/lib/utils/date-format';

interface Event {
  id: string;
  title: string;
  date: Date;
  location: string;
  participants: number;
  maxParticipants: number;
  type: 'tournament' | 'casual' | 'lesson';
}

export function UpcomingEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        setLoading(true);
        
        // Mock data since we don't have real data
        const mockEvents: Event[] = [
          {
            id: '1',
            title: 'Weekend Tournament',
            date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
            location: 'Oakmont Country Club',
            participants: 18,
            maxParticipants: 24,
            type: 'tournament'
          },
          {
            id: '2',
            title: 'Beginner Golf Lesson',
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            location: 'City Municipal Course',
            participants: 5,
            maxParticipants: 10,
            type: 'lesson'
          },
          {
            id: '3',
            title: 'Friday Afternoon Round',
            date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
            location: 'Pine Valley Golf Club',
            participants: 3,
            maxParticipants: 4,
            type: 'casual'
          }
        ];
        
        setEvents(mockEvents);
      } catch (error) {
        console.error('Error fetching upcoming events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcomingEvents();
  }, []);

  if (loading || events.length === 0) {
    return null;
  }

  const getEventTypeColor = (type: Event['type']) => {
    switch (type) {
      case 'tournament': return 'error';
      case 'lesson': return 'info';
      case 'casual': return 'success';
      default: return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md">Upcoming Events</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          {events.map((event) => (
            <Link 
              key={event.id} 
              href={`/events/${event.id}`}
              className="block p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
            >
              <div className="font-medium">{event.title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatShortDate(event.date)} • {event.location}
              </div>
              <div className="flex items-center justify-between mt-1">
                <Badge variant={getEventTypeColor(event.type)}>
                  {event.type}
                </Badge>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {event.participants}/{event.maxParticipants} joined
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-3 text-center">
          <Link href="/events" className="text-sm text-green-500 hover:text-green-600">
            View All Events
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}