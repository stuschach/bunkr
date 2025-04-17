// src/types/scorecard.ts

/**
 * Represents a tee box on a golf course
 */
export interface TeeBox {
  id?: string;
  name: string;           // E.g., "Blue", "White", "Red"
  color?: string;         // Optional color representation
  rating: number;         // Course rating (e.g., 72.5)
  slope: number;          // Slope rating (e.g., 133)
  yardage: number;        // Total yardage
  par?: number;           // Optional par if different from course par
  gender?: 'M' | 'F' | 'U'; // Optional gender designation
}

/**
 * Data for a single hole on the course
 */
export interface HoleData {
  number: number;                 // Hole number (1-18)
  par: number;                    // Par for the hole
  score: number;                  // Player's score for the hole
  fairwayHit: boolean | null;     // Did player hit the fairway? (null for par 3s)
  greenInRegulation: boolean;     // Did player hit green in regulation?
  putts: number;                  // Number of putts on the hole
  penalties?: number;             // Number of penalty strokes
  notes?: string;                 // Optional notes for the hole
  distance?: number;              // Optional yardage/distance
  handicapIndex?: number;         // Optional handicap index/difficulty of hole (1-18)
  fairwayDirection?: 'left' | 'right' | 'center' | null; // Optional direction of fairway miss
  approachDistance?: number;      // Optional approach shot distance
  approachResult?: 'green' | 'fringe' | 'sand' | 'rough' | 'fairway'; // Optional approach result
  chipResult?: boolean;           // Optional chip/pitch result (true = good)
  sandSave?: boolean;             // Optional sand save success
  scrambling?: boolean;           // Optional scrambling success
  upAndDown?: boolean;            // Optional up and down success
}

/**
 * Statistics for a round of golf
 */
export interface ScorecardStats {
  totalScore: number;            // Total score for the round
  totalPutts: number;            // Total number of putts
  fairwaysHit: number;           // Number of fairways hit
  fairwaysTotal: number;         // Total number of fairways (excludes par 3s)
  greensInRegulation: number;    // Number of greens hit in regulation
  penalties: number;             // Total penalty strokes
  averageDrivingDistance?: number; // Average driving distance
  eagles?: number;               // Number of eagles (-2)
  birdies?: number;              // Number of birdies (-1)
  pars?: number;                 // Number of pars (E)
  bogeys?: number;               // Number of bogeys (+1)
  doubleBogeys?: number;         // Number of double bogeys (+2)
  worseThanDouble?: number;      // Number of worse than double bogeys (+3 or worse)
  puttingAverage?: number;       // Average putts per hole
  scoringAverage?: number;       // Average score relative to par
  sandSaves?: number;            // Number of sand saves
  sandSaveOpportunities?: number;// Number of sand save opportunities
  scrambling?: number;           // Number of successful scrambles
  scramblingOpportunities?: number; // Number of scrambling opportunities
  girByPar?: {                   // GIR breakdown by par
    par3: number;
    par4: number;
    par5: number;
  };
}

/**
 * State of a scorecard
 */
export type ScorecardState = 'draft' | 'live' | 'completed' | 'archived';

/**
 * Complete scorecard data structure
 */
export interface Scorecard {
  // Offline-specific properties
  _offlineUpdatedAt?: number;
  _isOffline?: boolean;
  id: string;                    // Unique identifier
  userId: string;                // User who owns the scorecard
  courseId: string;              // Course ID
  courseName: string;            // Course name
  coursePar: number;             // Course total par
  date: string;                  // Date played (YYYY-MM-DD)
  teeBox: TeeBox;                // Tee box played from
  totalScore: number;            // Total score for the round
  scoreToPar: number;            // Score relative to par
  holes: HoleData[];             // Data for each hole
  stats: Partial<ScorecardStats>; // Round statistics
  courseHandicap: number | null; // Course handicap for this round
  netScore?: number;             // Net score (total - handicap)
  isPublic: boolean;             // Whether the round is publicly viewable
  isCompleted: boolean;          // Whether the round is completed
  state: ScorecardState;         // Current state of the scorecard
  notes?: string;                // Optional notes about the round
  weather?: {                    // Optional weather data
    conditions: string;
    temperature: number;
    windSpeed: number;
    windDirection?: string;
  };
  playingPartners?: string[];    // Optional list of playing partners
  tags?: string[];               // Optional tags
  createdAt?: Date;              // When the scorecard was created
  updatedAt?: Date;              // When the scorecard was last updated
  finalizedAt?: Date;            // When the scorecard was finalized
  postIds?: string[];            // References to posts about this round
}

/**
 * Partial scorecard for list views
 */
export interface ScorecardSummary {
  id: string;
  userId: string;
  courseName: string;
  coursePar: number;
  date: string;
  totalScore: number;
  scoreToPar: number;
  teeBox: {
    name: string;
    yardage: number;
  };
  stats: {
    fairwaysHit: number;
    fairwaysTotal: number;
    greensInRegulation: number;
    totalPutts: number;
  };
  isPublic: boolean;
  isCompleted: boolean;
}

/**
 * Course data structure
 */
export interface CourseData {
  id: string;
  name: string;
  par: number;
  location?: {
    city: string;
    state: string;
    country?: string;
    formattedLocation: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  teeBoxes?: TeeBox[];
  holes?: HoleData[];
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isComplete: boolean;
  nameTokens?: string[];
  website?: string;
  phone?: string;
  amenities?: string[];
  photos?: string[];
  rating?: number;
  reviewCount?: number;
}

/**
 * Handicap data structure
 */
export interface HandicapRecord {
  userId: string;
  handicapIndex: number;
  date: string;
  includedRounds: string[];
  differentials: number[];
  trend: 'improving' | 'declining' | 'stable';
  lowIndex: number;
  createdAt: Date;
}

/**
 * Stats summary over time
 */
export interface StatsSummary {
  userId: string;
  period: 'all' | 'year' | 'month' | 'week';
  year?: number;
  month?: number;
  week?: number;
  roundsPlayed: number;
  scoringAverage: number;
  scoringAverageToPar: number;
  bestRound: {
    id: string;
    score: number;
    scoreToPar: number;
    courseName: string;
    date: string;
  };
  stats: Partial<ScorecardStats>;
  lastUpdated: Date;
}