// src/types/scorecard.ts

// Standalone TeeBox type for reuse
export interface TeeBox {
  id?: string;
  name: string;
  color?: string;
  yardage: number;
  rating: number;
  slope: number;
}

export interface HoleData {
  number: number;
  par: number;
  distance?: number;     // For course setup
  handicapIndex?: number; // For course setup
  yardage?: number;      // Same as distance, for compatibility
  handicap?: number;     // Same as handicapIndex, for compatibility
  score: number;
  fairwayHit?: boolean | null;
  greenInRegulation?: boolean | null;
  putts?: number | null;
  penalties?: number | null;
  notes?: string | null;  // For hole-specific notes
}

export interface Scorecard {
  id: string;
  userId: string;
  date: string; // ISO string
  courseName: string;
  courseId: string;
  teeBox: TeeBox;
  coursePar: number;
  totalScore: number;
  scoreToPar?: number;
  courseHandicap?: number | null;
  handicapUsed?: number | null;
  netScore?: number | null;
  notes?: string | null;
  isPublic: boolean;
  weather?: {
    condition: string;
    temperature: number;
    windSpeed: number;
    windDirection: string;
  };
  stats: {
    fairwaysHit: number;
    fairwaysTotal: number;
    greensInRegulation: number;
    totalPutts: number;
    puttsMissedWithin6ft?: number;
    sandSaves?: number;
    sandSaveAttempts?: number;
    penalties: number;
    eagles?: number;
    birdies?: number;
    pars?: number;
    bogeys?: number;
    doubleBogeys?: number;
    worseThanDouble?: number;
  };
  holes: HoleData[];
  createdAt?: any;     // Firebase Timestamp
  updatedAt?: any;     // Firebase Timestamp
}

// New types for course data
export interface GolfCourse {
  id: string;
  name: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  par: number;
  createdBy: string;
  isComplete: boolean;
  nameTokens: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface CourseHole {
  number: number;
  par: number;
  distance: number;
  handicapIndex: number;
}

// Utility type for location
export interface CourseLocation {
  city: string;
  state: string;
  formattedLocation: string;
}