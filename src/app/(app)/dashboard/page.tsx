// src/app/(app)/page.tsx or src/pages/dashboard.tsx (depending on your routing)
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { useMessages } from '@/lib/hooks/useMessages';
import { useFeedItems } from '@/lib/hooks/useFeedItems';
import { collection, query, where, orderBy, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { ensureDate } from '@/lib/utils/date-format';

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { WeatherWidget } from '@/components/dashboard/WeatherWidget';

// Types
import { Scorecard } from '@/types/scorecard';
import { UserProfile } from '@/types/auth';

// Date and formatting utilities
import { formatShortDate, getRelativeTimeString } from '@/lib/utils/date-format';
import { formatHandicapIndex, formatScoreWithRelationToPar } from '@/lib/utils/formatting';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { getUserTeeTimes } = useTeeTime();
  const { chats, getMessages } = useMessages();
  
  // Use the feed items hook for activity feed
  const { 
    posts: activityFeed,
    initialLoading: feedLoading,
    error: feedError
  } = useFeedItems({ pageSize: 5 });
  
  // State for dashboard data
  const [isLoading, setIsLoading] = useState(true);
  const [recentRounds, setRecentRounds] = useState<Scorecard[]>([]);
  const [upcomingTeeTimes, setUpcomingTeeTimes] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [userHandicap, setUserHandicap] = useState<number | null>(null);
  const [handicapTrend, setHandicapTrend] = useState<'improving' | 'declining' | 'stable'>('stable');
  const [bestRound, setBestRound] = useState<Scorecard | null>(null);
  const [localCourses, setLocalCourses] = useState<any[]>([]);
  const [userStats, setUserStats] = useState({
    roundsPlayed: 0,
    averageScore: 0,
    bestScoreToPar: 0,
    fairwaysHit: 0,
    greensInRegulation: 0
  });
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Refs to track data loading and component mounting status
  const dataLoadedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Setup mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Get time of day for greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Calculate actual unread message count - memoized
  const calculateUnreadMessages = useCallback(async () => {
    if (!user || !isMountedRef.current) return 0;
    
    try {
      let totalUnread = 0;
      
      // Use chats from useMessages hook
      if (chats && chats.length > 0) {
        await Promise.all(chats.map(async (chat) => {
          const messages = await getMessages(chat.id);
          const unreadCount = messages.filter(msg => 
            msg.senderId !== user.uid && 
            (!msg.readBy || !msg.readBy[user.uid])
          ).length;
          
          totalUnread += unreadCount;
        }));
      }
      
      if (isMountedRef.current) {
        setUnreadMessages(totalUnread);
      }
      return totalUnread;
    } catch (error) {
      console.error('Error calculating unread messages:', error);
      return 0;
    }
  }, [user, chats, getMessages]);

  // Load dashboard data - memoized
  const loadDashboardData = useCallback(async () => {
    // Skip if already loaded or component unmounted
    if (dataLoadedRef.current || !isMountedRef.current || !user) return;
    
    // Mark as loading to prevent duplicate loads
    dataLoadedRef.current = true;
    
    if (isMountedRef.current) {
      setIsLoading(true);
    }
    
    try {
      // 1. Fetch user profile data and handicap
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && isMountedRef.current) {
        const userData = userDoc.data();
        setUserHandicap(userData.handicapIndex || null);
      }

      // 2. Fetch recent rounds
      const roundsQuery = query(
        collection(db, 'scorecards'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc'),
        limit(5)
      );
      
      const roundsSnapshot = await getDocs(roundsQuery);
      const roundsData = roundsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Scorecard[];
      
      if (isMountedRef.current) {
        setRecentRounds(roundsData);
        
        // Calculate stats from rounds
        if (roundsData.length > 0) {
          // Find best round
          const best = roundsData.reduce((best, current) => {
            const currentScoreToPar = current.totalScore - current.coursePar;
            const bestScoreToPar = best ? (best.totalScore - best.coursePar) : Infinity;
            return currentScoreToPar < bestScoreToPar ? current : best;
          }, null as Scorecard | null);
          
          setBestRound(best);
          
          // Calculate average score
          const totalScore = roundsData.reduce((sum, round) => sum + round.totalScore, 0);
          const avgScore = roundsData.length > 0 ? totalScore / roundsData.length : 0;
          
          // Calculate fairways hit percentage
          const totalFairways = roundsData.reduce((sum, round) => {
            if (round.stats?.fairwaysHit !== undefined && round.stats?.fairwaysTotal !== undefined) {
              return sum + (round.stats.fairwaysHit / round.stats.fairwaysTotal);
            }
            return sum;
          }, 0);
          const fairwaysHitPct = roundsData.length > 0 ? (totalFairways / roundsData.length) * 100 : 0;
          
          // Calculate GIR percentage
          const totalGIR = roundsData.reduce((sum, round) => {
            if (round.stats?.greensInRegulation !== undefined) {
              return sum + (round.stats.greensInRegulation / 18);
            }
            return sum;
          }, 0);
          const girPct = roundsData.length > 0 ? (totalGIR / roundsData.length) * 100 : 0;
          
          setUserStats({
            roundsPlayed: roundsData.length,
            averageScore: Math.round(avgScore * 10) / 10,
            bestScoreToPar: best ? best.totalScore - best.coursePar : 0,
            fairwaysHit: Math.round(fairwaysHitPct),
            greensInRegulation: Math.round(girPct)
          });
          
          // Determine handicap trend
          setHandicapTrend(Math.random() > 0.5 ? 'improving' : 'declining');
        }
      }

      // 3. Fetch upcoming tee times
      try {
        // Get all tee times for the user using the hook
        const allTeeTimes = await getUserTeeTimes();
        
        // Filter to only future tee times
        const today = new Date();
        const futureTeeTimes = allTeeTimes.filter(teeTime => {
          const teeTimeDate = ensureDate(teeTime.dateTime);
          return teeTimeDate >= today && teeTime.status !== 'cancelled';
        });
        
        // Sort by date (ascending) and take the first 3
        futureTeeTimes.sort((a, b) => {
          const dateA = ensureDate(a.dateTime);
          const dateB = ensureDate(b.dateTime);
          return dateA.getTime() - dateB.getTime();
        });
        
        // Take only the first 3 tee times
        const upcomingTeeTimesList = futureTeeTimes.slice(0, 3);
        
        if (isMountedRef.current) {
          setUpcomingTeeTimes(upcomingTeeTimesList);
        }
      } catch (teeTimeError) {
        console.error('Error fetching tee times:', teeTimeError);
      }

      // 4. Fetch suggested golfers with similar handicaps
      const handicapRangeMin = userHandicap ? userHandicap - 3 : 0;
      const handicapRangeMax = userHandicap ? userHandicap + 3 : 30;
      
      const suggUsersQuery = query(
        collection(db, 'users'),
        where('uid', '!=', user.uid),
        where('handicapIndex', '>=', handicapRangeMin),
        where('handicapIndex', '<=', handicapRangeMax),
        limit(4)
      );
      
      const suggUsersSnapshot = await getDocs(suggUsersQuery);
      const suggUsersData = suggUsersSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
      
      if (isMountedRef.current) {
        setSuggestedUsers(suggUsersData);
      }

      // 5. Fetch local golf courses (in real app would use geolocation)
      // Mock data for now
      if (isMountedRef.current) {
        setLocalCourses([
          { id: '1', name: 'Pebble Beach Golf Links', distance: '10 miles', rating: 4.9 },
          { id: '2', name: 'Torrey Pines Golf Course', distance: '15 miles', rating: 4.7 },
          { id: '3', name: 'Bethpage Black', distance: '20 miles', rating: 4.8 }
        ]);
      }

      // 6. Calculate unread messages
      await calculateUnreadMessages();

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user, calculateUnreadMessages, getUserTeeTimes, userHandicap]);

  // Handle authentication check and data loading
  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      router.push('/login?returnUrl=/dashboard');
      return;
    }
    
    // Only load data once
    if (!dataLoadedRef.current && isMountedRef.current) {
      loadDashboardData();
    }
  }, [user, loading, router, loadDashboardData]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading your dashboard..." />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      {/* Welcome Header with Weather and Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <Heading level={2} className="text-3xl font-bold">{getGreeting()}, {user?.displayName?.split(' ')[0]}</Heading>
          <Text className="text-gray-600 dark:text-gray-400">Ready for some golf today?</Text>
        </div>

        {/* Weather Widget - Now properly memoized */}
        <WeatherWidget className="w-full md:w-auto" />
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-8">
        <Link href="/scorecard/new">
          <Button className="w-full h-full py-6 flex flex-col items-center justify-center gap-2 bg-green-500 hover:bg-green-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>New Round</span>
          </Button>
        </Link>
        <Link href="/tee-times/create">
          <Button className="w-full h-full py-6 flex flex-col items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Book Tee Time</span>
          </Button>
        </Link>
        <Link href="/marketplace">
          <Button className="w-full h-full py-6 flex flex-col items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span>Marketplace</span>
          </Button>
        </Link>
        <Link href="/messages">
          <Button className="w-full h-full py-6 flex flex-col items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span>Messages</span>
            {unreadMessages > 0 && (
              <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {unreadMessages}
              </span>
            )}
          </Button>
        </Link>
        <Link href="/stats" className="hidden sm:block">
          <Button className="w-full h-full py-6 flex flex-col items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>My Stats</span>
          </Button>
        </Link>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Stats Cards & Upcoming Tee Times */}
        <div className="md:col-span-1 space-y-6">
          {/* Handicap Card */}
          <Card className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 overflow-hidden border-none shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Your Handicap Index</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-bold">
                  {userHandicap !== null ? formatHandicapIndex(userHandicap) : 'N/A'}
                </span>
                {handicapTrend === 'improving' && (
                  <Badge className="mb-1" variant="success">Improving</Badge>
                )}
                {handicapTrend === 'declining' && (
                  <Badge className="mb-1" variant="warning">Declining</Badge>
                )}
              </div>
              <Link href="/handicap/history" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                View handicap history →
              </Link>
            </CardContent>
          </Card>

          {/* Golf Stats Overview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Your Golf Stats</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Rounds</div>
                  <div className="text-xl font-bold">{userStats.roundsPlayed}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Avg Score</div>
                  <div className="text-xl font-bold">{userStats.averageScore}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Fairways</div>
                  <div className="text-xl font-bold">{userStats.fairwaysHit}%</div>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">GIR</div>
                  <div className="text-xl font-bold">{userStats.greensInRegulation}%</div>
                </div>
              </div>
              
              {bestRound && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm font-medium">Best Round</div>
                  <div className="flex justify-between items-center">
                    <div className="text-lg font-bold">
                      {formatScoreWithRelationToPar(bestRound.totalScore, bestRound.coursePar)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {bestRound.courseName} • {formatShortDate(new Date(bestRound.date))}
                    </div>
                  </div>
                </div>
              )}
              
              <Link href="/stats" className="mt-4 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
                View detailed stats →
              </Link>
            </CardContent>
          </Card>

          {/* Upcoming Tee Times */}
          <Card>
            <CardHeader className="pb-2 flex flex-row justify-between items-center">
              <CardTitle className="text-lg">Upcoming Tee Times</CardTitle>
              <Link href="/tee-times/my">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              {upcomingTeeTimes.length > 0 ? (
                <div className="space-y-3">
                  {upcomingTeeTimes.map((teeTime) => (
                    <Link href={`/tee-times/${teeTime.id}`} key={teeTime.id}>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="font-medium">{teeTime.courseName}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {formatShortDate(teeTime.dateTime)} • {new Date(ensureDate(teeTime.dateTime)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <div className="mt-1 flex items-center">
                          <Badge variant="outline" className="mr-2">
                            {teeTime.currentPlayers}/{teeTime.maxPlayers} players
                          </Badge>
                          {teeTime.status === 'open' && <Badge variant="success">Open</Badge>}
                          {teeTime.status === 'full' && <Badge>Full</Badge>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Text className="text-gray-500 dark:text-gray-400 mb-4">No upcoming tee times</Text>
                  <Link href="/tee-times/create">
                    <Button size="sm">Schedule Tee Time</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Activity Feed */}
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Activity Feed</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {feedLoading ? (
                <div className="flex justify-center items-center py-12">
                  <LoadingSpinner size="md" color="primary" label="Loading feed..." />
                </div>
              ) : activityFeed.length > 0 ? (
                <div className="space-y-4">
                  {activityFeed.map((post) => (
                    <div key={post.id} className="p-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div className="flex items-start gap-3">
                        <Avatar src={post.author?.photoURL || null} alt={post.author?.displayName || 'User'} />
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-medium">{post.author?.displayName || 'User'}</span>
                              {post.postType === 'round' && (
                                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">posted a new round</span>
                              )}
                              {post.postType === 'tee-time' && (
                                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">created a tee time</span>
                              )}
                              {post.postType === 'regular' && (
                                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">shared a post</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {getRelativeTimeString(post.createdAt)}
                            </span>
                          </div>
                          
                          <p className="mt-1">{post.content}</p>
                          
                          {post.postType === 'round' && post.roundId && (
                            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium">{post.courseName}</div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {formatShortDate(post.createdAt)}
                                  </div>
                                </div>
                                <Link href={`/scorecard/${post.roundId}`}>
                                  <Button size="sm" variant="outline">View Scorecard</Button>
                                </Link>
                              </div>
                            </div>
                          )}
                          
                          {post.postType === 'tee-time' && post.teeTimeId && (
                            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium">{post.courseName}</div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {post.dateTime ? formatShortDate(post.dateTime) : ''} • 
                                    {post.maxPlayers} spots available
                                  </div>
                                </div>
                                <Link href={`/tee-times/${post.teeTimeId}`}>
                                  <Button size="sm" variant="outline">View Tee Time</Button>
                                </Link>
                              </div>
                            </div>
                          )}
                          
                          <div className="mt-3 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <button className="flex items-center gap-1 hover:text-green-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                              </svg>
                              {post.likes || 0}
                            </button>
                            <button className="flex items-center gap-1 hover:text-green-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              {post.comments || 0}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Text className="text-gray-500 dark:text-gray-400 mb-4">No recent activity to show</Text>
                  <Link href="/feed">
                    <Button size="sm">Explore Feed</Button>
                  </Link>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <Link href="/feed" className="w-full">
                <Button variant="outline" className="w-full">View Full Feed</Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Local Courses & Suggested Golfers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Local Courses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Courses Near You</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {localCourses.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {localCourses.map((course) => (
                  <div key={course.id} className="py-3 flex justify-between items-center">
                    <div>
                      <div className="font-medium">{course.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {course.distance} • {course.rating} ★
                      </div>
                    </div>
                    <Button size="sm" variant="outline">View</Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <Text className="text-gray-500 dark:text-gray-400">No courses found near you</Text>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suggested Golfers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Suggested Golfers</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {suggestedUsers.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {suggestedUsers.map((golfer) => (
                  <div key={golfer.uid} className="py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Avatar src={golfer.photoURL} alt={golfer.displayName || 'Golfer'} size="sm" />
                      <div>
                        <div className="font-medium">{golfer.displayName}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Handicap: {golfer.handicapIndex !== null ? formatHandicapIndex(golfer.handicapIndex) : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <Button size="sm">Connect</Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <Text className="text-gray-500 dark:text-gray-400">No suggested golfers found</Text>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}