import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Scorecard } from '@/types/scorecard';
import { formatHandicapIndex } from '@/lib/utils/formatting';
import { calculateHandicapIndex } from '@/lib/handicap/calculator';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, AreaChart, Area,
  TooltipProps
} from 'recharts';

interface HandicapAnalysisProps {
  rounds: Scorecard[];
  userHandicapIndex?: number | null; // New prop to get handicap from Firebase user document
}

// Define interfaces for data structures
interface HandicapHistoryPoint {
  date: string;
  handicap: number | null;
  roundCount: number;
}

interface HandicapDataResult {
  history: HandicapHistoryPoint[];
  current: number | null;
  potential: number | null;
  countingRounds: Scorecard[];
}

export function HandicapAnalysis({ rounds, userHandicapIndex }: HandicapAnalysisProps) {
  const [targetHandicap, setTargetHandicap] = useState<number | null>(null);
  
  // Calculate handicap history
  const handicapData: HandicapDataResult = useMemo(() => {
    if (!rounds.length) return { history: [], current: null, potential: null, countingRounds: [] };
    
    // Sort rounds by date (oldest first for the chart)
    const sortedRounds = [...rounds].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Initialize arrays for handicap history
    const handicapHistory: HandicapHistoryPoint[] = [];
    
    // Calculate handicap for each point in time
    sortedRounds.forEach((round, index) => {
      // Get all rounds up to and including this one
      const roundsUpToNow = sortedRounds.slice(0, index + 1);
      
      // Need at least 3 rounds to calculate handicap
      if (roundsUpToNow.length >= 3) {
        const handicapIndex = calculateHandicapIndex(roundsUpToNow);
        
        handicapHistory.push({
          date: round.date,
          handicap: handicapIndex,
          roundCount: roundsUpToNow.length
        });
      } else {
        handicapHistory.push({
          date: round.date,
          handicap: null,
          roundCount: roundsUpToNow.length
        });
      }
    });
    
    // Use the handicap from the user profile (from Firebase) if provided,
    // otherwise calculate from rounds as a fallback
    const currentHandicap = userHandicapIndex !== undefined ? userHandicapIndex : 
                            handicapHistory.length > 0 && handicapHistory[handicapHistory.length - 1].handicap !== null ?
                            handicapHistory[handicapHistory.length - 1].handicap : null;
    
    // Calculate potential handicap (what would happen if you shot a really good score)
    let potentialHandicap = null;
    if (currentHandicap !== null && rounds.length >= 3) {
      // Create a copy of the rounds
      const roundsCopy = [...sortedRounds];
      
      // Add a hypothetical excellent round (5 under your current handicap)
      const lastRound = roundsCopy[roundsCopy.length - 1];
      const goodScore = Math.max(lastRound.coursePar + Math.floor(currentHandicap) - 5, lastRound.coursePar - 3);
      
      const hypotheticalRound: Scorecard = {
        ...lastRound,
        id: 'hypothetical',
        date: new Date().toISOString().split('T')[0],
        totalScore: goodScore
      };
      
      roundsCopy.push(hypotheticalRound);
      
      // Calculate new potential handicap
      potentialHandicap = calculateHandicapIndex(roundsCopy);
    }
    
    // Calculate the rounds that count toward the current handicap
    let countingRounds: Scorecard[] = [];
    if (sortedRounds.length >= 3) {
      // Calculate how many of the most recent rounds are used
      const recentRounds = sortedRounds.slice(-20); // Take at most the last 20 rounds
      
      // Get the number of differentials to use based on the total rounds
      const countToUse = 
        recentRounds.length <= 3 ? 1 :
        recentRounds.length <= 4 ? 1 :
        recentRounds.length <= 5 ? 1 :
        recentRounds.length <= 6 ? 2 :
        recentRounds.length <= 8 ? 2 :
        recentRounds.length <= 9 ? 3 :
        recentRounds.length <= 11 ? 3 :
        recentRounds.length <= 12 ? 4 :
        recentRounds.length <= 14 ? 4 :
        recentRounds.length <= 15 ? 5 :
        recentRounds.length <= 16 ? 5 :
        recentRounds.length <= 17 ? 6 :
        recentRounds.length <= 18 ? 6 :
        recentRounds.length <= 19 ? 7 : 8;
      
      // Calculate score differentials for each round
      type RoundWithDifferential = Scorecard & { differential: number | null };
      
      const roundsWithDifferential = recentRounds.map(round => {
        const differential = round.teeBox?.rating && round.teeBox?.slope
          ? ((round.totalScore - round.teeBox.rating) * 113) / round.teeBox.slope
          : null;
        
        return {
          ...round,
          differential
        } as RoundWithDifferential;
      });
      
      // Sort rounds by differential (lowest first)
      const sortedByDifferential = [...roundsWithDifferential]
        .filter(r => r.differential !== null)
        .sort((a, b) => (a.differential || 0) - (b.differential || 0));
      
      // Take the best N differentials
      countingRounds = sortedByDifferential.slice(0, countToUse);
    }
    
    return { 
      history: handicapHistory, 
      current: currentHandicap,
      potential: potentialHandicap,
      countingRounds
    };
  }, [rounds, userHandicapIndex]); // Add userHandicapIndex to dependency array

  // Set target handicap based on current if not already set
  React.useEffect(() => {
    if (handicapData.current !== null && targetHandicap === null) {
      // Set target to 2 strokes better than current handicap, rounded down
      setTargetHandicap(Math.floor(handicapData.current - 2));
    }
  }, [handicapData.current, targetHandicap]);

  if (!rounds.length) return null;
  
  // Format date for chart display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().substr(2, 2)}`;
  };

  // Custom tooltip for handicap chart
  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length && payload[0].payload.handicap !== null) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-md">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm">
            Handicap: {formatHandicapIndex(payload[0].payload.handicap as number)}
          </p>
          <p className="text-xs text-gray-500">
            After {payload[0].payload.roundCount} rounds
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Handicap Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Handicap Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={handicapData.history.map(point => ({
                  ...point,
                  date: formatDate(point.date),
                  // invert handicap for the chart (so lower handicaps appear higher)
                  displayHandicap: point.handicap !== null ? 30 - point.handicap : null,
                }))}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={[0, 30]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => (30 - value).toFixed(1)}
                  reversed
                  label={{ 
                    value: 'Handicap Index', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' } 
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="handicap"
                  name="Handicap Index"
                  stroke="#22c55e"
                  activeDot={{ r: 8 }}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
                {targetHandicap !== null && (
                  <Line
                    type="monotone"
                    dataKey={() => targetHandicap}
                    name="Target Handicap"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Chart shows your handicap index progression over time. Downward trend indicates improvement.
          </div>
        </CardContent>
      </Card>
      
      {/* Current Handicap Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Handicap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="text-5xl font-bold text-green-500 mb-2">
                {handicapData.current !== null 
                  ? formatHandicapIndex(handicapData.current) 
                  : 'N/A'}
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {handicapData.current !== null
                  ? `Based on your last ${Math.min(rounds.length, 20)} rounds`
                  : 'Need more rounds to calculate (minimum 3)'}
              </p>
              
              {handicapData.current !== null && rounds.length >= 5 && (
                <div className="mt-4">
                  <Badge 
                    variant={
                      handicapData.history.length >= 3 &&
                      handicapData.history[handicapData.history.length - 1].handicap !== null &&
                      handicapData.history[handicapData.history.length - 3].handicap !== null &&
                      (handicapData.history[handicapData.history.length - 1].handicap as number) <
                      (handicapData.history[handicapData.history.length - 3].handicap as number)
                        ? 'success'
                        : 'outline'
                    }
                  >
                    {handicapData.history.length >= 3 &&
                     handicapData.history[handicapData.history.length - 1].handicap !== null &&
                     handicapData.history[handicapData.history.length - 3].handicap !== null
                      ? (handicapData.history[handicapData.history.length - 1].handicap as number) <
                        (handicapData.history[handicapData.history.length - 3].handicap as number)
                        ? 'Improving'
                        : 'Stable'
                      : 'Tracking Progress'
                    }
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Rounds Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Handicap Calculation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm mb-4">
              Your handicap is based on the best{' '}
              <span className="font-medium">{handicapData.countingRounds.length}</span> of your last{' '}
              <span className="font-medium">{Math.min(rounds.length, 20)}</span> rounds.
            </div>
            
            {handicapData.countingRounds.length > 0 ? (
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {handicapData.countingRounds.map((round, index) => {
                  const differential = round.differential !== undefined 
                    ? round.differential 
                    : round.teeBox?.rating && round.teeBox?.slope
                      ? ((round.totalScore - round.teeBox.rating) * 113) / round.teeBox.slope
                      : null;
                      
                  return (
                    <div key={index} className="flex justify-between items-center text-sm border-b pb-2 border-gray-100 dark:border-gray-800">
                      <div>
                        <div>{round.courseName}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(round.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="font-medium">
                        {differential !== null 
                          ? typeof differential === 'number' 
                            ? differential.toFixed(1) 
                            : differential 
                          : 'N/A'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-gray-500 dark:text-gray-400 text-sm italic">
                Need at least 3 rounds to calculate
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Potential Improvement */}
        <Card>
          <CardHeader>
            <CardTitle>Improvement Potential</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-4">
              {handicapData.current !== null && handicapData.potential !== null ? (
                <>
                  <div className="text-center mb-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      With one great round, your handicap could be:
                    </div>
                    <div className="text-3xl font-bold text-green-500">
                      {formatHandicapIndex(handicapData.potential)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      ({(handicapData.current - handicapData.potential).toFixed(1)} strokes improvement)
                    </div>
                  </div>
                  
                  {targetHandicap !== null && (
                    <div className="mt-6">
                      <div className="text-sm font-medium mb-2">Progress to Target ({formatHandicapIndex(targetHandicap)})</div>
                      <div className="relative pt-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold inline-block text-green-600">
                              {Math.min(100, Math.max(0, Math.round((1 - (handicapData.current - targetHandicap) / (handicapData.current)) * 100))).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="overflow-hidden h-2 mb-1 text-xs flex rounded bg-gray-200 dark:bg-gray-700">
                          <div 
                            style={{ 
                              width: `${Math.min(100, Math.max(0, Math.round((1 - (handicapData.current - targetHandicap) / (handicapData.current)) * 100)))}%`
                            }} 
                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                          ></div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {handicapData.current > targetHandicap 
                          ? `Need to drop ${(handicapData.current - targetHandicap).toFixed(1)} more strokes`
                          : 'Congratulations! You\'ve reached your target handicap'}
                      </div>
                      
                      <div className="mt-4 text-sm">
                        <span className="font-medium">Target Handicap: </span>
                        <input
                          type="number"
                          value={targetHandicap}
                          onChange={(e) => setTargetHandicap(Number(e.target.value))}
                          className="w-16 p-1 border border-gray-300 dark:border-gray-700 rounded ml-2 text-center"
                          min="0"
                          max={handicapData.current !== null ? Math.floor(handicapData.current) : 30}
                          step="0.1"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-center">
                  Need more rounds to calculate potential improvement
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Course Handicaps */}
      <Card>
        <CardHeader>
          <CardTitle>Course Handicaps</CardTitle>
        </CardHeader>
        <CardContent>
          {handicapData.current !== null ? (
            <div>
              <p className="text-sm mb-4">
                Your handicap index of {formatHandicapIndex(handicapData.current)} translates to these course handicaps:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Get unique courses from rounds */}
                {Array.from(new Set(rounds.map(r => r.courseName))).map((courseName, i) => {
                  // Find a round at this course to get the tee information
                  const courseRound = rounds.find(r => r.courseName === courseName);
                  
                  if (!courseRound || !courseRound.teeBox) return null;
                  
                  // Calculate course handicap
                  const courseHandicap = Math.round(
                    handicapData.current * (courseRound.teeBox.slope / 113) + 
                    (courseRound.teeBox.rating - courseRound.coursePar)
                  );
                  
                  return (
                    <div key={i} className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                      <div className="font-medium">{courseName}</div>
                      <div className="text-sm text-gray-500">{courseRound.teeBox.name} tees</div>
                      <div className="mt-2 text-xl font-bold text-green-500">{courseHandicap}</div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                These course handicaps are calculated based on the slope rating and course rating for each course and tee box.
              </div>
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-center py-4">
              Need at least 3 rounds to calculate course handicaps
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Handicap Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Handicap Movement Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[
                  ...handicapData.history
                    .filter(h => h.handicap !== null)
                    .map((h, index) => ({
                      index,
                      date: formatDate(h.date),
                      handicap: h.handicap,
                    }))
                ]}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis 
                  domain={['dataMin - 1', 'dataMax + 1']} 
                  label={{ value: 'Handicap Index', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any) => [formatHandicapIndex(value), 'Handicap Index']}
                />
                <Area 
                  type="monotone" 
                  dataKey="handicap" 
                  stroke="#4ade80" 
                  fill="#4ade80" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            This chart shows how your handicap index has moved over time. The shaded area helps visualize your improvement journey.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}