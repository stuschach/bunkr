// src/types/tee-times.ts
import { UserProfile } from './auth';

/**
 * Status of a tee time
 */
export type TeeTimeStatus = 'open' | 'full' | 'cancelled';

/**
 * Visibility of a tee time
 */
export type TeeTimeVisibility = 'public' | 'followers' | 'private';

/**
 * Status of a player in a tee time
 */
export type PlayerStatus = 'pending' | 'confirmed' | 'declined' | 'removed';

/**
 * Type of request for joining a tee time
 */
export type RequestType = 'invitation' | 'join_request' | 'creator';

/**
 * Tee time player
 */
export interface TeeTimePlayer {
  userId: string;
  status: PlayerStatus;
  joinedAt: Date;
  invitedBy?: string;
  removedAt?: Date;
  removedBy?: string;
  profile?: UserProfile;
  requestType?: RequestType;
  approvedAt?: Date;
  approvedBy?: string;
  respondedAt?: Date;
}

/**
 * Tee time entity
 */
export interface TeeTime {
  id: string;
  creatorId: string;
  courseName: string;
  courseId: string | null;
  dateTime: Date | null;
  maxPlayers: number;
  currentPlayers: number;
  status: TeeTimeStatus;
  visibility: TeeTimeVisibility;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  players?: TeeTimePlayer[];
}

/**
 * Form data for creating or updating a tee time
 */
export interface TeeTimeFormData {
  courseName: string;
  courseId: string | null;
  date: Date;
  time: string;
  maxPlayers: number;
  visibility: TeeTimeVisibility;
  description: string;
}

/**
 * Filters for tee time listing
 */
export interface TeeTimeFilters {
  status?: TeeTimeStatus | 'all';
  date?: Date | null;
  courseId?: string;
  maxDistance?: number;
}

/**
 * Response for tee time creation
 */
export interface CreateTeeTimeResponse {
  teeTimeId: string;
  success: boolean;
  message?: string;
}

/**
 * Response for tee time player operations
 */
export interface TeeTimePlayerResponse {
  success: boolean;
  message?: string;
  player?: TeeTimePlayer;
}

/**
 * Invitation to a tee time
 */
export interface TeeTimeInvitation {
  id: string;
  teeTimeId: string;
  invitedUserId: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  respondedAt?: Date;
}

/**
 * Notification types related to tee times
 */
export type TeeTimeNotificationType = 
  | 'tee-time-invite' 
  | 'tee-time-approved' 
  | 'tee-time-request' 
  | 'tee-time-cancelled' 
  | 'tee-time-created'
  | 'tee-time-invitation-accepted'
  | 'tee-time-deleted'
  | 'tee-time-invitation-declined';

export type { UserProfile };
