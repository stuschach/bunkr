import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Scorecard } from '@/types/scorecard';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, BarChart, Bar, Cell,
  TooltipProps
} from 'recharts';

interface ScoreAnalysisProps {
  rounds: Scorecard[];
}

// Define interfaces for the data structures
interface TrendDataPoint {
  date: string;
  score: number;
  par: number;
  scoreToPar: number;
  courseId: string | undefined;
  courseName: string;
}

interface DistributionDataPoint {
  scoreToPar: number;
  count: number;
  percentage: number;
}

interface ScoreDataResult {
  trend: TrendDataPoint[];
  distribution: DistributionDataPoint[];
  roundsWithStats: boolean;
  holeTypeScoring: {
    par3: number | null;
    par4: number | null;
    par5: number | null;
  };
}

export function ScoreAnalysis({ rounds }: ScoreAnalysisProps) {
  // Calculate score data
  const scoreData: ScoreDataResult = useMemo(() => {
    if (!rounds.length) return { 
      trend: [], 
      distribution: [], 
      roundsWithStats: false,
      holeTypeScoring: { par3: null, par4: null, par5: null }
    };
    
    // Sort rounds by date (oldest first for the chart)
    const sortedRounds = [...rounds].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Prepare data for score trend chart
    const trend: TrendDataPoint[] = sortedRounds.map(round => {
      const scoreToPar = round.totalScore - round.coursePar;
      return {
        date: new Date(round.date).toLocaleDateString(),
        score: round.totalScore,
        par: round.coursePar,
        scoreToPar: scoreToPar,
        courseId: round.courseId,
        courseName: round.courseName
      };
    });
    
    // Prepare data for score distribution chart
    // Count occurrences of each score relative to par
    const scoreDistribution: Record<number, number> = {};
    
    // Determine score range (typically -5 to +15 relative to par)
    const minScore = Math.min(...rounds.map(r => r.totalScore - r.coursePar));
    const maxScore = Math.max(...rounds.map(r => r.totalScore - r.coursePar));
    
    // Initialize all scores in range with zero
    for (let i = minScore; i <= maxScore; i++) {
      scoreDistribution[i] = 0;
    }
    
    // Count occurrences
    rounds.forEach(round => {
      const scoreToPar = round.totalScore - round.coursePar;
      scoreDistribution[scoreToPar] = (scoreDistribution[scoreToPar] || 0) + 1;
    });
    
    // Convert to array for chart
    const distribution: DistributionDataPoint[] = Object.entries(scoreDistribution).map(([scoreToPar, count]) => ({
      scoreToPar: parseInt(scoreToPar),
      count,
      percentage: (count / rounds.length) * 100
    })).sort((a, b) => a.scoreToPar - b.scoreToPar);
    
    // Check if we have detailed stats available for at least one round
    const roundsWithStats = rounds.some(r => 
      r.stats && (
        r.stats.fairwaysHit !== undefined || 
        r.stats.greensInRegulation !== undefined || 
        r.stats.totalPutts !== undefined
      )
    );
    
    // Generate scoring average by hole type
    const par3Scores: number[] = [];
    const par4Scores: number[] = [];
    const par5Scores: number[] = [];
    
    rounds.forEach(round => {
      if (!round.holes || round.holes.length === 0) return;
      
      round.holes.forEach(hole => {
        const scoreToPar = hole.score - hole.par;
        
        if (hole.par === 3) {
          par3Scores.push(scoreToPar);
        } else if (hole.par === 4) {
          par4Scores.push(scoreToPar);
        } else if (hole.par === 5) {
          par5Scores.push(scoreToPar);
        }
      });
    });
    
    const avgPar3 = par3Scores.length > 0 
      ? par3Scores.reduce((sum, score) => sum + score, 0) / par3Scores.length 
      : null;
    
    const avgPar4 = par4Scores.length > 0 
      ? par4Scores.reduce((sum, score) => sum + score, 0) / par4Scores.length 
      : null;
    
    const avgPar5 = par5Scores.length > 0 
      ? par5Scores.reduce((sum, score) => sum + score, 0) / par5Scores.length 
      : null;
    
    return { 
      trend, 
      distribution,
      roundsWithStats,
      holeTypeScoring: {
        par3: avgPar3,
        par4: avgPar4,
        par5: avgPar5
      }
    };
  }, [rounds]);
  
  // Get color for score to par
  const getScoreColor = (scoreToPar: number) => {
    if (scoreToPar <= -2) return "#22c55e"; // Double bogey or better (green-500)
    if (scoreToPar === -1) return "#4ade80"; // Birdie (green-400)
    if (scoreToPar === 0) return "#a3a3a3"; // Par (gray-400)
    if (scoreToPar === 1) return "#f97316"; // Bogey (orange-500)
    if (scoreToPar === 2) return "#ef4444"; // Double bogey (red-500)
    return "#b91c1c"; // Triple bogey or worse (red-700)
  };

  if (!rounds.length) return null;
  
  // Custom tooltip for the charts
  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-md">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.name === 'Score to Par' && entry.value !== undefined && (
                <span>
                  {Number(entry.value) <= 0 ? '' : ' over'} par
                </span>
              )}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Score Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Score Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={scoreData.trend}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    // Shorten the date format to save space
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis 
                  yAxisId="left"
                  orientation="left"
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  domain={[-5, 15]}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Strokes to Par', angle: -90, position: 'insideRight' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="score"
                  name="Total Score"
                  stroke="#3b82f6"
                  activeDot={{ r: 8 }}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="scoreToPar"
                  name="Score to Par"
                  stroke="#ef4444"
                  activeDot={{ r: 8 }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Chart shows your score progression over time. Downward trends indicate improvement.
          </div>
        </CardContent>
      </Card>
      
      {/* Score Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={scoreData.distribution}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="scoreToPar" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value === 0 ? 'E' : value > 0 ? `+${value}` : value}
                    label={{ value: 'Strokes Relative to Par', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'count' ? `${value} round${value !== 1 ? 's' : ''}` : `${Number(value).toFixed(1)}%`,
                      name === 'count' ? 'Frequency' : 'Percentage'
                    ]}
                    labelFormatter={(label) => `Score: ${label === 0 ? 'Even' : label > 0 ? `+${label}` : label}`}
                  />
                  <Bar dataKey="count" fill="#3b82f6">
                    {scoreData.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getScoreColor(entry.scoreToPar)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              This chart shows how frequently you shoot certain scores relative to par.
            </div>
          </CardContent>
        </Card>
        
        {/* Score by Hole Type */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Hole Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex flex-col justify-center">
              {scoreData.holeTypeScoring.par3 !== null && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Par 3s</span>
                    <div className="flex items-center">
                      <span className={`text-lg font-semibold ${
                        scoreData.holeTypeScoring.par3 <= 0 
                          ? 'text-green-500' 
                          : scoreData.holeTypeScoring.par3 <= 0.5 
                            ? 'text-yellow-500' 
                            : 'text-red-500'
                      }`}>
                        {scoreData.holeTypeScoring.par3 === 0 
                          ? 'Even' 
                          : scoreData.holeTypeScoring.par3 > 0 
                            ? `+${scoreData.holeTypeScoring.par3.toFixed(2)}` 
                            : scoreData.holeTypeScoring.par3.toFixed(2)}
                      </span>
                      <Badge 
                        variant={
                          scoreData.holeTypeScoring.par3 <= 0 
                            ? 'success' 
                            : scoreData.holeTypeScoring.par3 <= 0.5 
                              ? 'warning' 
                              : 'error'
                        }
                        className="ml-2"
                      >
                        {scoreData.holeTypeScoring.par3 <= 0 
                          ? 'Strong' 
                          : scoreData.holeTypeScoring.par3 <= 0.5 
                            ? 'Average' 
                            : 'Needs Work'}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
                    <div 
                      className={`h-full rounded-full ${
                        scoreData.holeTypeScoring.par3 <= 0 
                          ? 'bg-green-500' 
                          : scoreData.holeTypeScoring.par3 <= 0.5 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                      }`}
                      style={{ 
                        width: `${Math.max(0, 100 - (scoreData.holeTypeScoring.par3 + 1) * 20)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              )}
              
              {scoreData.holeTypeScoring.par4 !== null && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Par 4s</span>
                    <div className="flex items-center">
                      <span className={`text-lg font-semibold ${
                        scoreData.holeTypeScoring.par4 <= 0 
                          ? 'text-green-500' 
                          : scoreData.holeTypeScoring.par4 <= 0.7 
                            ? 'text-yellow-500' 
                            : 'text-red-500'
                      }`}>
                        {scoreData.holeTypeScoring.par4 === 0 
                          ? 'Even' 
                          : scoreData.holeTypeScoring.par4 > 0 
                            ? `+${scoreData.holeTypeScoring.par4.toFixed(2)}` 
                            : scoreData.holeTypeScoring.par4.toFixed(2)}
                      </span>
                      <Badge 
                        variant={
                          scoreData.holeTypeScoring.par4 <= 0 
                            ? 'success' 
                            : scoreData.holeTypeScoring.par4 <= 0.7 
                              ? 'warning' 
                              : 'error'
                        }
                        className="ml-2"
                      >
                        {scoreData.holeTypeScoring.par4 <= 0 
                          ? 'Strong' 
                          : scoreData.holeTypeScoring.par4 <= 0.7 
                            ? 'Average' 
                            : 'Needs Work'}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
                    <div 
                      className={`h-full rounded-full ${
                        scoreData.holeTypeScoring.par4 <= 0 
                          ? 'bg-green-500' 
                          : scoreData.holeTypeScoring.par4 <= 0.7 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                      }`}
                      style={{ 
                        width: `${Math.max(0, 100 - (scoreData.holeTypeScoring.par4 + 1) * 20)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              )}
              
              {scoreData.holeTypeScoring.par5 !== null && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Par 5s</span>
                    <div className="flex items-center">
                      <span className={`text-lg font-semibold ${
                        scoreData.holeTypeScoring.par5 <= 0 
                          ? 'text-green-500' 
                          : scoreData.holeTypeScoring.par5 <= 0.6 
                            ? 'text-yellow-500' 
                            : 'text-red-500'
                      }`}>
                        {scoreData.holeTypeScoring.par5 === 0 
                          ? 'Even' 
                          : scoreData.holeTypeScoring.par5 > 0 
                            ? `+${scoreData.holeTypeScoring.par5.toFixed(2)}` 
                            : scoreData.holeTypeScoring.par5.toFixed(2)}
                      </span>
                      <Badge 
                        variant={
                          scoreData.holeTypeScoring.par5 <= 0 
                            ? 'success' 
                            : scoreData.holeTypeScoring.par5 <= 0.6 
                              ? 'warning' 
                              : 'error'
                        }
                        className="ml-2"
                      >
                        {scoreData.holeTypeScoring.par5 <= 0 
                          ? 'Strong' 
                          : scoreData.holeTypeScoring.par5 <= 0.6 
                            ? 'Average' 
                            : 'Needs Work'}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
                    <div 
                      className={`h-full rounded-full ${
                        scoreData.holeTypeScoring.par5 <= 0 
                          ? 'bg-green-500' 
                          : scoreData.holeTypeScoring.par5 <= 0.6 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                      }`}
                      style={{ 
                        width: `${Math.max(0, 100 - (scoreData.holeTypeScoring.par5 + 1) * 20)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Average scores relative to par on different hole types. Lower numbers are better.
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Scoring Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Scoring Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Score Types Distribution */}
            <div className="space-y-4">
              <h4 className="font-medium">Score Types</h4>
              
              {/* Calculate distribution of eagles, birdies, pars, etc. */}
              {(() => {
                // Get all hole scores from all rounds
                const allHoleScores = rounds.flatMap(round => 
                  round.holes.map(hole => ({
                    score: hole.score,
                    par: hole.par,
                    scoreToPar: hole.score - hole.par
                  }))
                );
                
                // Count different score types
                const eagles = allHoleScores.filter(h => h.scoreToPar <= -2).length;
                const birdies = allHoleScores.filter(h => h.scoreToPar === -1).length;
                const pars = allHoleScores.filter(h => h.scoreToPar === 0).length;
                const bogeys = allHoleScores.filter(h => h.scoreToPar === 1).length;
                const doubleBogeys = allHoleScores.filter(h => h.scoreToPar === 2).length;
                const triplePlus = allHoleScores.filter(h => h.scoreToPar >= 3).length;
                
                const total = allHoleScores.length;
                
                // Calculate percentages
                const eaglesPct = (eagles / total) * 100;
                const birdiesPct = (birdies / total) * 100;
                const parsPct = (pars / total) * 100;
                const bogeysPct = (bogeys / total) * 100;
                const doubleBogeysPct = (doubleBogeys / total) * 100;
                const triplePlusPct = (triplePlus / total) * 100;
                
                return (
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Eagles or Better</span>
                        <span>{eagles} ({eaglesPct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
                        <div 
                          className="h-full rounded-full bg-green-600"
                          style={{ width: `${eaglesPct}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Birdies</span>
                        <span>{birdies} ({birdiesPct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
                        <div 
                          className="h-full rounded-full bg-green-500"
                          style={{ width: `${birdiesPct}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Pars</span>
                        <span>{pars} ({parsPct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
                        <div 
                          className="h-full rounded-full bg-gray-500"
                          style={{ width: `${parsPct}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Bogeys</span>
                        <span>{bogeys} ({bogeysPct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
                        <div 
                          className="h-full rounded-full bg-yellow-500"
                          style={{ width: `${bogeysPct}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Double Bogeys</span>
                        <span>{doubleBogeys} ({doubleBogeysPct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
                        <div 
                          className="h-full rounded-full bg-red-500"
                          style={{ width: `${doubleBogeysPct}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Triple+ Bogeys</span>
                        <span>{triplePlus} ({triplePlusPct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
                        <div 
                          className="h-full rounded-full bg-red-700"
                          style={{ width: `${triplePlusPct}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Nine Hole Analysis */}
            <div className="space-y-4">
              <h4 className="font-medium">Nine Hole Analysis</h4>
              
              {(() => {
                // Calculate front 9 vs back 9 scoring
                const roundsWithAllHoles = rounds.filter(r => r.holes.length === 18);
                
                if (roundsWithAllHoles.length === 0) {
                  return <p className="text-sm text-gray-500">Not enough data for nine hole analysis</p>;
                }
                
                const frontNineScores = roundsWithAllHoles.map(round => {
                  const frontNine = round.holes.slice(0, 9);
                  const score = frontNine.reduce((sum, hole) => sum + hole.score, 0);
                  const par = frontNine.reduce((sum, hole) => sum + hole.par, 0);
                  return { score, par, scoreToPar: score - par };
                });
                
                const backNineScores = roundsWithAllHoles.map(round => {
                  const backNine = round.holes.slice(9, 18);
                  const score = backNine.reduce((sum, hole) => sum + hole.score, 0);
                  const par = backNine.reduce((sum, hole) => sum + hole.par, 0);
                  return { score, par, scoreToPar: score - par };
                });
                
                const avgFrontNine = frontNineScores.reduce((sum, s) => sum + s.score, 0) / frontNineScores.length;
                const avgBackNine = backNineScores.reduce((sum, s) => sum + s.score, 0) / backNineScores.length;
                
                const avgFrontNineToPar = frontNineScores.reduce((sum, s) => sum + s.scoreToPar, 0) / frontNineScores.length;
                const avgBackNineToPar = backNineScores.reduce((sum, s) => sum + s.scoreToPar, 0) / backNineScores.length;
                
                // Calculate which is better on average
                const difference = avgFrontNineToPar - avgBackNineToPar;
                const betterNine = difference < -0.5 ? "Front" : difference > 0.5 ? "Back" : "Equal";
                
                return (
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">Front Nine</span>
                        <span className={`font-medium ${avgFrontNineToPar <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {avgFrontNine.toFixed(1)} ({avgFrontNineToPar > 0 ? '+' : ''}{avgFrontNineToPar.toFixed(1)})
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Average score on the front nine (relative to par)
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">Back Nine</span>
                        <span className={`font-medium ${avgBackNineToPar <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {avgBackNine.toFixed(1)} ({avgBackNineToPar > 0 ? '+' : ''}{avgBackNineToPar.toFixed(1)})
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Average score on the back nine (relative to par)
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <Badge 
                        variant={betterNine === "Equal" ? "secondary" : "success"}
                        className="text-sm"
                      >
                        {betterNine === "Equal" 
                          ? "Consistent play on both nines" 
                          : `${betterNine} nine is your stronger nine`}
                      </Badge>
                      
                      {betterNine !== "Equal" && (
                        <div className="mt-2 text-xs text-gray-500">
                          You average {Math.abs(difference).toFixed(1)} strokes 
                          {difference < 0 ? " better on the front nine" : " better on the back nine"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Consistency Analysis */}
            <div className="space-y-4">
              <h4 className="font-medium">Consistency Analysis</h4>
              
              {(() => {
                // Need at least 3 rounds for consistency analysis
                if (rounds.length < 3) {
                  return <p className="text-sm text-gray-500">Need at least 3 rounds for consistency analysis</p>;
                }
                
                // Calculate consistency metrics
                const scoreToParValues = rounds.map(r => r.totalScore - r.coursePar);
                
                // Standard deviation of scores to par
                const mean = scoreToParValues.reduce((sum, val) => sum + val, 0) / scoreToParValues.length;
                const squaredDiffs = scoreToParValues.map(val => Math.pow(val - mean, 2));
                const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / scoreToParValues.length;
                const stdDev = Math.sqrt(variance);
                
                // Range (highest minus lowest)
                const max = Math.max(...scoreToParValues);
                const min = Math.min(...scoreToParValues);
                const range = max - min;
                
                // Consistency rating
                let consistencyRating;
                if (stdDev < 2) {
                  consistencyRating = "Very Consistent";
                } else if (stdDev < 3.5) {
                  consistencyRating = "Consistent";
                } else if (stdDev < 5) {
                  consistencyRating = "Somewhat Inconsistent";
                } else {
                  consistencyRating = "Inconsistent";
                }
                
                // Rating color
                const ratingColor = 
                  stdDev < 2 ? "text-green-500" :
                  stdDev < 3.5 ? "text-green-400" :
                  stdDev < 5 ? "text-yellow-500" :
                  "text-red-500";
                
                return (
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">Variability</span>
                        <span className="font-medium">{stdDev.toFixed(1)} strokes</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Standard deviation of your scores (lower is more consistent)
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">Score Range</span>
                        <span className="font-medium">{range} strokes</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Difference between your highest and lowest scores
                      </div>
                    </div>
                    
                    <div className="pt-4 text-center">
                      <div className={`text-lg font-bold ${ratingColor}`}>
                        {consistencyRating}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {stdDev < 3.5 
                          ? "Your scores are relatively predictable" 
                          : "You have significant variance in your scores"}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}