// src/lib/handicap/differentials.ts

/**
 * Calculates the score differential for a single round
 * 
 * Score Differential = (113 / Slope Rating) × (Adjusted Gross Score - Course Rating - PCC)
 * 
 * Where:
 * - 113 is the USGA standard slope rating
 * - Slope Rating is the course's difficulty rating relative to a scratch golfer
 * - Adjusted Gross Score is the player's score with maximum hole scores applied
 * - Course Rating is the expected score for a scratch golfer (Course Rating)
 * - PCC is the Playing Conditions Calculation (weather, course setup, etc.)
 *   Usually this is 0 unless determined by the golf association
 */
export function scoreToScoreDifferential(
    adjustedGrossScore: number,
    courseRating: number,
    slopeRating: number,
    pcc: number = 0  // Playing Conditions Calculation, usually 0
  ): number {
    const STANDARD_SLOPE = 113;
    const scoreDifferential = (STANDARD_SLOPE / slopeRating) * (adjustedGrossScore - courseRating - pcc);
    
    // Round to 1 decimal place
    return Math.round(scoreDifferential * 10) / 10;
  }
  
  /**
   * Converts an array of score differentials to a handicap index
   * 
   * 1. Use only the lowest n differentials based on number of rounds available
   * 2. Calculate the average of those differentials
   * 3. Multiply by 0.96 (the bonus for excellence factor)
   * 4. Truncate to 1 decimal place
   */
  export function differentialToHandicap(
    scoreDifferentials: number[],
    numberOfDifferentialsToUse: number
  ): number {
    // Sort differentials from lowest to highest
    const sortedDifferentials = [...scoreDifferentials].sort((a, b) => a - b);
    
    // Get the lowest n differentials
    const lowestDifferentials = sortedDifferentials.slice(0, numberOfDifferentialsToUse);
    
    // Calculate the average
    const avgDifferential = lowestDifferentials.reduce((sum, value) => sum + value, 0) / 
      lowestDifferentials.length;
    
    // Apply the 0.96 bonus for excellence factor
    const handicapIndex = avgDifferential * 0.96;
    
    // Truncate to 1 decimal place (not rounded)
    return Math.floor(handicapIndex * 10) / 10;
  }
  
  /**
   * Calculates the exceptional score reduction (ESR) for exceptional scores
   * 
   * An exceptional score is one that is 7.0 or more strokes better than the player's
   * Handicap Index at the time the round was played.
   * 
   * Exceptional Score Reduction:
   * - 7.0 to 9.9 strokes better: -1.0 additional reduction
   * - 10.0 or more strokes better: -2.0 additional reduction
   */
  export function calculateExceptionalScoreReduction(
    scoreDifferential: number,
    handicapIndex: number
  ): number {
    const difference = handicapIndex - scoreDifferential;
    
    if (difference >= 10.0) {
      return -2.0; // Reduce handicap by 2.0 for exceptional scores
    } else if (difference >= 7.0) {
      return -1.0; // Reduce handicap by 1.0 for very good scores
    }
    
    return 0; // No reduction for normal scores
  }
  
  /**
   * Apply soft and hard caps to limit handicap index increases
   * 
   * Soft Cap: If a player's Handicap Index increases by more than 3.0 strokes,
   * additional increases are reduced by 50%
   * 
   * Hard Cap: A player's Handicap Index cannot increase by more than 5.0 strokes
   * over their Low Handicap Index from the previous 365 days
   */
  export function applyHandicapCaps(
    calculatedHandicapIndex: number,
    lowestHandicapIndex: number  // Lowest handicap in the past 365 days
  ): number {
    const increase = calculatedHandicapIndex - lowestHandicapIndex;
    
    // No cap needed if handicap isn't increasing
    if (increase <= 3.0) {
      return calculatedHandicapIndex;
    }
    
    // Apply soft cap - 50% of any increase above 3.0 strokes
    let cappedHandicap = lowestHandicapIndex + 3.0 + ((increase - 3.0) * 0.5);
    
    // Apply hard cap - maximum 5.0 stroke increase
    cappedHandicap = Math.min(cappedHandicap, lowestHandicapIndex + 5.0);
    
    // Round to one decimal place
    return Math.round(cappedHandicap * 10) / 10;
  }
  
  /**
   * Calculate a playing handicap from a handicap index
   * 
   * Playing Handicap = Course Handicap × Handicap Allowance
   * 
   * Where:
   * - Course Handicap is the player's handicap index adjusted for the course
   * - Handicap Allowance is the percentage based on the format of play
   *   (e.g., 95% for individual stroke play, 90% for individual match play)
   */
  export function calculatePlayingHandicap(
    courseHandicap: number,
    handicapAllowance: number = 0.95  // Default 95% for individual stroke play
  ): number {
    const playingHandicap = courseHandicap * handicapAllowance;
    
    // Round to the nearest whole number
    return Math.round(playingHandicap);
  }