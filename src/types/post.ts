// src/types/post.ts
import { UserProfile } from './auth';

// Denormalized minimal author data for feed optimization
export interface DenormalizedAuthorData {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  handicapIndex?: number | null;
}

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
  // Support both full UserProfile and denormalized data
  author?: UserProfile | DenormalizedAuthorData;
  content: string;
  media?: Media[];
  createdAt: Date;
  updatedAt?: Date;
  postType: 'regular' | 'round' | 'event' | 'marketplace' | 'tee-time';
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
  teeTimeId?: string; // Reference to a tee time (for postType: 'tee-time')
  courseName?: string; // For tee time posts
  dateTime?: Date | null; // For tee time posts - typed more strictly now
  maxPlayers?: number; // For tee time posts
  
  // Fields for optimistic updates and real-time state
  pendingLike?: boolean; // Whether there's a pending like operation
  pendingComment?: boolean; // Whether there's a pending comment operation
}

// Partial post update interface for real-time listeners
export interface PostUpdate {
  id: string;
  likes?: number;
  comments?: number;
  likedBy?: string[];
  likedByUser?: boolean;
}

// Firestore-specific post type for handling timestamps
export interface FirestorePost extends Omit<Post, 'createdAt' | 'updatedAt' | 'dateTime'> {
  createdAt: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
  dateTime?: FirebaseTimestamp | null;
}

// Firebase Timestamp type representation
export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author?: UserProfile | DenormalizedAuthorData; // Support both author types
  text: string;
  createdAt: Date;
  likes: number;
  likedBy?: string[];
  likedByUser?: boolean;
}

// Feed query result interface for pagination
export interface FeedQueryResult {
  posts: Post[];
  lastVisible: any; // QueryDocumentSnapshot from Firestore
  hasMore: boolean;
}

// Lightweight feed item in Firestore for the optimized fanout pattern
// Only storing references and essential metadata, not full content or interaction counts
export interface LightweightFeedItem {
  postId: string;
  authorId: string;
  author: DenormalizedAuthorData; // Keep minimal author data for rendering
  postType: string;
  createdAt: FirebaseTimestamp | null;
  visibility: string;
  // Only keep metadata needed for filtering and navigation
  roundId?: string;
  teeTimeId?: string;
  courseName?: string;
  dateTime?: FirebaseTimestamp | null;
  addedAt: FirebaseTimestamp | null;
}

// For backward compatibility - original feed item interface
export interface FeedItem {
  postId: string;
  authorId: string;
  author: DenormalizedAuthorData;
  postType: string;
  content: string;
  media?: Media[];
  createdAt: FirebaseTimestamp | null;
  likes: number;
  comments: number;
  hashtags?: string[];
  location?: Location;
  roundId?: string;
  teeTimeId?: string;
  courseName?: string;
  dateTime?: FirebaseTimestamp | null;
  addedAt?: FirebaseTimestamp;
}