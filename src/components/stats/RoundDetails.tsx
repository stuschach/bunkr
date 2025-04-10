import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Scorecard } from '@/types/scorecard';
import { formatScoreWithRelationToPar } from '@/lib/utils/formatting';

export interface RoundDetailsProps {
  rounds: Scorecard[];
}

export function RoundDetails({ rounds }: RoundDetailsProps) {
  const router = useRouter();
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(
    rounds.length ? rounds[0].id : null
  );

  // Sort rounds by date (newest first)
  const sortedRounds = useMemo(() => {
    return [...rounds].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [rounds]);

  // Get the selected round
  const selectedRound = useMemo(() => {
    if (!selectedRoundId) return null;
    return rounds.find(round => round.id === selectedRoundId) || null;
  }, [rounds, selectedRoundId]);

  // Calculate front 9 and back 9 stats
  const nineHoleStats = useMemo(() => {
    if (!selectedRound || !selectedRound.holes || selectedRound.holes.length < 18) return null;

    const front9 = selectedRound.holes.slice(0, 9);
    const back9 = selectedRound.holes.slice(9, 18);

    const front9Score = front9.reduce((sum, hole) => sum + hole.score, 0);
    const back9Score = back9.reduce((sum, hole) => sum + hole.score, 0);

    const front9Par = front9.reduce((sum, hole) => sum + hole.par, 0);
    const back9Par = back9.reduce((sum, hole) => sum + hole.par, 0);

    return {
      front9: {
        score: front9Score,
        par: front9Par,
        scoreToPar: front9Score - front9Par
      },
      back9: {
        score: back9Score,
        par: back9Par,
        scoreToPar: back9Score - back9Par
      }
    };
  }, [selectedRound]);

  // Calculate score distribution
  const scoreDistribution = useMemo(() => {
    if (!selectedRound || !selectedRound.holes) return null;

    let eagles = 0;
    let birdies = 0;
    let pars = 0;
    let bogeys = 0;
    let doubleBogeys = 0;
    let worse = 0;

    selectedRound.holes.forEach(hole => {
      const scoreToPar = hole.score - hole.par;
      if (scoreToPar <= -2) eagles++;
      else if (scoreToPar === -1) birdies++;
      else if (scoreToPar === 0) pars++;
      else if (scoreToPar === 1) bogeys++;
      else if (scoreToPar === 2) doubleBogeys++;
      else worse++;
    });

    return { eagles, birdies, pars, bogeys, doubleBogeys, worse };
  }, [selectedRound]);

  if (!rounds.length) return null;

  return (
    <div className="space-y-6">
      {/* Round Selection */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Round Details</h3>
        <Select
          options={sortedRounds.map(round => ({
            value: round.id,
            label: `${round.courseName} - ${new Date(round.date).toLocaleDateString()}`
          }))}
          value={selectedRoundId || ''}
          onChange={setSelectedRoundId}
          className="w-64"
        />
      </div>

      {selectedRound ? (
        <>
          {/* Round Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{selectedRound.courseName}</span>
                <Badge variant={selectedRound.totalScore <= selectedRound.coursePar ? 'success' : 'outline'}>
                  {formatScoreWithRelationToPar(selectedRound.totalScore, selectedRound.coursePar)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Date</div>
                  <div className="font-semibold">
                    {new Date(selectedRound.date).toLocaleDateString()}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-500 mb-1">Tee Box</div>
                  <div className="font-semibold flex items-center">
                    {selectedRound.teeBox?.name}
                    {selectedRound.teeBox?.color && (
                      <span 
                        className="ml-2 h-3 w-3 rounded-full" 
                        style={{ 
                          backgroundColor: selectedRound.teeBox.color.toLowerCase() === 'blue' ? 'blue' : 
                                        selectedRound.teeBox.color.toLowerCase() === 'white' ? 'white' :
                                        selectedRound.teeBox.color.toLowerCase() === 'red' ? 'red' :
                                        selectedRound.teeBox.color.toLowerCase() === 'gold' ? 'gold' :
                                        selectedRound.teeBox.color.toLowerCase() === 'black' ? 'black' :
                                        selectedRound.teeBox.color.toLowerCase() === 'green' ? 'green' : 'gray',
                          border: selectedRound.teeBox.color.toLowerCase() === 'white' ? '1px solid gray' : 'none'
                        }}
                      ></span>
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-500 mb-1">Course Details</div>
                  <div className="font-semibold">
                    Par {selectedRound.coursePar} • 
                    {selectedRound.teeBox?.yardage ? ` ${selectedRound.teeBox.yardage} yards` : ''}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-500 mb-1">Rating/Slope</div>
                  <div className="font-semibold">
                    {selectedRound.teeBox?.rating || '-'} / {selectedRound.teeBox?.slope || '-'}
                  </div>
                </div>
              </div>

              {/* Nine-hole scores */}
              {nineHoleStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  {/* Front 9 */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="text-center">
                      <div className="text-sm text-gray-500 mb-1">Front 9</div>
                      <div className="text-2xl font-bold">
                        {nineHoleStats.front9.score}
                      </div>
                      <div className={`text-sm ${
                        nineHoleStats.front9.scoreToPar <= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {nineHoleStats.front9.scoreToPar === 0 
                          ? 'Even'
                          : nineHoleStats.front9.scoreToPar > 0 
                            ? `+${nineHoleStats.front9.scoreToPar}` 
                            : nineHoleStats.front9.scoreToPar}
                      </div>
                    </div>
                  </div>
                  
                  {/* Total */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                    <div className="text-center">
                      <div className="text-sm text-gray-500 mb-1">Total</div>
                      <div className="text-3xl font-bold">
                        {selectedRound.totalScore}
                      </div>
                      <div className={`text-sm ${
                        selectedRound.totalScore - selectedRound.coursePar <= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {formatScoreWithRelationToPar(selectedRound.totalScore, selectedRound.coursePar, false)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Back 9 */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="text-center">
                      <div className="text-sm text-gray-500 mb-1">Back 9</div>
                      <div className="text-2xl font-bold">
                        {nineHoleStats.back9.score}
                      </div>
                      <div className={`text-sm ${
                        nineHoleStats.back9.scoreToPar <= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {nineHoleStats.back9.scoreToPar === 0 
                          ? 'Even'
                          : nineHoleStats.back9.scoreToPar > 0 
                            ? `+${nineHoleStats.back9.scoreToPar}` 
                            : nineHoleStats.back9.scoreToPar}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Score Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Score Breakdown */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Score Breakdown</h4>
                  {scoreDistribution && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Eagles or Better</span>
                        <div>
                          <Badge variant="success" className="bg-green-600">
                            {scoreDistribution.eagles}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Birdies</span>
                        <div>
                          <Badge variant="success">
                            {scoreDistribution.birdies}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Pars</span>
                        <div>
                          <Badge variant="secondary">
                            {scoreDistribution.pars}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Bogeys</span>
                        <div>
                          <Badge variant="outline" className="text-orange-500 border-orange-500">
                            {scoreDistribution.bogeys}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Double Bogeys</span>
                        <div>
                          <Badge variant="error">
                            {scoreDistribution.doubleBogeys}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Triple+ Bogeys</span>
                        <div>
                          <Badge variant="error" className="bg-red-700">
                            {scoreDistribution.worse}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Performance Stats */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Performance Stats</h4>
                  <div className="space-y-2">
                    {selectedRound.stats && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Fairways Hit</span>
                          <span className="font-medium">
                            {selectedRound.stats.fairwaysHit}/{selectedRound.stats.fairwaysTotal} 
                            {' '}({((selectedRound.stats.fairwaysHit / selectedRound.stats.fairwaysTotal) * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Greens in Regulation</span>
                          <span className="font-medium">
                            {selectedRound.stats.greensInRegulation}/18
                            {' '}({((selectedRound.stats.greensInRegulation / 18) * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Total Putts</span>
                          <span className="font-medium">
                            {selectedRound.stats.totalPutts}
                            {' '}({(selectedRound.stats.totalPutts / 18).toFixed(1)} per hole)
                          </span>
                        </div>
                        {selectedRound.stats.penalties !== undefined && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Penalty Strokes</span>
                            <span className="font-medium">
                              {selectedRound.stats.penalties}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    
                    {!selectedRound.stats && (
                      <div className="text-gray-500 text-sm py-4 text-center">
                        No detailed stats available for this round
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* View Full Scorecard Button */}
              <div className="mt-6 text-center">
                <Button onClick={() => router.push(`/scorecard/${selectedRound.id}`)}>
                  View Full Scorecard
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Hole-by-Hole Scores */}
          <Card>
            <CardHeader>
              <CardTitle>Hole-by-Hole Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hole</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Par</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yards</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To Par</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FIR</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GIR</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Putts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {selectedRound.holes.map((hole, index) => {
                      // Calculate score to par for styling
                      const scoreToPar = hole.score - hole.par;
                      const scoreClass = 
                        scoreToPar <= -2 ? 'text-green-600' :
                        scoreToPar === -1 ? 'text-green-500' :
                        scoreToPar === 0 ? 'text-gray-700 dark:text-gray-300' :
                        scoreToPar === 1 ? 'text-orange-500' :
                        scoreToPar === 2 ? 'text-red-500' : 'text-red-700';
                      
                      return (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">
                            {hole.par}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">
                            {hole.yardage}
                          </td>
                          <td className={`px-3 py-2 whitespace-nowrap text-sm font-semibold ${scoreClass}`}>
                            {hole.score}
                          </td>
                          <td className={`px-3 py-2 whitespace-nowrap text-sm font-medium ${scoreClass}`}>
                            {scoreToPar === 0 
                              ? 'E' 
                              : scoreToPar > 0 
                                ? `+${scoreToPar}` 
                                : scoreToPar}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">
                            {hole.par > 3 ? (
                              hole.fairwayHit === true 
                                ? '✓' 
                                : hole.fairwayHit === false 
                                  ? '✗' 
                                  : '-'
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">
                            {hole.greenInRegulation === true 
                              ? '✓' 
                              : hole.greenInRegulation === false 
                                ? '✗' 
                                : '-'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">
                            {hole.putts || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full bg-green-600 mr-1"></span>
                    <span>Eagle or better</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
                    <span>Birdie</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full bg-gray-400 mr-1"></span>
                    <span>Par</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full bg-orange-500 mr-1"></span>
                    <span>Bogey</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full bg-red-500 mr-1"></span>
                    <span>Double Bogey</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full bg-red-700 mr-1"></span>
                    <span>Triple Bogey+</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-gray-500 dark:text-gray-400">
              Select a round to view detailed stats
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}