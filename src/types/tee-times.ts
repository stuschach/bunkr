// src/types/tee-times.ts

import { Timestamp } from 'firebase/firestore';

export type TeeTimeStatus = 'open' | 'full' | 'cancelled';
export type TeeTimeVisibility = 'public' | 'followers' | 'private';
export type PlayerStatus = 'confirmed' | 'pending' | 'declined';
export type PlayerRole = 'creator' | 'player';

export interface TeeTimePlayer {
  userId: string;
  status: PlayerStatus;
  joinedAt: Date | Timestamp;
  invitedBy?: string;
}

export interface TeeTime {
  id: string;
  creatorId: string;
  courseName: string;
  courseId?: string;
  dateTime: Date | Timestamp | string;
  maxPlayers: number;
  currentPlayers: number;
  status: TeeTimeStatus;
  visibility: TeeTimeVisibility;
  description?: string;
  players?: TeeTimePlayer[];
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface UserTeeTime {
  userId: string;
  teeTimeId: string;
  role: PlayerRole;
  status: PlayerStatus;
}

export interface TeeTimeFormData {
  courseName: string;
  courseId?: string;
  date: Date;
  time: string;
  maxPlayers: number;
  visibility: TeeTimeVisibility;
  description?: string;
}

export interface TeeTimeFilters {
  status?: TeeTimeStatus | 'all';
  date?: Date | null;
  courseId?: string;
  maxDistance?: number;
  userLocation?: {
    latitude: number;
    longitude: number;
  };
}