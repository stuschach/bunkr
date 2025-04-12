// src/lib/firebase/feed-service.ts
import { 
  collection, 
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  where, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter, 
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Post, DenormalizedAuthorData, Media, FeedQueryResult } from '@/types/post';
import { Scorecard } from '@/types/scorecard';

// Define feed item interface
interface FeedItem {
  postId: string;
  authorId: string;
  author: DenormalizedAuthorData;
  postType: string;
  content: string;
  media: Media[];
  createdAt: Timestamp | null;
  likes: number;
  comments: number;
  hashtags: string[];
  location?: any;
  roundId?: string;
  teeTimeId?: string;
  courseName?: string;
  dateTime?: Timestamp | null;
  // Add fields for round summary data
  coursePar?: number;
  scoreToPar?: number;
  totalScore?: number;
  statsSummary?: {
    totalPutts?: number;
    fairwaysHit?: number;
    fairwaysTotal?: number;
    greensInRegulation?: number;
    eagles?: number;
    birdies?: number;
    pars?: number;
    bogeys?: number;
    doubleBogeys?: number;
    worseThanDouble?: number;
  };
  teeBoxSummary?: {
    name: string;
    color?: string;
    yardage?: number;
  };
}

/**
 * Helper function to normalize content type filter to match database values
 */
const normalizeContentTypeFilter = (filter: 'all' | 'posts' | 'rounds' | 'tee-times'): string => {
  switch(filter) {
    case 'posts':
      return 'regular';
    case 'rounds':
      return 'round';
    case 'tee-times':
      return 'tee-time';
    default:
      return filter;
  }
};

/**
 * Fan out a post to all followers' feeds
 * This is called whenever a post is created
 */
export async function fanoutPostToFeeds(
  postId: string, 
  authorId: string, 
  authorData: DenormalizedAuthorData,
  postType: string = 'regular'
): Promise<void> {
  try {
    // Get all followers of the author
    const followersQuery = query(
      collection(db, 'users', authorId, 'connections'),
      where('type', '==', 'follower'),
      where('active', '==', true)
    );
    
    const followersSnapshot = await getDocs(followersQuery);
    const followerIds: string[] = followersSnapshot.docs.map(doc => doc.data().userId as string);
    
    // Get the original post data
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) {
      throw new Error('Post not found for fanout');
    }
    
    const postData = postDoc.data();
    
    // Prepare denormalized post data - base fields
    const feedItem: FeedItem = {
      postId,
      authorId,
      author: authorData,
      postType,
      content: postData.content || '',
      media: postData.media || [],
      createdAt: postData.createdAt || null,
      likes: postData.likes || 0,
      comments: postData.comments || 0,
      hashtags: postData.hashtags || [],
    };

    // Conditionally add optional fields only if they exist
    if (postData.location) feedItem.location = postData.location;
    if (postData.roundId) feedItem.roundId = postData.roundId;
    if (postData.teeTimeId) feedItem.teeTimeId = postData.teeTimeId;
    if (postData.courseName) feedItem.courseName = postData.courseName;
    if (postData.dateTime) feedItem.dateTime = postData.dateTime;
    
    // For round posts, add summary data without full hole details
    if (postType === 'round') {
      // Add basic round data
      if (postData.coursePar !== undefined) feedItem.coursePar = postData.coursePar;
      if (postData.scoreToPar !== undefined) feedItem.scoreToPar = postData.scoreToPar;
      if (postData.totalScore !== undefined) feedItem.totalScore = postData.totalScore;
      
      // Add tee box summary
      if (postData.teeBox) {
        feedItem.teeBoxSummary = {
          name: postData.teeBox.name || 'Default',
          color: postData.teeBox.color,
          yardage: postData.teeBox.yardage
        };
      }
      
      // Add stats summary
      if (postData.stats) {
        feedItem.statsSummary = {
          totalPutts: postData.stats.totalPutts,
          fairwaysHit: postData.stats.fairwaysHit,
          fairwaysTotal: postData.stats.fairwaysTotal,
          greensInRegulation: postData.stats.greensInRegulation,
          eagles: postData.stats.eagles,
          birdies: postData.stats.birdies,
          pars: postData.stats.pars,
          bogeys: postData.stats.bogeys,
          doubleBogeys: postData.stats.doubleBogeys,
          worseThanDouble: postData.stats.worseThanDouble
        };
      }
    }

    // Use batched writes for efficiency
    const BATCH_SIZE = 450; // Leave some room for other operations
    
    // Split follower IDs into batches
    for (let i = 0; i < followerIds.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchFollowers = followerIds.slice(i, i + BATCH_SIZE);
      
      // Add post to each follower's feed
      for (const followerId of batchFollowers) {
        const feedRef = doc(collection(db, 'feeds', followerId, 'posts'));
        batch.set(feedRef, {
          ...feedItem,
          addedAt: serverTimestamp()
        });
      }
      
      // Also add to author's own feed
      if (i === 0) {
        const authorFeedRef = doc(collection(db, 'feeds', authorId, 'posts'));
        batch.set(authorFeedRef, {
          ...feedItem,
          addedAt: serverTimestamp()
        });
      }
      
      // Commit this batch
      await batch.commit();
    }
    
    console.log(`Post ${postId} fanned out to ${followerIds.length} followers`);
  } catch (error) {
    console.error('Error in fanout operation:', error);
    throw error;
  }
}

/**
 * Fetch a complete round by ID
 */
export async function fetchFullRoundData(roundId: string): Promise<Scorecard | null> {
  try {
    const roundRef = doc(db, 'scorecards', roundId);
    const roundSnap = await getDoc(roundRef);
    
    if (!roundSnap.exists()) {
      console.error(`Round with ID ${roundId} not found`);
      return null;
    }
    
    const data = roundSnap.data();
    return {
      id: roundSnap.id,
      ...data
    } as Scorecard;
  } catch (error) {
    console.error('Error fetching full round data:', error);
    return null;
  }
}

/**
 * Remove a post from all feeds when it's deleted
 */
export async function removePostFromFeeds(postId: string): Promise<void> {
  // This is simplified and would need to be implemented for production
  console.log(`Post ${postId} should be removed from all feeds`);
}

/**
 * Update a post in all feeds when it's edited
 */
export async function updatePostInFeeds(
  postId: string,
  updates: Partial<Post>
): Promise<void> {
  // This is simplified and would need to be implemented for production
  console.log(`Post ${postId} should be updated in all feeds with:`, updates);
}

/**
 * Fetch feed for a user with pagination
 */
export async function getFeedForUser(
  userId: string,
  contentTypeFilter: 'all' | 'posts' | 'rounds' | 'tee-times' = 'all',
  lastVisible: QueryDocumentSnapshot<DocumentData> | null = null,
  pageSize: number = 10
): Promise<FeedQueryResult> {
  try {
    // Build base query for user's feed - start with collection reference
    const feedCollection = collection(db, 'feeds', userId, 'posts');
    
    // Prepare query constraints based on filter type
    const queryConstraints = [];
    
    // Add content type filter if needed
    if (contentTypeFilter !== 'all') {
      // Normalize the filter to match database values
      const normalizedFilter = normalizeContentTypeFilter(contentTypeFilter);
      queryConstraints.push(where('postType', '==', normalizedFilter));
    }
    
    // Always add ordering by createdAt
    queryConstraints.push(orderBy('createdAt', 'desc'));
    
    // Add pagination if lastVisible is provided
    if (lastVisible) {
      queryConstraints.push(startAfter(lastVisible));
    }
    
    // Add limit as the last constraint
    queryConstraints.push(limit(pageSize));
    
    // Build the final query with all constraints
    const feedQuery = query(feedCollection, ...queryConstraints);
    
    // Execute query
    const querySnapshot = await getDocs(feedQuery);
    
    // Log for debugging (remove in production)
    console.log(`Fetched ${querySnapshot.docs.length} posts for page with lastVisible: ${lastVisible?.id || 'none'}`);
    
    // Process results
    const posts = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convert Firestore timestamps to Date objects
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
      let dateTime = null;
      if (data.dateTime && data.dateTime.toDate) {
        dateTime = data.dateTime.toDate();
      }
      
      // Create the post object with safe null checks
      const post: Post = {
        id: data.postId,
        authorId: data.authorId,
        author: data.author,
        content: data.content || '',
        media: data.media || [],
        createdAt,
        postType: data.postType || 'regular',
        visibility: data.visibility || 'public',
        likes: data.likes || 0,
        comments: data.comments || 0,
        likedByUser: false, // Will be set client-side
        hashtags: data.hashtags || [],
      };

      // Add optional properties if they exist in the data
      if (data.location) post.location = data.location;
      if (data.roundId) post.roundId = data.roundId;
      if (data.teeTimeId) post.teeTimeId = data.teeTimeId;
      if (data.courseName) post.courseName = data.courseName;
      if (dateTime) post.dateTime = dateTime;
      
      // Add round summary data from feed item to post
      if (post.postType === 'round') {
        if (data.coursePar !== undefined) post.coursePar = data.coursePar;
        if (data.scoreToPar !== undefined) post.scoreToPar = data.scoreToPar;
        if (data.totalScore !== undefined) post.totalScore = data.totalScore;
        
        // Map statsSummary to stats
        if (data.statsSummary) {
          post.stats = data.statsSummary;
        }
        
        // Map teeBoxSummary to teeBox
        if (data.teeBoxSummary) {
          post.teeBox = data.teeBoxSummary;
        }
      }
      
      return post;
    });
    
    // Set lastVisible for pagination - ensure we're grabbing the actual document
    const newLastVisible = querySnapshot.docs.length > 0
      ? querySnapshot.docs[querySnapshot.docs.length - 1]
      : null;
      
    // Debug logging of lastVisible reference (remove in production)
    if (newLastVisible) {
      console.log('Setting new lastVisible document with ID:', newLastVisible.id);
    }
    
    // Updated return statement with improved hasMore logic
    return {
      posts,
      lastVisible: newLastVisible,
      hasMore: querySnapshot.docs.length === pageSize && newLastVisible !== null
    };
  } catch (error) {
    console.error('Error fetching feed:', error);
    throw error;
  }
}

/**
 * Subscribe to feed updates for real-time feed
 */
export function subscribeFeedForUser(
  userId: string,
  contentTypeFilter: 'all' | 'posts' | 'rounds' | 'tee-times' = 'all',
  pageSize: number = 10,
  callback: (posts: Post[]) => void
): () => void {
  // Build query
  let feedQuery = query(
    collection(db, 'feeds', userId, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );
  
  // Add content type filter if needed
  if (contentTypeFilter !== 'all') {
    // Normalize the filter to match database values
    const normalizedFilter = normalizeContentTypeFilter(contentTypeFilter);
    
    feedQuery = query(
      collection(db, 'feeds', userId, 'posts'),
      where('postType', '==', normalizedFilter),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
  }
  
  // Create subscription
  const unsubscribe = onSnapshot(feedQuery, (snapshot) => {
    const posts = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convert Firestore timestamps to Date objects
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
      let dateTime = null;
      if (data.dateTime && data.dateTime.toDate) {
        dateTime = data.dateTime.toDate();
      }
      
      // Create the post object with safe null checks
      const post: Post = {
        id: data.postId,
        authorId: data.authorId,
        author: data.author,
        content: data.content || '',
        media: data.media || [],
        createdAt,
        postType: data.postType || 'regular',
        visibility: data.visibility || 'public',
        likes: data.likes || 0,
        comments: data.comments || 0,
        likedByUser: false, // Will be set client-side
        hashtags: data.hashtags || [],
      };

      // Add optional properties if they exist in the data
      if (data.location) post.location = data.location;
      if (data.roundId) post.roundId = data.roundId;
      if (data.teeTimeId) post.teeTimeId = data.teeTimeId;
      if (data.courseName) post.courseName = data.courseName;
      if (dateTime) post.dateTime = dateTime;
      
      // Add round summary data from feed item to post
      if (post.postType === 'round') {
        if (data.coursePar !== undefined) post.coursePar = data.coursePar;
        if (data.scoreToPar !== undefined) post.scoreToPar = data.scoreToPar;
        if (data.totalScore !== undefined) post.totalScore = data.totalScore;
        
        // Map statsSummary to stats
        if (data.statsSummary) {
          post.stats = data.statsSummary;
        }
        
        // Map teeBoxSummary to teeBox
        if (data.teeBoxSummary) {
          post.teeBox = data.teeBoxSummary;
        }
      }
      
      return post;
    });
    
    callback(posts);
  }, (error) => {
    console.error('Error in feed subscription:', error);
  });
  
  return unsubscribe;
}

/**
 * Update like status in the original post and in feeds
 */
export async function togglePostLike(
  postId: string, 
  userId: string, 
  currentLikedStatus: boolean
): Promise<boolean> {
  try {
    // Create a batch
    const batch = writeBatch(db);
    
    // Update the original post
    const postRef = doc(db, 'posts', postId);
    batch.update(postRef, {
      likes: increment(currentLikedStatus ? -1 : 1),
      likedBy: currentLikedStatus ? arrayRemove(userId) : arrayUnion(userId)
    });
    
    // Commit the batch
    await batch.commit();
    
    // Return new liked status
    return !currentLikedStatus;
  } catch (error) {
    console.error('Error toggling like status:', error);
    throw error;
  }
}