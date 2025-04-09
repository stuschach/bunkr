// src/components/scorecard/RoundHistory.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, limit, getDocs, startAfter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { formatScoreWithRelationToPar } from '@/lib/utils/formatting';
import { getRelativeTimeString } from '@/lib/utils/date-format';
import { Scorecard } from '@/types/scorecard';

interface RoundHistoryProps {
  userId?: string; // If provided, show rounds for a specific user, otherwise show current user's rounds
  limit?: number;
  showFilters?: boolean;
  showAddButton?: boolean;
}

export function RoundHistory({ 
  userId, 
  limit: itemLimit = 10,
  showFilters = true,
  showAddButton = true
}: RoundHistoryProps) {
  const router = useRouter();
  const { user } = useAuth();
  
  // State for rounds data
  const [rounds, setRounds] = useState<Scorecard[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('date_desc');
  const [courseFilter, setCourseFilter] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  
  // Get the target user ID - either from props or current user
  const targetUserId = userId || user?.uid;
  
  // Load rounds from Firestore
  useEffect(() => {
    if (!targetUserId) {
      setIsLoading(false);
      setError('No user ID available');
      return;
    }
    
    loadRounds();
  }, [targetUserId, sortOption, timeFilter, courseFilter]);
  
  // Function to load rounds with pagination and filters
  const loadRounds = async (loadMore = false) => {
    if (!targetUserId) return;
    
    try {
      setIsLoading(true);
      
      // Start building the query
      let roundsQuery = query(
        collection(db, 'scorecards'),
        where('userId', '==', targetUserId)
      );
      
      // Apply course filter if selected
      if (courseFilter) {
        roundsQuery = query(
          roundsQuery,
          where('courseId', '==', courseFilter)
        );
      }
      
      // Apply time filter if selected
      if (timeFilter !== 'all') {
        const dateLimit = new Date();
        
        if (timeFilter === 'last30') {
          dateLimit.setDate(dateLimit.getDate() - 30);
        } else if (timeFilter === 'last90') {
          dateLimit.setDate(dateLimit.getDate() - 90);
        } else if (timeFilter === 'thisYear') {
          dateLimit.setMonth(0, 1); // January 1st of current year
        }
        
        roundsQuery = query(
          roundsQuery,
          where('date', '>=', dateLimit.toISOString().split('T')[0])
        );
      }
      
      // Apply sorting
      const [sortField, sortDirection] = sortOption.split('_');
      roundsQuery = query(
        roundsQuery,
        orderBy(sortField, sortDirection as 'asc' | 'desc')
      );
      
      // Apply pagination
      roundsQuery = query(roundsQuery, limit(itemLimit));
      
      // If loading more, start after the last document
      if (loadMore && lastVisible) {
        roundsQuery = query(roundsQuery, startAfter(lastVisible));
      } else {
        // Reset rounds if this is a new query
        setRounds([]);
      }
      
      // Execute query
      const querySnapshot = await getDocs(roundsQuery);
      
      // Check if there are more results
      setHasMore(querySnapshot.docs.length === itemLimit);
      
      // Get the last visible document for pagination
      setLastVisible(
        querySnapshot.docs.length > 0 
          ? querySnapshot.docs[querySnapshot.docs.length - 1] 
          : null
      );
      
      // Parse rounds data
      const newRounds = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
        } as Scorecard;
      });
      
      // Apply client-side search filter if needed
      const filteredRounds = searchTerm 
        ? newRounds.filter(round => 
            round.courseName.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : newRounds;
      
      // Update state with new rounds
      setRounds(prev => loadMore ? [...prev, ...filteredRounds] : filteredRounds);
    } catch (error) {
      console.error('Error loading rounds:', error);
      setError('Failed to load rounds. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle loading more rounds
  const handleLoadMore = () => {
    loadRounds(true);
  };
  
  // Filter change handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOption(e.target.value);
  };
  
  const handleTimeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeFilter(e.target.value);
  };
  
  // Add new round
  const handleAddRound = () => {
    router.push('/scorecard/new');
  };

  return (
    <div className="space-y-4">
      {/* Header and add button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Round History</h2>
        {showAddButton && user && (
          <Button onClick={handleAddRound}>
            Add Round
          </Button>
        )}
      </div>
      
      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-950 p-4 rounded-md border border-gray-200 dark:border-gray-800 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-grow">
              <Input
                type="text"
                placeholder="Search by course name"
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
            
            <div className="w-full md:w-48">
              <Select
                options={[
                  { value: 'date_desc', label: 'Newest First' },
                  { value: 'date_asc', label: 'Oldest First' },
                  { value: 'totalScore_asc', label: 'Best Score' },
                  { value: 'totalScore_desc', label: 'Worst Score' },
                ]}
                value={sortOption}
                onChange={handleSortChange}
              />
            </div>
            
            <div className="w-full md:w-48">
              <Select
                options={[
                  { value: 'all', label: 'All Time' },
                  { value: 'last30', label: 'Last 30 Days' },
                  { value: 'last90', label: 'Last 90 Days' },
                  { value: 'thisYear', label: 'This Year' },
                ]}
                value={timeFilter}
                onChange={handleTimeFilterChange}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Loading state */}
      {isLoading && rounds.length === 0 && (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="lg" color="primary" label="Loading rounds..." />
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-md">
          {error}
        </div>
      )}
      
      {/* Empty state */}
      {!isLoading && rounds.length === 0 && !error && (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-md">
          <h3 className="text-lg font-medium mb-2">No rounds found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchTerm || courseFilter || timeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Start by adding your first round'}
          </p>
          
          {showAddButton && user && (
            <Button onClick={handleAddRound}>
              Add Your First Round
            </Button>
          )}
        </div>
      )}
      
      {/* Rounds list */}
      {rounds.length > 0 && (
        <div className="space-y-4">
          {rounds.map((round) => (
            <Link key={round.id} href={`/scorecard/${round.id}`}>
              <RoundCard round={round} />
            </Link>
          ))}
          
          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner size="sm" color="primary" /> : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper component for round cards
function RoundCard({ round }: { round: Scorecard }) {
  // Format date
  const formattedDate = new Date(round.date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  // Calculate front 9 and back 9 scores
  const front9 = round.holes.slice(0, 9).reduce((sum, hole) => sum + hole.score, 0);
  const back9 = round.holes.slice(9, 18).reduce((sum, hole) => sum + hole.score, 0);
  
  return (
    <Card className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer">
      <CardContent className="p-4">
        <div className="flex justify-between">
          <div>
            <h3 className="font-medium">{round.courseName}</h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {formattedDate} • {round.teeBox.name}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xl font-bold">
              {formatScoreWithRelationToPar(round.totalScore, round.coursePar)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {front9}/{back9}
            </div>
          </div>
        </div>
        
        {/* Quick stats */}
        <div className="flex gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-medium">FIR:</span> {round.stats.fairwaysHit}/{round.stats.fairwaysTotal}
          </div>
          <div>
            <span className="font-medium">GIR:</span> {round.stats.greensInRegulation}/18
          </div>
          <div>
            <span className="font-medium">Putts:</span> {round.stats.totalPutts}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}