// src/types/scorecard.ts
export interface Scorecard {
  id: string;
  userId: string;
  date: string; // ISO string
  courseName: string;
  courseId?: string;
  teeBox?: {
    name: string;
    color: string;
    yardage: number;
    rating: number;
    slope: number;
  };
  coursePar: number;
  totalScore: number;
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
  stats?: {
    fairwaysHit: number;
    fairwaysTotal: number;
    greensInRegulation: number;
    totalPutts: number;
    puttsMissedWithin6ft: number;
    sandSaves: number;
    sandSaveAttempts: number;
    penalties: number;
    eagles: number;
    birdies: number;
    pars: number;
    bogeys: number;
    doubleBogeys: number;
    worseThanDouble: number;
  };
  holes: HoleScore[];
  createdAt?: string;
  updatedAt?: string;
}

export interface HoleScore {
  number: number;
  par: number;
  yardage: number;
  handicap: number;
  score: number;
  fairwayHit?: boolean | null;
  greenInRegulation?: boolean | null;
  putts?: number | null;
  penalties?: number | null;
}