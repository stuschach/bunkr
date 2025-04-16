// functions/src/handicap/calculator.ts

/**
 * Calculate a course handicap based on USGA formula
 * 
 * Course Handicap = Handicap Index × (Slope Rating ÷ 113) + (Course Rating - Par)
 * 
 * @param handicapIndex The player's handicap index
 * @param slopeRating The slope rating of the course/tees
 * @param courseRating The course rating of the course/tees
 * @param coursePar The par of the course
 * @returns The calculated course handicap (rounded to nearest integer)
 */
export function calculateCourseHandicap(
    handicapIndex: number,
    slopeRating: number,
    courseRating: number,
    coursePar: number
  ): number {
    if (handicapIndex === null || handicapIndex === undefined) {
      return 0;
    }
    
    const rawCourseHandicap = handicapIndex * (slopeRating / 113) + (courseRating - coursePar);
    
    // Round to the nearest whole number per USGA rules
    return Math.round(rawCourseHandicap);
  }
  
  /**
   * Calculate a score differential for a round
   * 
   * Score Differential = (113 ÷ Slope Rating) × (Adjusted Gross Score - Course Rating - PCC adjustment)
   * 
   * @param score The player's score
   * @param courseRating The course rating of the tees played
   * @param slopeRating The slope rating of the tees played
   * @param pccAdjustment Playing Conditions Calculation adjustment (usually 0)
   * @returns The calculated score differential
   */
  export function calculateScoreDifferential(
    score: number,
    courseRating: number,
    slopeRating: number,
    pccAdjustment: number = 0
  ): number {
    // Score Differential = (113 ÷ Slope Rating) × (Adjusted Gross Score - Course Rating - PCC adjustment)
    const scoreDifferential = (113 / slopeRating) * (score - courseRating - pccAdjustment);
    
    // Round to 1 decimal place
    return Math.round(scoreDifferential * 10) / 10;
  }
  
  /**
   * Get the number of differentials to use based on USGA table
   * 
   * @param numAvailableRounds Total number of valid rounds
   * @returns The number of lowest score differentials to use
   */
  export function getNumberOfDifferentialsToUse(numAvailableRounds: number): number {
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