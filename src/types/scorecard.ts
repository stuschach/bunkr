// src/types/scorecard.ts
export interface TeeBox {
  name: string;
  color?: string;
  rating: number;
  slope: number;
  yardage: number;
}

export interface ScoreStats {
  totalPutts: number;
  fairwaysHit: number;
  fairwaysTotal: number;
  greensInRegulation: number;
  penalties: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  worseThanDouble: number;
}

export interface HoleData {
  number: number;
  par: number;
  handicap: number;
  yardage: number;
  score: number;
  putts?: number;
  fairwayHit?: boolean | null; // null for par 3
  girHit?: boolean;
  penalties?: number;
}

export interface Scorecard {
  id: string;
  userId: string;
  courseName: string;
  courseId?: string;
  date: string; // ISO string
  teeBox: TeeBox;
  holes: HoleData[];
  totalScore: number;
  coursePar: number;
  scoreToPar: number;
  stats: ScoreStats;
  isPublic: boolean;
  courseHandicap: number | null;
  notes?: string;
  playedWith?: string[]; // Array of user IDs
  weatherConditions?: {
    temperature?: number;
    conditions?: string;
    windSpeed?: number;
  };
  media?: {
    id: string;
    type: 'image' | 'video';
    url: string;
    holeNumber?: number;
  }[];
}