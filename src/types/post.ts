// src/types/post.ts
import { UserProfile } from './auth';

export interface Media {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
}

export interface Location {
  id?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface Post {
  id: string;
  authorId: string;
  author?: UserProfile;
  content: string;
  media?: Media[];
  createdAt: Date;
  updatedAt?: Date;
  postType: 'regular' | 'round' | 'event' | 'marketplace';
  visibility: 'public' | 'followers' | 'private';
  likes: number;
  comments: number;
  likedBy?: string[]; // Array of user IDs who liked the post
  likedByUser?: boolean; // Whether the current user has liked this post
  hashtags?: string[];
  location?: Location;
  roundId?: string; // Reference to a scorecard (for postType: 'round')
  eventId?: string; // Reference to an event (for postType: 'event')
  marketplaceId?: string; // Reference to a marketplace item (for postType: 'marketplace')
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author?: UserProfile;
  text: string;
  createdAt: Date;
  likes: number;
  likedBy?: string[];
  likedByUser?: boolean;
}