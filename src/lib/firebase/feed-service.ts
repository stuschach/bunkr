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
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Post, DenormalizedAuthorData, Media, FeedQueryResult } from '@/types/post';
import { Scorecard } from '@/types/scorecard';

// Lightweight feed item interface - only storing references and minimal metadata
interface FeedItem {
  postId: string;
  authorId: string;
  author: DenormalizedAuthorData; // Keep minimal author data for rendering
  postType: string;
  createdAt: Timestamp | null;
  visibility: string;
  // Only keep metadata needed for filtering and basic rendering
  roundId?: string;
  teeTimeId?: string;
  courseName?: string;
  dateTime?: Timestamp | null;
  // Timestamp for when it was added to the feed
  addedAt: Timestamp | null;
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
 * Fan out a post reference to all followers' feeds
 * This now only stores a reference to the post with minimal metadata
 */
export async function fanoutPostToFeeds(
  postId: string, 
  authorId: string, 
  authorData: DenormalizedAuthorData,
  postType: string = 'regular'
): Promise<void> {
  try {
    // Ensure author data is complete
    console.log('Fanout with author data:', authorData);
    
    if (!authorData.displayName) {
      console.warn('Author displayName is missing in fanout for post', postId);
      // Try to fetch author data if missing
      try {
        const authorDoc = await getDoc(doc(db, 'users', authorId));
        if (authorDoc.exists()) {
          authorData = {
            uid: authorId,
            displayName: authorDoc.data().displayName || 'Unknown User',
            photoURL: authorDoc.data().photoURL || null,
            handicapIndex: authorDoc.data().handicapIndex || null
          };
        }
      } catch (error) {
        console.error('Error fetching author data:', error);
      }
    }
    
    // Get all followers of the author
    const followersQuery = query(
      collection(db, 'users', authorId, 'connections'),
      where('type', '==', 'follower'),
      where('active', '==', true)
    );
    
    const followersSnapshot = await getDocs(followersQuery);
    const followerIds: string[] = followersSnapshot.docs.map(doc => doc.data().userId as string);
    
    // Get the minimal post data we need
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) {
      throw new Error('Post not found for fanout');
    }
    
    const postData = postDoc.data();
    
    // Prepare lightweight feed item with only essential fields
    const feedItem: Partial<FeedItem> = {
      postId,
      authorId,
      author: authorData,
      postType,
      createdAt: postData.createdAt || null,
      visibility: postData.visibility || 'public',
      addedAt: serverTimestamp(),
    };

    // Conditionally add optional fields only if they exist
    if (postData.roundId) feedItem.roundId = postData.roundId;
    if (postData.teeTimeId) feedItem.teeTimeId = postData.teeTimeId;
    if (postData.courseName) feedItem.courseName = postData.courseName;
    if (postData.dateTime) feedItem.dateTime = postData.dateTime;

    // Use batched writes for efficiency
    const BATCH_SIZE = 450; // Leave some room for other operations
    
    // Split follower IDs into batches
    for (let i = 0; i < followerIds.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchFollowers = followerIds.slice(i, i + BATCH_SIZE);
      
      // Add reference to each follower's feed
      for (const followerId of batchFollowers) {
        const feedRef = doc(collection(db, 'feeds', followerId, 'posts'));
        batch.set(feedRef, feedItem);
      }
      
      // Also add to author's own feed
      if (i === 0) {
        const authorFeedRef = doc(collection(db, 'feeds', authorId, 'posts'));
        batch.set(authorFeedRef, feedItem);
      }
      
      // Commit this batch
      await batch.commit();
    }
    
    console.log(`Post ${postId} references fanned out to ${followerIds.length} followers`);
  } catch (error) {
    console.error('Error in fanout operation:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time updates for a specific post
 * This allows clients to get live updates on likes, comments, etc.
 * UPDATED: Now properly handles deleted posts
 */
export function subscribeToPost(
  postId: string,
  callback: (post: Partial<Post> | null) => void
): () => void {
  const postRef = doc(db, 'posts', postId);
  console.log(`Setting up subscription for post ${postId}`);
  
  // Set up real-time listener for the post
  const unsubscribe = onSnapshot(postRef, 
    // Success handler
    (snapshot) => {
      if (!snapshot.exists()) {
        console.info(`Post ${postId} not found in subscription`);
        callback(null); // Indicate post doesn't exist
        return;
      }
      
      const data = snapshot.data();
      console.log(`Received update for post ${postId}:`, {
        likes: data.likes || 0,
        comments: data.comments || 0,
        likedBy: Array.isArray(data.likedBy) ? `Array with ${data.likedBy.length} items` : 'Not an array'
      });
      
      // Check if post is marked as deleted
      if (data.isDeleted) {
        console.info(`Post ${postId} is marked as deleted`);
        callback(null);
        return;
      }
      
      // Return only the interaction data and counters
      // This keeps network traffic minimal
      callback({
        id: postId,
        likes: data.likes || 0,
        comments: data.comments || 0,
        likedBy: data.likedBy || [],
      });
    }, 
    // Error handler
    (error) => {
      console.error(`Error subscribing to post ${postId}:`, error);
      callback(null); // Indicate post doesn't exist or there was an error
    }
  );
  
  return unsubscribe;
}

/**
 * Subscribe to multiple posts at once for efficient batching
 */
export function subscribeToPosts(
  postIds: string[],
  callback: (updates: Partial<Post>[]) => void
): () => void {
  if (!postIds.length) {
    return () => {}; // No-op if no posts
  }
  
  console.log(`Setting up batch subscription for ${postIds.length} posts`);
  
  // Set up individual listeners and track them
  const unsubscribes: (() => void)[] = [];
  const latestPostData = new Map<string, Partial<Post>>();
  
  // Throttle updates to reduce callback frequency
  let updateScheduled = false;
  
  const scheduleUpdate = () => {
    if (updateScheduled) return;
    
    updateScheduled = true;
    setTimeout(() => {
      updateScheduled = false;
      callback(Array.from(latestPostData.values()));
      latestPostData.clear();
    }, 100); // Batch updates with 100ms throttle
  };
  
  postIds.forEach(postId => {
    const unsubscribe = subscribeToPost(postId, (postUpdate) => {
      // Skip null updates from deleted posts
      if (postUpdate === null) {
        return;
      }
      
      latestPostData.set(postId, postUpdate);
      scheduleUpdate();
    });
    
    unsubscribes.push(unsubscribe);
  });
  
  // Return function to unsubscribe from all
  return () => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
  };
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
 * Fetch complete post data
 * This retrieves all details for a post when needed
 * UPDATED: Now uses info logging for deleted posts instead of error
 */
export async function fetchPostDetails(postId: string): Promise<Post | null> {
  try {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) {
      // Changed from error to info level - this is now an expected case
      console.info(`Post ${postId} not found - may have been deleted`);
      return null;
    }
    
    const data = postSnap.data();
    
    // Check if post is marked as deleted
    if (data.isDeleted) {
      console.info(`Post ${postId} is marked as deleted`);
      return null;
    }
    
    // If author data is missing or incomplete, fetch it from the users collection
    let authorData = data.author;
    if (!authorData || !authorData.displayName) {
      try {
        const authorId = data.authorId;
        if (authorId) {
          console.log(`Fetching missing author data for post ${postId} by user ${authorId}`);
          const authorDoc = await getDoc(doc(db, 'users', authorId));
          if (authorDoc.exists()) {
            authorData = {
              uid: authorId,
              displayName: authorDoc.data().displayName || 'Unknown User',
              photoURL: authorDoc.data().photoURL || null,
              handicapIndex: authorDoc.data().handicapIndex || null
            };
            
            // Update the post with the correct author data for future retrievals
            try {
              await updateDoc(postRef, { author: authorData });
              console.log(`Updated post ${postId} with correct author data`);
            } catch (updateError) {
              console.error('Error updating post with author data:', updateError);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching author data:', error);
      }
    }
    
    // Convert Firestore timestamps to Date objects
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
    let dateTime = null;
    if (data.dateTime && data.dateTime.toDate) {
      dateTime = data.dateTime.toDate();
    }
    
    // Create the post object with safe null checks
    const post: Post = {
      id: postId,
      authorId: data.authorId,
      author: authorData, // Use either the existing author data or the one we just fetched
      content: data.content || '',
      media: data.media || [],
      createdAt,
      postType: data.postType || 'regular',
      visibility: data.visibility || 'public',
      likes: data.likes || 0,
      comments: data.comments || 0,
      likedBy: data.likedBy || [],
      likedByUser: false, // Will be set client-side
      hashtags: data.hashtags || [],
    };

    // Add optional properties if they exist in the data
    if (data.location) post.location = data.location;
    if (data.roundId) post.roundId = data.roundId;
    if (data.teeTimeId) post.teeTimeId = data.teeTimeId;
    if (data.courseName) post.courseName = data.courseName;
    if (dateTime) post.dateTime = dateTime;
    
    // Add round data fields if present
    if (data.stats) post.stats = data.stats;
    if (data.coursePar !== undefined) post.coursePar = data.coursePar;
    if (data.totalScore !== undefined) post.totalScore = data.totalScore;
    if (data.teeBox) post.teeBox = data.teeBox;
    
    return post;
  } catch (error) {
    console.error('Error fetching post details:', error);
    return null;
  }
}

/**
 * Remove a post from all feeds when it's deleted
 */
export async function removePostFromFeeds(postId: string): Promise<void> {
  // This function is no longer needed - cleanup is handled by Cloud Functions
  console.log(`Post ${postId} will be removed from all feeds by Cloud Functions`);
}

/**
 * This function remains for reference but we no longer call it
 * Cleanup is now handled by the Cloud Function
 */
export async function cleanupDeletedPostReferences(
  userId: string, 
  deletedPostIds: string[]
): Promise<void> {
  console.log(`Cleanup for ${deletedPostIds.length} deleted posts will be handled by Cloud Functions`);
  // Function remains for reference but is not called
}

/**
 * Fetch feed for a user with pagination
 * UPDATED: No longer attempts client-side cleanup
 */
export async function getFeedForUser(
  userId: string,
  contentTypeFilter: 'all' | 'posts' | 'rounds' | 'tee-times' = 'all',
  lastVisible: QueryDocumentSnapshot<DocumentData> | null = null,
  pageSize: number = 10
): Promise<FeedQueryResult> {
  try {
    console.log(`Fetching feed for user ${userId} with filter ${contentTypeFilter}, page size ${pageSize}`);
    
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
    
    // Log for debugging
    console.log(`Fetched ${querySnapshot.docs.length} feed items`);
    
    // Process results and fetch full post data for each feed item
    const postsPromises = querySnapshot.docs.map(async doc => {
      const feedData = doc.data();
      return { feedDoc: doc, post: await fetchPostDetails(feedData.postId) };
    });
    
    // Process posts in parallel for better performance
    const results = await Promise.all(postsPromises);
    
    // Track deleted post IDs for reporting only
    const deletedPostIds: string[] = [];
    
    // Extract valid posts and track deleted ones
    const validPosts: Post[] = [];
    results.forEach(result => {
      if (result.post) {
        validPosts.push(result.post);
      } else {
        // Track the deleted post ID from the feed document
        const postId = result.feedDoc.data().postId;
        deletedPostIds.push(postId);
      }
    });
    
    // Verify post fetch success rate
    console.log(`Successfully fetched ${validPosts.length} out of ${querySnapshot.docs.length} posts`);
    
    // Log deleted posts but don't attempt client-side cleanup
    if (deletedPostIds.length > 0) {
      console.log(`Found ${deletedPostIds.length} deleted posts in feed - cleanup will be handled by Cloud Functions`);
    }
    
    // Handle user like status
    validPosts.forEach(post => {
      if (post.likedBy && Array.isArray(post.likedBy)) {
        post.likedByUser = post.likedBy.includes(userId);
      }
    });
    
    // Set lastVisible for pagination - ensure we're grabbing the actual document
    const newLastVisible = querySnapshot.docs.length > 0
      ? querySnapshot.docs[querySnapshot.docs.length - 1]
      : null;
      
    // Updated return statement with improved hasMore logic
    return {
      posts: validPosts,
      lastVisible: newLastVisible,
      hasMore: querySnapshot.docs.length === pageSize && newLastVisible !== null
    };
  } catch (error) {
    console.error('Error fetching feed:', error);
    throw error;
  }
}

/**
 * Check for new posts since a given timestamp
 * Used for the Twitter-style "New posts available" notification
 */
export async function checkForNewPosts(
  userId: string,
  contentTypeFilter: 'all' | 'posts' | 'rounds' | 'tee-times' = 'all',
  sinceTime: Date
): Promise<{ count: number; posts: Post[] }> {
  try {
    console.log(`Checking for new posts since ${sinceTime.toISOString()}`);
    
    // Convert JavaScript Date to Firestore Timestamp
    const timestamp = Timestamp.fromDate(sinceTime);
    
    // Build query to check for new posts
    const feedCollection = collection(db, 'feeds', userId, 'posts');
    
    // Prepare query constraints
    const queryConstraints = [
      where('createdAt', '>', timestamp),
      orderBy('createdAt', 'desc'),
      limit(10) // Limit to 10 new posts for efficiency
    ];
    
    // Add content type filter if needed
    if (contentTypeFilter !== 'all') {
      // Normalize the filter to match database values
      const normalizedFilter = normalizeContentTypeFilter(contentTypeFilter);
      queryConstraints.push(where('postType', '==', normalizedFilter));
    }
    
    // Execute the query
    const feedQuery = query(feedCollection, ...queryConstraints);
    const querySnapshot = await getDocs(feedQuery);
    
    // If no new posts, return empty result
    if (querySnapshot.empty) {
      return { count: 0, posts: [] };
    }
    
    // Process results to fetch full post data
    const postsPromises = querySnapshot.docs.map(async doc => {
      const feedData = doc.data();
      return fetchPostDetails(feedData.postId);
    });
    
    // Wait for all post details to be fetched
    const posts = await Promise.all(postsPromises);
    
    // Filter out any null posts (failed to fetch or deleted)
    const validPosts = posts.filter(post => post !== null) as Post[];
    
    // Process user likes
    validPosts.forEach(post => {
      if (post.likedBy && Array.isArray(post.likedBy)) {
        post.likedByUser = post.likedBy.includes(userId);
      }
    });
    
    console.log(`Found ${validPosts.length} new posts since ${sinceTime.toISOString()}`);
    
    return {
      count: validPosts.length,
      posts: validPosts
    };
  } catch (error) {
    console.error('Error checking for new posts:', error);
    return { count: 0, posts: [] };
  }
}

/**
 * Subscribe to feed updates for real-time feed
 * UPDATED: No longer attempts client-side cleanup
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
  const unsubscribe = onSnapshot(feedQuery, async (snapshot) => {
    try {
      // Track deleted post IDs for logging only
      const deletedPostIds: string[] = [];
      
      // Process feed items and fetch full post data
      const postsPromises = snapshot.docs.map(async doc => {
        const feedData = doc.data();
        const post = await fetchPostDetails(feedData.postId);
        
        // Track deleted posts
        if (!post) {
          deletedPostIds.push(feedData.postId);
        }
        
        return post;
      });
      
      const posts = await Promise.all(postsPromises);
      
      // Filter out any null posts (failed to fetch or deleted)
      const validPosts = posts.filter(post => post !== null) as Post[];
      
      // Check if each post is liked by current user
      validPosts.forEach(post => {
        if (post.likedBy && Array.isArray(post.likedBy)) {
          post.likedByUser = post.likedBy.includes(userId);
        }
      });
      
      // Log deleted posts but don't attempt client-side cleanup
      if (deletedPostIds.length > 0) {
        console.log(`Found ${deletedPostIds.length} deleted posts in feed subscription - cleanup will be handled by Cloud Functions`);
      }
      
      callback(validPosts);
    } catch (error) {
      console.error('Error processing feed updates:', error);
    }
  }, (error) => {
    console.error('Error in feed subscription:', error);
  });
  
  return unsubscribe;
}

/**
 * Update like status in the original post document only
 * This is much more efficient than updating copies in feeds
 * Enhanced with robust retry logic and error handling
 */
export async function togglePostLike(
  postId: string, 
  userId: string, 
  currentLikedStatus: boolean,
  maxRetries = 3
): Promise<boolean> {
  let retries = 0;
  
  // Add exponential backoff with retries
  while (retries < maxRetries) {
    try {
      // Verify the post exists first
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      
      if (!postSnap.exists()) {
        console.error(`Post ${postId} not found when trying to toggle like`);
        throw new Error(`Post ${postId} not found`);
      }
      
      // Check if post is deleted
      const postData = postSnap.data();
      if (postData.isDeleted) {
        console.error(`Post ${postId} is deleted, cannot toggle like`);
        throw new Error(`Post ${postId} is deleted`);
      }
      
      // Check if the current status matches what we expect
      const likedByArray = postData.likedBy || [];
      const userHasLiked = likedByArray.includes(userId);
      
      // If the state doesn't match what we expected, log and use actual state
      if (userHasLiked !== currentLikedStatus) {
        console.warn(`Like status mismatch for post ${postId}. Expected: ${currentLikedStatus}, Actual: ${userHasLiked}`);
        currentLikedStatus = userHasLiked;
      }
      
      // Update the post with atomic operations
      await updateDoc(postRef, {
        likes: increment(currentLikedStatus ? -1 : 1),
        likedBy: currentLikedStatus ? arrayRemove(userId) : arrayUnion(userId)
      });
      
      console.log(`Successfully toggled like for post ${postId}. New status: ${!currentLikedStatus}`);
      
      // Return new liked status
      return !currentLikedStatus;
    } catch (error) {
      console.error(`Attempt ${retries + 1} failed to toggle like for post ${postId}:`, error);
      retries++;
      
      if (retries >= maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retries)));
    }
  }
  
  // This should never be reached due to the throw above
  throw new Error(`Max retries (${maxRetries}) exceeded toggling like for post ${postId}`);
}

/**
 * Add a comment to a post with retry logic
 */
export async function addCommentToPost(
  postId: string,
  userId: string,
  commentText: string,
  maxRetries = 3
): Promise<string> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      // First verify the post exists
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      
      if (!postSnap.exists()) {
        console.error(`Post ${postId} not found when trying to add comment`);
        throw new Error(`Post ${postId} not found`);
      }
      
      // Check if post is deleted
      const postData = postSnap.data();
      if (postData.isDeleted) {
        console.error(`Post ${postId} is deleted, cannot add comment`);
        throw new Error(`Post ${postId} is deleted`);
      }
      
      // Add comment to the comments subcollection
      const commentRef = await addDoc(collection(db, 'posts', postId, 'comments'), {
        authorId: userId,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
        likes: 0
      });

      // Update the comment count on the post (single write)
      await updateDoc(postRef, {
        comments: increment(1)
      });
      
      console.log(`Comment added to post ${postId} with ID ${commentRef.id}`);
      return commentRef.id;
    } catch (error) {
      console.error(`Attempt ${retries + 1} failed to add comment to post ${postId}:`, error);
      retries++;
      
      if (retries >= maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retries)));
    }
  }
  
  // This should never be reached due to the throw above
  throw new Error(`Max retries (${maxRetries}) exceeded adding comment to post ${postId}`);
}

/**
 * Fetch comments for a post with retry logic
 */
export async function getPostComments(
  postId: string,
  limit_: number = 20,
  maxRetries = 2
): Promise<any[]> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      // Check if post exists first
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      
      if (!postSnap.exists()) {
        console.error(`Post ${postId} not found when fetching comments`);
        return [];
      }
      
      // Check if post is deleted
      const postData = postSnap.data();
      if (postData.isDeleted) {
        console.error(`Post ${postId} is deleted, cannot fetch comments`);
        return [];
      }
      
      const commentsQuery = query(
        collection(db, 'posts', postId, 'comments'),
        orderBy('createdAt', 'desc'),
        limit(limit_)
      );
      
      const commentsSnapshot = await getDocs(commentsQuery);
      
      // Process and return comments
      return commentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error(`Attempt ${retries + 1} failed to fetch comments for post ${postId}:`, error);
      retries++;
      
      if (retries >= maxRetries) {
        throw error;
      }
      
      // Short backoff for read operations
      await new Promise(resolve => setTimeout(resolve, 300 * Math.pow(2, retries)));
    }
  }
  
  // Return empty array if all retries fail
  console.error(`All retries failed to fetch comments for post ${postId}`);
  return [];
}

/**
 * Subscribe to comments for a post
 */
export function subscribeToComments(
  postId: string,
  callback: (comments: any[]) => void,
  limit_: number = 20
): () => void {
  console.log(`Setting up comment subscription for post ${postId}`);
  
  // First check if post exists and is not deleted
  const postRef = doc(db, 'posts', postId);
  
  getDoc(postRef).then(postSnap => {
    if (!postSnap.exists()) {
      console.info(`Post ${postId} not found when subscribing to comments`);
      callback([]); // Return empty comments
      return;
    }
    
    // Check if post is deleted
    const postData = postSnap.data();
    if (postData.isDeleted) {
      console.info(`Post ${postId} is deleted, cannot subscribe to comments`);
      callback([]);
      return;
    }
  }).catch(error => {
    console.error(`Error checking post ${postId} before comment subscription:`, error);
  });
  
  const commentsQuery = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'desc'),
    limit(limit_)
  );
  
  const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
    const comments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Received ${comments.length} comments for post ${postId}`);
    callback(comments);
  }, (error) => {
    console.error(`Error in comments subscription for post ${postId}:`, error);
  });
  
  return unsubscribe;
}

/**
 * Bulk fetch posts by IDs
 * Useful for preloading data
 */
export async function fetchPostsByIds(
  postIds: string[]
): Promise<Map<string, Post>> {
  if (!postIds.length) return new Map();
  
  try {
    // Process in chunks to avoid exceeding Firestore limits
    const CHUNK_SIZE = 10;
    const result = new Map<string, Post>();
    
    for (let i = 0; i < postIds.length; i += CHUNK_SIZE) {
      const chunk = postIds.slice(i, i + CHUNK_SIZE);
      
      // Create post promises for this chunk
      const postPromises = chunk.map(async postId => {
        try {
          const post = await fetchPostDetails(postId);
          if (post) {
            result.set(postId, post);
          }
        } catch (error) {
          console.error(`Error fetching post ${postId}:`, error);
        }
      });
      
      // Wait for all posts in this chunk
      await Promise.all(postPromises);
    }
    
    console.log(`Bulk fetched ${result.size} posts out of ${postIds.length} requested`);
    return result;
  } catch (error) {
    console.error('Error in bulk post fetch:', error);
    throw error;
  }
}