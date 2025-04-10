import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Scorecard } from '@/types/scorecard';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { 
  PieChart, Pie, Cell, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

interface HoleTypeAnalysisProps {
  rounds: Scorecard[];
}

interface HolePerformance {
  holeNumber: number;
  par: number;
  averageScore: number;
  averageScoreToPar: number;
  totalHoles: number;
  // Stats
  fairwayHits?: number;
  fairwayAttempts?: number;
  girHits?: number;
  girAttempts?: number;
  averagePutts?: number;
  totalPutts?: number;
  // Scores
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  worseThanDouble: number;
}

export function HoleTypeAnalysis({ rounds }: HoleTypeAnalysisProps) {
  // Calculate stats by hole type
  const holeTypeData = useMemo(() => {
    if (!rounds.length) return { par3: [], par4: [], par5: [], holePerformance: [] };
    
    // Collect data for all holes
    const holeData: Record<number, HolePerformance> = {};
    
    // Process all rounds and holes
    rounds.forEach(round => {
      round.holes.forEach((hole, index) => {
        const holeNumber = index + 1;
        
        if (!holeData[holeNumber]) {
          holeData[holeNumber] = {
            holeNumber,
            par: hole.par,
            averageScore: 0,
            averageScoreToPar: 0,
            totalHoles: 0,
            fairwayHits: 0,
            fairwayAttempts: 0,
            girHits: 0,
            girAttempts: 0,
            totalPutts: 0,
            eagles: 0,
            birdies: 0,
            pars: 0,
            bogeys: 0,
            doubleBogeys: 0,
            worseThanDouble: 0
          };
        }
        
        // Update hole data
        holeData[holeNumber].totalHoles++;
        holeData[holeNumber].averageScore += hole.score;
        holeData[holeNumber].averageScoreToPar += (hole.score - hole.par);
        
        // Update fairway stats (only for par 4s and 5s)
        if (hole.par >= 4) {
          holeData[holeNumber].fairwayAttempts = (holeData[holeNumber].fairwayAttempts || 0) + 1;
          if (hole.fairwayHit) {
            holeData[holeNumber].fairwayHits = (holeData[holeNumber].fairwayHits || 0) + 1;
          }
        }
        
        // Update GIR stats
        holeData[holeNumber].girAttempts = (holeData[holeNumber].girAttempts || 0) + 1;
        if (hole.greenInRegulation) {
          holeData[holeNumber].girHits = (holeData[holeNumber].girHits || 0) + 1;
        }
        
        // Update putting stats
        if (hole.putts) {
          holeData[holeNumber].totalPutts = (holeData[holeNumber].totalPutts || 0) + hole.putts;
        }
        
        // Update score type counts
        const scoreToPar = hole.score - hole.par;
        if (scoreToPar <= -2) {
          holeData[holeNumber].eagles++;
        } else if (scoreToPar === -1) {
          holeData[holeNumber].birdies++;
        } else if (scoreToPar === 0) {
          holeData[holeNumber].pars++;
        } else if (scoreToPar === 1) {
          holeData[holeNumber].bogeys++;
        } else if (scoreToPar === 2) {
          holeData[holeNumber].doubleBogeys++;
        } else {
          holeData[holeNumber].worseThanDouble++;
        }
      });
    });
    
    // Calculate averages
    Object.values(holeData).forEach(hole => {
      hole.averageScore = hole.averageScore / hole.totalHoles;
      hole.averageScoreToPar = hole.averageScoreToPar / hole.totalHoles;
      
      if (hole.totalPutts && hole.totalHoles) {
        hole.averagePutts = hole.totalPutts / hole.totalHoles;
      }
    });
    
    // Separate by hole type
    const par3Holes = Object.values(holeData).filter(h => h.par === 3);
    const par4Holes = Object.values(holeData).filter(h => h.par === 4);
    const par5Holes = Object.values(holeData).filter(h => h.par === 5);
    
    // Calculate aggregate stats by par
    const calculateAggregateStats = (holes: HolePerformance[]) => {
      if (!holes.length) return null;
      
      const totalHoles = holes.reduce((sum, h) => sum + h.totalHoles, 0);
      const totalScore = holes.reduce((sum, h) => sum + (h.averageScore * h.totalHoles), 0);
      const totalScoreToPar = holes.reduce((sum, h) => sum + (h.averageScoreToPar * h.totalHoles), 0);
      const totalFairwayHits = holes.reduce((sum, h) => sum + (h.fairwayHits || 0), 0);
      const totalFairwayAttempts = holes.reduce((sum, h) => sum + (h.fairwayAttempts || 0), 0);
      const totalGirHits = holes.reduce((sum, h) => sum + (h.girHits || 0), 0);
      const totalGirAttempts = holes.reduce((sum, h) => sum + (h.girAttempts || 0), 0);
      const totalPutts = holes.reduce((sum, h) => sum + (h.totalPutts || 0), 0);
      
      // Score distributions
      const eagles = holes.reduce((sum, h) => sum + h.eagles, 0);
      const birdies = holes.reduce((sum, h) => sum + h.birdies, 0);
      const pars = holes.reduce((sum, h) => sum + h.pars, 0);
      const bogeys = holes.reduce((sum, h) => sum + h.bogeys, 0);
      const doubleBogeys = holes.reduce((sum, h) => sum + h.doubleBogeys, 0);
      const worseThanDouble = holes.reduce((sum, h) => sum + h.worseThanDouble, 0);
      
      return {
        averageScore: totalScore / totalHoles,
        averageScoreToPar: totalScoreToPar / totalHoles,
        fairwayPercentage: totalFairwayAttempts > 0 ? (totalFairwayHits / totalFairwayAttempts) * 100 : null,
        girPercentage: totalGirAttempts > 0 ? (totalGirHits / totalGirAttempts) * 100 : 0,
        averagePutts: totalHoles > 0 ? totalPutts / totalHoles : 0,
        scoreDistribution: {
          eagles: eagles,
          birdies: birdies,
          pars: pars,
          bogeys: bogeys,
          doubleBogeys: doubleBogeys,
          worseThanDouble: worseThanDouble,
          total: eagles + birdies + pars + bogeys + doubleBogeys + worseThanDouble
        }
      };
    };
    
    const par3Stats = calculateAggregateStats(par3Holes);
    const par4Stats = calculateAggregateStats(par4Holes);
    const par5Stats = calculateAggregateStats(par5Holes);
    
    return { 
      par3: par3Holes, 
      par4: par4Holes, 
      par5: par5Holes,
      par3Stats,
      par4Stats,
      par5Stats,
      holePerformance: Object.values(holeData)
    };
  }, [rounds]);

  if (!rounds.length) return null;
  
  // Colors for the pie charts
  const COLORS = ['#22c55e', '#4ade80', '#a3a3a3', '#f97316', '#ef4444', '#b91c1c'];
  
  // Color scheme for score relative to par
  const getScoreColor = (scoreToPar: number) => {
    if (scoreToPar <= -1.5) return "#22c55e"; // Eagle or better (green-600)
    if (scoreToPar <= -0.5) return "#4ade80"; // Birdie (green-400)
    if (scoreToPar <= 0.5) return "#a3a3a3"; // Par (gray-400)
    if (scoreToPar <= 1.5) return "#f97316"; // Bogey (orange-500)
    if (scoreToPar <= 2.5) return "#ef4444"; // Double bogey (red-500)
    return "#b91c1c"; // Triple bogey or worse (red-700)
  };

  return (
    <div className="space-y-6">
      {/* Par Type Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Par 3 Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Par 3s</span>
              {holeTypeData.par3Stats && (
                <Badge 
                  variant={
                    holeTypeData.par3Stats.averageScoreToPar <= 0 
                      ? 'success' 
                      : holeTypeData.par3Stats.averageScoreToPar < 0.7 
                        ? 'warning' 
                        : 'error'
                  }
                >
                  {holeTypeData.par3Stats.averageScoreToPar <= 0 
                    ? 'Strong' 
                    : holeTypeData.par3Stats.averageScoreToPar < 0.7 
                      ? 'Average' 
                      : 'Weak'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {holeTypeData.par3Stats ? (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">
                    {holeTypeData.par3Stats.averageScore.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Avg. Score • {holeTypeData.par3Stats.averageScoreToPar > 0 ? '+' : ''}
                    {holeTypeData.par3Stats.averageScoreToPar.toFixed(2)} to par
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-xl font-bold mb-1">
                      {holeTypeData.par3Stats.girPercentage.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      Greens in Regulation
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xl font-bold mb-1">
                      {holeTypeData.par3Stats.averagePutts.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Putts per Hole
                    </div>
                  </div>
                </div>
                
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Eagles', value: holeTypeData.par3Stats.scoreDistribution.eagles },
                          { name: 'Birdies', value: holeTypeData.par3Stats.scoreDistribution.birdies },
                          { name: 'Pars', value: holeTypeData.par3Stats.scoreDistribution.pars },
                          { name: 'Bogeys', value: holeTypeData.par3Stats.scoreDistribution.bogeys },
                          { name: 'Doubles', value: holeTypeData.par3Stats.scoreDistribution.doubleBogeys },
                          { name: 'Triple+', value: holeTypeData.par3Stats.scoreDistribution.worseThanDouble },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={1}
                        dataKey="value"
                      >
                        {[
                          { name: 'Eagles', value: holeTypeData.par3Stats.scoreDistribution.eagles },
                          { name: 'Birdies', value: holeTypeData.par3Stats.scoreDistribution.birdies },
                          { name: 'Pars', value: holeTypeData.par3Stats.scoreDistribution.pars },
                          { name: 'Bogeys', value: holeTypeData.par3Stats.scoreDistribution.bogeys },
                          { name: 'Doubles', value: holeTypeData.par3Stats.scoreDistribution.doubleBogeys },
                          { name: 'Triple+', value: holeTypeData.par3Stats.scoreDistribution.worseThanDouble },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No par 3 data available
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Par 4 Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Par 4s</span>
              {holeTypeData.par4Stats && (
                <Badge 
                  variant={
                    holeTypeData.par4Stats.averageScoreToPar <= 0.2 
                      ? 'success' 
                      : holeTypeData.par4Stats.averageScoreToPar < 0.9 
                        ? 'warning' 
                        : 'error'
                  }
                >
                  {holeTypeData.par4Stats.averageScoreToPar <= 0.2 
                    ? 'Strong' 
                    : holeTypeData.par4Stats.averageScoreToPar < 0.9 
                      ? 'Average' 
                      : 'Weak'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {holeTypeData.par4Stats ? (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">
                    {holeTypeData.par4Stats.averageScore.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Avg. Score • {holeTypeData.par4Stats.averageScoreToPar > 0 ? '+' : ''}
                    {holeTypeData.par4Stats.averageScoreToPar.toFixed(2)} to par
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-xl font-bold mb-1">
                      {holeTypeData.par4Stats.fairwayPercentage?.toFixed(1) || '0.0'}%
                    </div>
                    <div className="text-xs text-gray-500">
                      Fairways Hit
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xl font-bold mb-1">
                      {holeTypeData.par4Stats.girPercentage.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      Greens in Regulation
                    </div>
                  </div>
                </div>
                
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Eagles', value: holeTypeData.par4Stats.scoreDistribution.eagles },
                          { name: 'Birdies', value: holeTypeData.par4Stats.scoreDistribution.birdies },
                          { name: 'Pars', value: holeTypeData.par4Stats.scoreDistribution.pars },
                          { name: 'Bogeys', value: holeTypeData.par4Stats.scoreDistribution.bogeys },
                          { name: 'Doubles', value: holeTypeData.par4Stats.scoreDistribution.doubleBogeys },
                          { name: 'Triple+', value: holeTypeData.par4Stats.scoreDistribution.worseThanDouble },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={1}
                        dataKey="value"
                      >
                        {[
                          { name: 'Eagles', value: holeTypeData.par4Stats.scoreDistribution.eagles },
                          { name: 'Birdies', value: holeTypeData.par4Stats.scoreDistribution.birdies },
                          { name: 'Pars', value: holeTypeData.par4Stats.scoreDistribution.pars },
                          { name: 'Bogeys', value: holeTypeData.par4Stats.scoreDistribution.bogeys },
                          { name: 'Doubles', value: holeTypeData.par4Stats.scoreDistribution.doubleBogeys },
                          { name: 'Triple+', value: holeTypeData.par4Stats.scoreDistribution.worseThanDouble },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No par 4 data available
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Par 5 Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Par 5s</span>
              {holeTypeData.par5Stats && (
                <Badge 
                  variant={
                    holeTypeData.par5Stats.averageScoreToPar <= 0.2 
                      ? 'success' 
                      : holeTypeData.par5Stats.averageScoreToPar < 0.9 
                        ? 'warning' 
                        : 'error'
                  }
                >
                  {holeTypeData.par5Stats.averageScoreToPar <= 0.2 
                    ? 'Strong' 
                    : holeTypeData.par5Stats.averageScoreToPar < 0.9 
                      ? 'Average' 
                      : 'Weak'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {holeTypeData.par5Stats ? (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">
                    {holeTypeData.par5Stats.averageScore.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Avg. Score • {holeTypeData.par5Stats.averageScoreToPar > 0 ? '+' : ''}
                    {holeTypeData.par5Stats.averageScoreToPar.toFixed(2)} to par
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-xl font-bold mb-1">
                      {holeTypeData.par5Stats.fairwayPercentage?.toFixed(1) || '0.0'}%
                    </div>
                    <div className="text-xs text-gray-500">
                      Fairways Hit
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xl font-bold mb-1">
                      {holeTypeData.par5Stats.girPercentage.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      Greens in Regulation
                    </div>
                  </div>
                </div>
                
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Eagles', value: holeTypeData.par5Stats.scoreDistribution.eagles },
                          { name: 'Birdies', value: holeTypeData.par5Stats.scoreDistribution.birdies },
                          { name: 'Pars', value: holeTypeData.par5Stats.scoreDistribution.pars },
                          { name: 'Bogeys', value: holeTypeData.par5Stats.scoreDistribution.bogeys },
                          { name: 'Doubles', value: holeTypeData.par5Stats.scoreDistribution.doubleBogeys },
                          { name: 'Triple+', value: holeTypeData.par5Stats.scoreDistribution.worseThanDouble },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={1}
                        dataKey="value"
                      >
                        {[
                          { name: 'Eagles', value: holeTypeData.par5Stats.scoreDistribution.eagles },
                          { name: 'Birdies', value: holeTypeData.par5Stats.scoreDistribution.birdies },
                          { name: 'Pars', value: holeTypeData.par5Stats.scoreDistribution.pars },
                          { name: 'Bogeys', value: holeTypeData.par5Stats.scoreDistribution.bogeys },
                          { name: 'Doubles', value: holeTypeData.par5Stats.scoreDistribution.doubleBogeys },
                          { name: 'Triple+', value: holeTypeData.par5Stats.scoreDistribution.worseThanDouble },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No par 5 data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Individual Hole Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Hole-by-Hole Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={holeTypeData.holePerformance.map(hole => ({
                  holeNumber: hole.holeNumber,
                  par: hole.par,
                  scoreToPar: hole.averageScoreToPar,
                  holeType: `Par ${hole.par}`,
                  exactScore: hole.averageScore,
                  fairwayPercentage: hole.fairwayAttempts && hole.fairwayAttempts > 0 
                    ? (hole.fairwayHits! / hole.fairwayAttempts) * 100 
                    : null,
                  girPercentage: hole.girAttempts && hole.girAttempts > 0 
                    ? (hole.girHits! / hole.girAttempts) * 100 
                    : 0,
                  averagePutts: hole.totalPutts && hole.totalHoles 
                    ? hole.totalPutts / hole.totalHoles 
                    : 0,
                }))}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="holeNumber" 
                  tickFormatter={(value) => `${value}`} 
                  label={{ value: 'Hole', position: 'insideBottom', offset: -5 }} 
                />
                <YAxis
                  label={{ value: 'Strokes Over/Under Par', angle: -90, position: 'insideLeft' }}
                  domain={[-1, 'auto']}
                  tickFormatter={(value) => value === 0 ? 'E' : value > 0 ? `+${value}` : value}
                />
                <Bar 
                  dataKey="scoreToPar" 
                  name="Strokes to Par"
                  radius={[4, 4, 0, 0]}
                >
                  {holeTypeData.holePerformance.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getScoreColor(entry.averageScoreToPar)} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hole</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Par</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">+/-</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FIR</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GIR</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Putts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {holeTypeData.holePerformance
                  .sort((a, b) => a.holeNumber - b.holeNumber)
                  .map((hole, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                        {hole.holeNumber}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        {hole.par}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        {hole.averageScore.toFixed(1)}
                      </td>
                      <td className={`px-3 py-2 whitespace-nowrap text-sm font-medium ${
                        hole.averageScoreToPar <= 0 
                          ? 'text-green-600' 
                          : hole.averageScoreToPar < 0.7 
                            ? 'text-yellow-600' 
                            : 'text-red-600'
                      }`}>
                        {hole.averageScoreToPar === 0 
                          ? 'E' 
                          : hole.averageScoreToPar > 0 
                            ? `+${hole.averageScoreToPar.toFixed(1)}` 
                            : hole.averageScoreToPar.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        {hole.fairwayAttempts && hole.fairwayAttempts > 0 
                          ? `${((hole.fairwayHits! / hole.fairwayAttempts) * 100).toFixed(0)}%` 
                          : 'N/A'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        {hole.girAttempts && hole.girAttempts > 0 
                          ? `${((hole.girHits! / hole.girAttempts) * 100).toFixed(0)}%` 
                          : '0%'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        {hole.totalPutts && hole.totalHoles 
                          ? (hole.totalPutts / hole.totalHoles).toFixed(1) 
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Scoring Type Distribution Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Scoring Distribution by Hole Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {
                    name: 'Eagles',
                    'Par 3': holeTypeData.par3Stats?.scoreDistribution.eagles || 0,
                    'Par 4': holeTypeData.par4Stats?.scoreDistribution.eagles || 0,
                    'Par 5': holeTypeData.par5Stats?.scoreDistribution.eagles || 0,
                  },
                  {
                    name: 'Birdies',
                    'Par 3': holeTypeData.par3Stats?.scoreDistribution.birdies || 0,
                    'Par 4': holeTypeData.par4Stats?.scoreDistribution.birdies || 0,
                    'Par 5': holeTypeData.par5Stats?.scoreDistribution.birdies || 0,
                  },
                  {
                    name: 'Pars',
                    'Par 3': holeTypeData.par3Stats?.scoreDistribution.pars || 0,
                    'Par 4': holeTypeData.par4Stats?.scoreDistribution.pars || 0,
                    'Par 5': holeTypeData.par5Stats?.scoreDistribution.pars || 0,
                  },
                  {
                    name: 'Bogeys',
                    'Par 3': holeTypeData.par3Stats?.scoreDistribution.bogeys || 0,
                    'Par 4': holeTypeData.par4Stats?.scoreDistribution.bogeys || 0,
                    'Par 5': holeTypeData.par5Stats?.scoreDistribution.bogeys || 0,
                  },
                  {
                    name: 'Doubles',
                    'Par 3': holeTypeData.par3Stats?.scoreDistribution.doubleBogeys || 0,
                    'Par 4': holeTypeData.par4Stats?.scoreDistribution.doubleBogeys || 0,
                    'Par 5': holeTypeData.par5Stats?.scoreDistribution.doubleBogeys || 0,
                  },
                  {
                    name: 'Triple+',
                    'Par 3': holeTypeData.par3Stats?.scoreDistribution.worseThanDouble || 0,
                    'Par 4': holeTypeData.par4Stats?.scoreDistribution.worseThanDouble || 0,
                    'Par 5': holeTypeData.par5Stats?.scoreDistribution.worseThanDouble || 0,
                  },
                ]}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis 
                  label={{ 
                    value: 'Number of Holes', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' } 
                  }}
                />
                <Legend />
                <Bar dataKey="Par 3" fill="#3b82f6" name="Par 3" />
                <Bar dataKey="Par 4" fill="#8b5cf6" name="Par 4" />
                <Bar dataKey="Par 5" fill="#ec4899" name="Par 5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            This chart compares your scoring patterns across different types of holes. Identify where you excel or struggle.
          </div>
        </CardContent>
      </Card>
      
      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Strongest Hole Type */}
            <div>
              <h3 className="text-lg font-medium mb-3">Strongest Hole Type</h3>
              
              {(() => {
                if (!holeTypeData.par3Stats || !holeTypeData.par4Stats || !holeTypeData.par5Stats) {
                  return <p className="text-gray-500">Not enough data</p>;
                }
                
                const par3ScoreToPar = holeTypeData.par3Stats.averageScoreToPar;
                const par4ScoreToPar = holeTypeData.par4Stats.averageScoreToPar;
                const par5ScoreToPar = holeTypeData.par5Stats.averageScoreToPar;
                
                // Find best type, accounting for different expected scores on different par types
                // Adjust scoring expectations (par 3s typically play harder, par 5s easier)
                const par3Adjusted = par3ScoreToPar - 0.3; // Reduce par 3 expectations
                const par5Adjusted = par5ScoreToPar + 0.3; // Increase par 5 expectations
                
                const scores = [
                  { type: 'Par 3', raw: par3ScoreToPar, adjusted: par3Adjusted },
                  { type: 'Par 4', raw: par4ScoreToPar, adjusted: par4ScoreToPar },
                  { type: 'Par 5', raw: par5ScoreToPar, adjusted: par5Adjusted }
                ];
                
                // Sort by adjusted score (lower is better)
                scores.sort((a, b) => a.adjusted - b.adjusted);
                
                const bestType = scores[0].type;
                const bestRawScore = scores[0].raw;
                
                return (
                  <div>
                    <div className="text-2xl font-bold text-green-500 mb-2">
                      {bestType}s
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      You average {bestRawScore > 0 ? '+' : ''}{bestRawScore.toFixed(2)} strokes relative to par.
                      {bestType === 'Par 3' && ' Your accuracy on approach shots is a strength.'}
                      {bestType === 'Par 4' && ' You manage these holes well, balancing distance and accuracy.'}
                      {bestType === 'Par 5' && ' You take advantage of the longer holes effectively.'}
                    </p>
                    <div className="mt-3">
                      <Badge variant="success">Strength</Badge>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Weakest Hole Type */}
            <div>
              <h3 className="text-lg font-medium mb-3">Improvement Opportunity</h3>
              
              {(() => {
                if (!holeTypeData.par3Stats || !holeTypeData.par4Stats || !holeTypeData.par5Stats) {
                  return <p className="text-gray-500">Not enough data</p>;
                }
                
                const par3ScoreToPar = holeTypeData.par3Stats.averageScoreToPar;
                const par4ScoreToPar = holeTypeData.par4Stats.averageScoreToPar;
                const par5ScoreToPar = holeTypeData.par5Stats.averageScoreToPar;
                
                // Find worst type, accounting for different expected scores on different par types
                // Adjust scoring expectations (par 3s typically play harder, par 5s easier)
                const par3Adjusted = par3ScoreToPar - 0.3; // Reduce par 3 expectations
                const par5Adjusted = par5ScoreToPar + 0.3; // Increase par 5 expectations
                
                const scores = [
                  { type: 'Par 3', raw: par3ScoreToPar, adjusted: par3Adjusted },
                  { type: 'Par 4', raw: par4ScoreToPar, adjusted: par4ScoreToPar },
                  { type: 'Par 5', raw: par5ScoreToPar, adjusted: par5Adjusted }
                ];
                
                // Sort by adjusted score (higher is worse)
                scores.sort((a, b) => b.adjusted - a.adjusted);
                
                const worstType = scores[0].type;
                const worstRawScore = scores[0].raw;
                
                return (
                  <div>
                    <div className="text-2xl font-bold text-red-500 mb-2">
                      {worstType}s
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      You average {worstRawScore > 0 ? '+' : ''}{worstRawScore.toFixed(2)} strokes relative to par.
                      {worstType === 'Par 3' && ' Focus on improving your precision with approach shots and distance control.'}
                      {worstType === 'Par 4' && ' Work on tee shot accuracy and approach shots to improve these holes.'}
                      {worstType === 'Par 5' && ' Develop a better strategy for these longer holes to capitalize on scoring opportunities.'}
                    </p>
                    <div className="mt-3">
                      <Badge variant="error">Opportunity</Badge>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Overall Strategy */}
            <div>
              <h3 className="text-lg font-medium mb-3">Scoring Strategy</h3>
              
              {(() => {
                if (!holeTypeData.par3Stats || !holeTypeData.par4Stats || !holeTypeData.par5Stats) {
                  return <p className="text-gray-500">Not enough data</p>;
                }
                
                // Analyze birdie and bogey rates
                const par3BirdieRate = holeTypeData.par3Stats.scoreDistribution.birdies / 
                  holeTypeData.par3Stats.scoreDistribution.total;
                const par4BirdieRate = holeTypeData.par4Stats.scoreDistribution.birdies / 
                  holeTypeData.par4Stats.scoreDistribution.total;
                const par5BirdieRate = holeTypeData.par5Stats.scoreDistribution.birdies / 
                  holeTypeData.par5Stats.scoreDistribution.total;
                
                const par3BlowupRate = (holeTypeData.par3Stats.scoreDistribution.doubleBogeys + 
                  holeTypeData.par3Stats.scoreDistribution.worseThanDouble) / 
                  holeTypeData.par3Stats.scoreDistribution.total;
                const par4BlowupRate = (holeTypeData.par4Stats.scoreDistribution.doubleBogeys + 
                  holeTypeData.par4Stats.scoreDistribution.worseThanDouble) / 
                  holeTypeData.par4Stats.scoreDistribution.total;
                const par5BlowupRate = (holeTypeData.par5Stats.scoreDistribution.doubleBogeys + 
                  holeTypeData.par5Stats.scoreDistribution.worseThanDouble) / 
                  holeTypeData.par5Stats.scoreDistribution.total;
                
                // Determine player style
                const isAggressive = par3BirdieRate > 0.1 || par4BirdieRate > 0.08 || par5BirdieRate > 0.15;
                const isInconsistent = par3BlowupRate > 0.2 || par4BlowupRate > 0.15 || par5BlowupRate > 0.1;
                
                let playerStyle = '';
                let advice = '';
                
                if (isAggressive && isInconsistent) {
                  playerStyle = 'High-Risk Player';
                  advice = 'You make birdies but also have big misses. Consider a more conservative approach on holes where you struggle to reduce those big numbers.';
                } else if (isAggressive && !isInconsistent) {
                  playerStyle = 'Skilled Attacker';
                  advice = 'You make birdies while avoiding big numbers. Keep using your aggressive approach but stay focused on course management.';
                } else if (!isAggressive && isInconsistent) {
                  playerStyle = 'Struggling with Consistency';
                  advice = 'Work on eliminating the big misses that are hurting your score. Focus on safer shots to keep the ball in play.';
                } else {
                  playerStyle = 'Steady Player';
                  advice = 'You play consistently but could be more aggressive on scoring opportunities, especially on par 5s.';
                }
                
                return (
                  <div>
                    <div className="text-2xl font-bold text-blue-500 mb-2">
                      {playerStyle}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {advice}
                    </p>
                    <div className="mt-3 flex space-x-2">
                      <Tooltip content="Your birdie rate on par 5s">
                        <Badge variant="outline" className="text-xs">
                          Par 5 Birdies: {(par5BirdieRate * 100).toFixed(1)}%
                        </Badge>
                      </Tooltip>
                      <Tooltip content="Percentage of holes with double bogey or worse">
                        <Badge variant="outline" className="text-xs">
                          Blow-up: {(Math.max(par3BlowupRate, par4BlowupRate, par5BlowupRate) * 100).toFixed(1)}%
                        </Badge>
                      </Tooltip>
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