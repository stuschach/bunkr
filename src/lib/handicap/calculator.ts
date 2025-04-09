// src/lib/handicap/calculator.ts
import { differentialToHandicap, scoreToScoreDifferential } from '@/lib/handicap/differentials';
import { Scorecard } from '@/types/scorecard';

/**
 * Calculates the USGA Handicap Index based on the golfer's rounds
 * 
 * According to USGA rules:
 * - Use the best 8 of the last 20 score differentials
 * - Calculate the average of those 8 differentials
 * - Multiply by 0.96 (the "bonus for excellence")
 * - Truncate to one decimal place (not rounded)
 */
export function calculateHandicapIndex(rounds: Scorecard[]): number | null {
  // Need at least 3 rounds to calculate a handicap (USGA minimum)
  if (!rounds || rounds.length < 3) {
    return null;
  }

  // Sort rounds by date, newest first
  const sortedRounds = [...rounds].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Get the 20 most recent rounds (or all if less than 20)
  const recentRounds = sortedRounds.slice(0, 20);

  // Calculate score differentials for each round
  const scoreDifferentials = recentRounds.map(round => {
    return scoreToScoreDifferential(
      round.totalScore,
      round.teeBox.rating,
      round.teeBox.slope
    );
  });

  // Number of differentials to use based on USGA table
  const numDifferentialsToUse = getNumDifferentialsToUse(scoreDifferentials.length);

  // Sort differentials from lowest to highest and take the best ones
  const sortedDifferentials = [...scoreDifferentials].sort((a, b) => a - b);
  const bestDifferentials = sortedDifferentials.slice(0, numDifferentialsToUse);

  // Calculate average of the best differentials
  const averageDifferential = bestDifferentials.reduce((sum, diff) => sum + diff, 0) / 
    bestDifferentials.length;

  // Apply the "bonus for excellence" factor (0.96)
  const handicapIndex = averageDifferential * 0.96;

  // Truncate to one decimal place (do not round)
  return Math.floor(handicapIndex * 10) / 10;
}

/**
 * Calculates the Course Handicap based on the Handicap Index
 * 
 * Course Handicap = Handicap Index × (Slope Rating ÷ 113) + (Course Rating - Par)
 */
export function calculateCourseHandicap(
  handicapIndex: number, 
  slopeRating: number, 
  courseRating: number,
  coursePar: number
): number {
  const rawCourseHandicap = handicapIndex * (slopeRating / 113) + (courseRating - coursePar);
  
  // Round to the nearest whole number
  return Math.round(rawCourseHandicap);
}

/**
 * Get the number of differentials to use based on USGA table
 */
function getNumDifferentialsToUse(numAvailableRounds: number): number {
  // USGA table for how many score differentials to use
  switch (true) {
    case numAvailableRounds <= 3:
      return 1; // Lowest 1 of 3
    case numAvailableRounds <= 4:
      return 1; // Lowest 1 of 4
    case numAvailableRounds <= 5:
      return 1; // Lowest 1 of 5
    case numAvailableRounds <= 6:
      return 2; // Lowest 2 of 6
    case numAvailableRounds <= 7:
      return 2; // Lowest 2 of 7
    case numAvailableRounds <= 8:
      return 2; // Lowest 2 of 8
    case numAvailableRounds <= 9:
      return 3; // Lowest 3 of 9
    case numAvailableRounds <= 10:
      return 3; // Lowest 3 of 10
    case numAvailableRounds <= 11:
      return 3; // Lowest 3 of 11
    case numAvailableRounds <= 12:
      return 4; // Lowest 4 of 12
    case numAvailableRounds <= 13:
      return 4; // Lowest 4 of 13
    case numAvailableRounds <= 14:
      return 4; // Lowest 4 of 14
    case numAvailableRounds <= 15:
      return 5; // Lowest 5 of 15
    case numAvailableRounds <= 16:
      return 5; // Lowest 5 of 16
    case numAvailableRounds <= 17:
      return 6; // Lowest 6 of 17
    case numAvailableRounds <= 18:
      return 6; // Lowest 6 of 18
    case numAvailableRounds <= 19:
      return 7; // Lowest 7 of 19
    default:
      return 8; // Lowest 8 of 20 (or more)
  }
}

/**
 * Get the maximum score per hole for handicap purposes based on handicap
 * 
 * This is the Net Double Bogey calculation:
 * Net Double Bogey = Par + 2 + any handicap strokes received on that hole
 */
export function getMaxScorePerHole(
  courseHandicap: number,
  holePar: number,
  holeIndex: number // The hole's difficulty index (1-18)
): number {
  // Calculate handicap strokes received on this hole
  let handicapStrokes = 0;
  
  // If courseHandicap is positive (higher handicap players)
  if (courseHandicap > 0) {
    // First allocation: one stroke per hole starting from hole index 1
    if (holeIndex <= courseHandicap) {
      handicapStrokes = 1;
    }
    
    // Second allocation if handicap > 18
    if (courseHandicap > 18 && holeIndex <= (courseHandicap - 18)) {
      handicapStrokes = 2;
    }
    
    // Third allocation if handicap > 36
    if (courseHandicap > 36 && holeIndex <= (courseHandicap - 36)) {
      handicapStrokes = 3;
    }
  }
  // If courseHandicap is negative (scratch or better players)
  else if (courseHandicap < 0) {
    // Add strokes to hardest holes first
    if (19 - holeIndex <= Math.abs(courseHandicap)) {
      handicapStrokes = -1;
    }
  }
  
  // Net Double Bogey = Par + 2 + handicap strokes
  return holePar + 2 + handicapStrokes;
}

/**
 * Adjust scorecard for handicap calculation purposes
 * This applies Net Double Bogey adjustments to any hole scores
 * that exceed the maximum for that player's handicap
 */
export function getAdjustedGrossScore(
  scorecard: Scorecard,
  courseHandicap: number
): number {
  let adjustedScore = 0;
  
  // For each hole, cap the score at maximum
  scorecard.holes.forEach((hole, index) => {
    // Get the 1-indexed hole index (used for handicap allocation)
    // In a real implementation, this would come from the course data
    // For now, we'll assume hole index matches hole number
    const holeIndex = index + 1;
    
    // Calculate max allowed score for handicap
    const maxScore = getMaxScorePerHole(courseHandicap, hole.par, holeIndex);
    
    // Use the actual score unless it exceeds max score
    const adjustedHoleScore = Math.min(hole.score, maxScore);
    
    // Add to total
    adjustedScore += adjustedHoleScore;
  });
  
  return adjustedScore;
}