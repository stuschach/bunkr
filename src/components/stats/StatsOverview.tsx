import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Scorecard } from '@/types/scorecard';
import { formatHandicapIndex } from '@/lib/utils/formatting';

interface StatsOverviewProps {
  rounds: Scorecard[];
  userHandicapIndex?: number | null; // New prop to accept user handicap index from Firebase
}

export function StatsOverview({ rounds, userHandicapIndex }: StatsOverviewProps) {
  // Calculate overview stats
  const stats = useMemo(() => {
    if (!rounds.length) return null;

    // Sort rounds by date (most recent first)
    const sortedRounds = [...rounds].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Get the 20 most recent rounds for calculations
    const recentRounds = sortedRounds.slice(0, 20);
    
    // Calculate average score
    const avgScore = recentRounds.reduce((sum, round) => sum + round.totalScore, 0) / recentRounds.length;
    
    // Calculate scoring trends (last 5 rounds vs previous 5)
    const last5 = recentRounds.slice(0, 5);
    const prev5 = recentRounds.slice(5, 10);
    
    const last5Avg = last5.length 
      ? last5.reduce((sum, round) => sum + round.totalScore, 0) / last5.length 
      : 0;
    const prev5Avg = prev5.length 
      ? prev5.reduce((sum, round) => sum + round.totalScore, 0) / prev5.length 
      : 0;
    
    const scoringTrend = prev5.length ? last5Avg - prev5Avg : 0;
    
    // Find best/worst rounds
    const bestRound = [...rounds].sort((a, b) => {
      // Compare score relative to par
      const aScoreToPar = a.totalScore - a.coursePar;
      const bScoreToPar = b.totalScore - b.coursePar;
      return aScoreToPar - bScoreToPar;
    })[0];
    
    // Calculate stats
    const totalRounds = rounds.length;
    const roundsThisYear = rounds.filter(round => {
      const roundDate = new Date(round.date);
      const currentYear = new Date().getFullYear();
      return roundDate.getFullYear() === currentYear;
    }).length;
    
    // Use the handicap index from the user profile instead of calculating from rounds
    const handicapIndex = userHandicapIndex;
    
    // Calculate FIR, GIR, and putts per round averages
    const fairwaysHit = rounds.reduce((sum, round) => sum + (round.stats?.fairwaysHit || 0), 0);
    const fairwaysTotal = rounds.reduce((sum, round) => sum + (round.stats?.fairwaysTotal || 0), 0);
    const greensInRegulation = rounds.reduce((sum, round) => sum + (round.stats?.greensInRegulation || 0), 0);
    const putts = rounds.reduce((sum, round) => sum + (round.stats?.totalPutts || 0), 0);
    
    const firPercent = fairwaysTotal > 0 ? (fairwaysHit / fairwaysTotal) * 100 : 0;
    const girPercent = (greensInRegulation / (rounds.length * 18)) * 100;
    const puttsPerRound = putts / rounds.length;
    
    // Calculate best hole (the one with the lowest average score to par)
    const holeStats = Array(18).fill(0).map((_, i) => {
      const holeNumber = i + 1;
      const scores = rounds
        .filter(r => r.holes && r.holes.length >= holeNumber)
        .map(r => {
          const hole = r.holes[i];
          return {
            score: hole.score,
            par: hole.par,
            scoreToPar: hole.score - hole.par
          };
        });
      
      const avgScoreToPar = scores.reduce((sum, s) => sum + s.scoreToPar, 0) / scores.length;
      
      return {
        holeNumber,
        avgScoreToPar,
        count: scores.length
      };
    });
    
    // Find best and worst holes
    const bestHole = [...holeStats].filter(h => h.count > 0).sort((a, b) => a.avgScoreToPar - b.avgScoreToPar)[0];
    const worstHole = [...holeStats].filter(h => h.count > 0).sort((a, b) => b.avgScoreToPar - a.avgScoreToPar)[0];
    
    return {
      totalRounds,
      roundsThisYear,
      handicapIndex,
      avgScore,
      scoringTrend,
      bestRound,
      firPercent,
      girPercent,
      puttsPerRound,
      bestHole,
      worstHole
    };
  }, [rounds, userHandicapIndex]); // Added userHandicapIndex to dependency array
  
  if (!stats) return null;

  // Determine trend indicator for scoring
  const getTrendBadge = (trend: number) => {
    if (trend < -0.5) {
      return <Badge variant="success" className="ml-2">Improving</Badge>;
    } else if (trend > 0.5) {
      return <Badge variant="error" className="ml-2">Declining</Badge>;
    }
    return <Badge variant="secondary" className="ml-2">Stable</Badge>;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Rounds Played */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col">
            <span className="text-sm text-gray-500 dark:text-gray-400">Rounds Played</span>
            <div className="mt-2 flex items-baseline">
              <span className="text-3xl font-bold">{stats.totalRounds}</span>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                ({stats.roundsThisYear} this year)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Handicap Index */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col">
            <span className="text-sm text-gray-500 dark:text-gray-400">Handicap Index</span>
            <div className="mt-2 flex items-baseline">
              <span className="text-3xl font-bold">
                {stats.handicapIndex !== null 
                  ? formatHandicapIndex(stats.handicapIndex) 
                  : 'N/A'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Average Score */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col">
            <span className="text-sm text-gray-500 dark:text-gray-400">Average Score</span>
            <div className="mt-2 flex items-center">
              <span className="text-3xl font-bold">{stats.avgScore.toFixed(1)}</span>
              {getTrendBadge(stats.scoringTrend)}
            </div>
            <span className="mt-1 text-xs text-gray-500">
              {Math.abs(stats.scoringTrend) > 0.1 
                ? `${Math.abs(stats.scoringTrend).toFixed(1)} strokes ${stats.scoringTrend < 0 ? 'better' : 'worse'} than previous 5 rounds` 
                : 'Score stable compared to previous rounds'}
            </span>
          </div>
        </CardContent>
      </Card>
      
      {/* Key Stats */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col">
            <span className="text-sm text-gray-500 dark:text-gray-400">Key Performance</span>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Fairways</span>
                <span className="font-medium">{stats.firPercent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">GIR</span>
                <span className="font-medium">{stats.girPercent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Putts/Round</span>
                <span className="font-medium">{stats.puttsPerRound.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Best Round */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col">
            <span className="text-sm text-gray-500 dark:text-gray-400">Best Round</span>
            {stats.bestRound ? (
              <div className="mt-2">
                <div className="flex items-baseline">
                  <span className="text-2xl font-bold">
                    {stats.bestRound.totalScore}
                  </span>
                  <span className="ml-2 text-sm">
                    ({stats.bestRound.totalScore - stats.bestRound.coursePar < 0 ? '' : '+'}
                    {stats.bestRound.totalScore - stats.bestRound.coursePar})
                  </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {stats.bestRound.courseName} • {new Date(stats.bestRound.date).toLocaleDateString()}
                </span>
              </div>
            ) : (
              <span className="mt-2 text-lg">No data</span>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Best & Worst Holes */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col">
            <span className="text-sm text-gray-500 dark:text-gray-400">Hole Performance</span>
            <div className="mt-2 space-y-3">
              <div>
                <div className="flex justify-between">
                  <span className="text-sm">Best Hole</span>
                  <span className="font-medium text-green-500">
                    #{stats.bestHole?.holeNumber} ({stats.bestHole?.avgScoreToPar.toFixed(2)})
                  </span>
                </div>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm">Worst Hole</span>
                  <span className="font-medium text-red-500">
                    #{stats.worstHole?.holeNumber} (+{stats.worstHole?.avgScoreToPar.toFixed(2)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Recent Trend */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col h-full justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Recent Trend</span>
            <div className="flex-grow flex items-center justify-center">
              {/* Simple mini chart showing last 5 rounds */}
              <div className="w-full h-12 flex items-end">
                {rounds.slice(0, 5).map((round, i) => {
                  const scoreToPar = round.totalScore - round.coursePar;
                  // Color based on score (red for over par, green for under)
                  const barColor = scoreToPar <= 0 
                    ? 'bg-green-500' 
                    : scoreToPar <= 3 
                      ? 'bg-yellow-500' 
                      : 'bg-red-500';
                  
                  // Height based on score relative to par (inverted so lower is better)
                  const maxHeight = 48;
                  const normalizedScore = Math.min(Math.max(scoreToPar, -5), 10);
                  const height = maxHeight - ((normalizedScore + 5) / 15 * maxHeight);
                  
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center mx-1">
                      <div 
                        className={`w-full ${barColor} rounded-t-sm`} 
                        style={{ height: `${height}px` }}
                      ></div>
                      <div className="text-xs mt-1">{scoreToPar < 0 ? scoreToPar : `+${scoreToPar}`}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-xs text-center mt-2 text-gray-500">
              Last 5 rounds (relative to par)
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Playing Frequency */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col">
            <span className="text-sm text-gray-500 dark:text-gray-400">Playing Frequency</span>
            <div className="mt-2">
              <span className="text-2xl font-bold">
                {stats.roundsThisYear > 0 
                  ? (new Date().getMonth() + 1) / stats.roundsThisYear <= 1 
                    ? `${(stats.roundsThisYear / (new Date().getMonth() + 1)).toFixed(1)} rounds/month` 
                    : `${(30 / ((new Date().getMonth() + 1) / stats.roundsThisYear * 30)).toFixed(1)} days/round`
                  : 'N/A'
                }
              </span>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {stats.roundsThisYear} rounds in {new Date().getFullYear()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}