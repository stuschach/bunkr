// src/lib/hooks/useFeedItems.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter, 
  DocumentData,
  QueryDocumentSnapshot,
  getDoc,
  doc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Post, Media } from '@/types/post';
import { UserProfile } from '@/types/auth';
import { Scorecard } from '@/types/scorecard';

interface UseFeedItemsOptions {
  filter?: 'all' | 'following';
  contentTypeFilter?: 'all' | 'posts' | 'rounds' | 'tee-times';
  pageSize?: number;
}

// Define a custom type for Firestore post data that doesn't yet have author populated
interface FirestorePostData {
  authorId: string;
  content: string;
  media?: Media[];
  createdAt: any; // Can be Timestamp or null
  updatedAt?: any;
  postType: 'regular' | 'round' | 'event' | 'marketplace' | 'tee-time';
  visibility: 'public' | 'followers' | 'private';
  likes: number;
  comments: number;
  likedBy?: string[];
  hashtags?: string[];
  location?: any;
  roundId?: string;
  eventId?: string;
  marketplaceId?: string;
  teeTimeId?: string;
  courseName?: string;
  dateTime?: any;
  maxPlayers?: number;
}

export function useFeedItems({
  filter = 'all',
  contentTypeFilter = 'all',
  pageSize = 5
}: UseFeedItemsOptions = {}) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  
  // Use state for UI indicators that need to trigger re-renders
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use refs for values that shouldn't trigger recreation of callbacks
  const isFetchingRef = useRef(false);
  const lastVisibleRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const hasMoreRef = useRef(true);
  const lastFetchTimeRef = useRef(0);
  const isMountedRef = useRef(true);
  
  // Helper function to fetch user data
  const fetchUserData = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return { uid: userDoc.id, ...userDoc.data() } as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }, []);

  // Helper function to fetch round data
  const fetchRoundData = useCallback(async (roundId: string): Promise<Scorecard | null> => {
    try {
      const roundDoc = await getDoc(doc(db, 'scorecards', roundId));
      if (roundDoc.exists()) {
        const roundData = roundDoc.data();
        
        // Handle date conversion
        let dateValue: string | Date = new Date();
        if (roundData.date) {
          if (roundData.date instanceof Timestamp) {
            dateValue = roundData.date.toDate();
          } else if (typeof roundData.date === 'string') {
            dateValue = new Date(roundData.date);
          }
        }
        
        return { 
          id: roundDoc.id, 
          ...roundData,
          date: dateValue instanceof Date ? dateValue.toISOString() : dateValue
        } as Scorecard;
      }
      return null;
    } catch (error) {
      console.error('Error fetching round data:', error);
      return null;
    }
  }, []);

  // Function to fetch full hole-by-hole data
  const fetchFullRoundData = useCallback(async (roundId: string): Promise<{ holes: any[] } | null> => {
    try {
      const roundDoc = await getDoc(doc(db, 'scorecards', roundId));
      if (roundDoc.exists()) {
        const data = roundDoc.data();
        return {
          holes: data.holes || []
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching full round data:', error);
      return null;
    }
  }, []);

  // Fetch posts function with strict controls and fewer dependencies
  const fetchPosts = useCallback(async (isInitial = false) => {
    // Skip if already fetching, no user, or explicitly loading
    if (isFetchingRef.current || !user) {
      console.log('Skipping fetch: already fetching or no user');
      return;
    }
    
    // If we know there are no more posts, don't fetch
    if (!isInitial && !hasMoreRef.current) {
      console.log('Skipping fetch: no more posts to load');
      return;
    }
    
    // Debounce mechanism to prevent rapid consecutive requests
    if (Date.now() - lastFetchTimeRef.current < 500) {
      console.log('Skipping fetch: too soon after last fetch');
      return;
    }
    lastFetchTimeRef.current = Date.now();

    try {
      // Set fetching flag to prevent concurrent calls
      isFetchingRef.current = true;
      setLoading(true);
      
      if (isInitial) {
        setError(null);
      }

      console.log(`Fetching posts - isInitial: ${isInitial}, filter: ${filter}, contentType: ${contentTypeFilter}`);

      // For initial load, reset everything
      if (isInitial) {
        setPosts([]);
        lastVisibleRef.current = null;
        hasMoreRef.current = true; 
        setHasMore(true);
      }
      
      // Build query
      let postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );

      // Add filter for specific content types
      if (contentTypeFilter !== 'all') {
        if (contentTypeFilter === 'rounds') {
          postsQuery = query(
            collection(db, 'posts'),
            where('postType', '==', 'round'),
            orderBy('createdAt', 'desc'),
            limit(pageSize)
          );
        } else if (contentTypeFilter === 'posts') {
          postsQuery = query(
            collection(db, 'posts'),
            where('postType', '==', 'regular'),
            orderBy('createdAt', 'desc'),
            limit(pageSize)
          );
        } else if (contentTypeFilter === 'tee-times') {
          postsQuery = query(
            collection(db, 'posts'),
            where('postType', '==', 'tee-time'),
            orderBy('createdAt', 'desc'),
            limit(pageSize)
          );
        }
      }

      // Add filter for following if selected
      if (filter === 'following' && user) {
        try {
          // First, get the user's following list from connections subcollection
          const connectionsQuery = query(
            collection(db, 'users', user.uid, 'connections'),
            where('type', '==', 'following'),
            where('active', '==', true)
          );
          
          const connectionsSnapshot = await getDocs(connectionsQuery);
          
          if (!connectionsSnapshot.empty) {
            // Extract user IDs from connections
            const followingList = connectionsSnapshot.docs.map(doc => doc.data().userId);
            
            // Only proceed if the user is following people
            if (followingList.length > 0) {
              console.log('Filtering posts for following users:', followingList);
              
              // Create a new query with the following filter
              postsQuery = query(
                collection(db, 'posts'),
                where('authorId', 'in', followingList),
                orderBy('createdAt', 'desc'),
                limit(pageSize)
              );
              
              // Re-apply content type filter if needed
              if (contentTypeFilter !== 'all') {
                if (contentTypeFilter === 'rounds') {
                  postsQuery = query(
                    collection(db, 'posts'),
                    where('authorId', 'in', followingList),
                    where('postType', '==', 'round'),
                    orderBy('createdAt', 'desc'),
                    limit(pageSize)
                  );
                } else if (contentTypeFilter === 'posts') {
                  postsQuery = query(
                    collection(db, 'posts'),
                    where('authorId', 'in', followingList),
                    where('postType', '==', 'regular'),
                    orderBy('createdAt', 'desc'),
                    limit(pageSize)
                  );
                } else if (contentTypeFilter === 'tee-times') {
                  postsQuery = query(
                    collection(db, 'posts'),
                    where('authorId', 'in', followingList),
                    where('postType', '==', 'tee-time'),
                    orderBy('createdAt', 'desc'),
                    limit(pageSize)
                  );
                }
              }
            } else {
              // No following connections, return empty result
              console.log('User has no following connections');
              hasMoreRef.current = false;
              setHasMore(false);
              setPosts([]);
              isFetchingRef.current = false;
              setLoading(false);
              setInitialLoading(false);
              return;
            }
          } else {
            // No connections found, return empty result
            console.log('No connections found for user');
            hasMoreRef.current = false;
            setHasMore(false);
            setPosts([]);
            isFetchingRef.current = false;
            setLoading(false);
            setInitialLoading(false);
            return;
          }
        } catch (error) {
          console.error('Error fetching user connections:', error);
          setError('Error loading feed. Please try again later.');
          // On error, return empty result
          hasMoreRef.current = false;
          setHasMore(false);
          setPosts([]);
          isFetchingRef.current = false;
          setLoading(false);
          setInitialLoading(false);
          return;
        }
      }

      // Add pagination if not initial load
      if (!isInitial && lastVisibleRef.current) {
        postsQuery = query(postsQuery, startAfter(lastVisibleRef.current));
      }

      const querySnapshot = await getDocs(postsQuery);
      console.log(`Fetched ${querySnapshot.docs.length} posts`);
      
      // Check if component is still mounted
      if (!isMountedRef.current) return;
      
      // If no documents returned on subsequent fetch, we've reached the end
      if (!isInitial && querySnapshot.docs.length === 0) {
        hasMoreRef.current = false;
        setHasMore(false);
        isFetchingRef.current = false;
        setLoading(false);
        return;
      }
      
      // Update last visible for pagination
      if (querySnapshot.docs.length > 0) {
        lastVisibleRef.current = querySnapshot.docs[querySnapshot.docs.length - 1];
        // Only set hasMore true if we got a full page of results
        const moreAvailable = querySnapshot.docs.length === pageSize;
        hasMoreRef.current = moreAvailable;
        setHasMore(moreAvailable);
      } else {
        hasMoreRef.current = false;
        setHasMore(false);
      }

      // Process posts
      const newPosts = await Promise.all(
        querySnapshot.docs.map(async (docSnapshot) => {
          const postData = docSnapshot.data() as FirestorePostData;
          
          // Fetch the actual author data
          const authorProfile = await fetchUserData(postData.authorId);
          
          // Check if the current user has liked this post
          const likedByUser = postData.likedBy?.includes(user.uid) || false;
          
          // Convert Firestore timestamp to Date for createdAt
          let createdAt: Date = new Date();
          if (postData.createdAt) {
            if (postData.createdAt instanceof Timestamp) {
              createdAt = postData.createdAt.toDate();
            } else if (postData.createdAt.seconds && postData.createdAt.nanoseconds) {
              // Handle timestamp object that might not be an instance of Timestamp
              createdAt = new Date(
                postData.createdAt.seconds * 1000 + 
                postData.createdAt.nanoseconds / 1000000
              );
            } else if (postData.createdAt instanceof Date) {
              createdAt = postData.createdAt;
            }
          }
          
          // Convert dateTime for tee-time posts
          let dateTime: Date | null = null;
          if (postData.dateTime) {
            if (postData.dateTime instanceof Timestamp) {
              dateTime = postData.dateTime.toDate();
            } else if (postData.dateTime.seconds && postData.dateTime.nanoseconds) {
              dateTime = new Date(
                postData.dateTime.seconds * 1000 + 
                postData.dateTime.nanoseconds / 1000000
              );
            } else if (postData.dateTime instanceof Date) {
              dateTime = postData.dateTime;
            }
          }
          
          // Define default author if none found
          const defaultAuthor: UserProfile = {
            uid: postData.authorId,
            displayName: 'Unknown User',
            email: null,
            photoURL: null,
            createdAt: new Date(),
            handicapIndex: null,
            homeCourse: null,
            profileComplete: false
          };
          
          // Prepare the basic post object
          const post: Post = {
            id: docSnapshot.id,
            authorId: postData.authorId,
            author: authorProfile || defaultAuthor,
            content: postData.content,
            media: postData.media || [],
            createdAt: createdAt,
            postType: postData.postType,
            visibility: postData.visibility,
            likes: postData.likes || 0,
            comments: postData.comments || 0,
            likedByUser,
            likedBy: postData.likedBy || [],
            hashtags: postData.hashtags || [],
            location: postData.location,
            roundId: postData.roundId,
            eventId: postData.eventId,
            marketplaceId: postData.marketplaceId,
            teeTimeId: postData.teeTimeId,
            courseName: postData.courseName,
            dateTime: dateTime,
            maxPlayers: postData.maxPlayers
          };
          
          return post;
        })
      );

      // Update state based on whether this is initial load
      if (isInitial) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError('Error loading feed. Please try again later.');
      // On error, make sure we don't keep trying to load
      if (!isInitial) {
        hasMoreRef.current = false;
        setHasMore(false);
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setInitialLoading(false);
    }
  }, [user, filter, contentTypeFilter, pageSize, fetchUserData]); // Removed problematic dependencies

  // Initial fetch effect - runs when component mounts or filter changes
  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;
    
    // Reset fetching state
    isFetchingRef.current = false;
    
    // Reset other state on filter changes
    setInitialLoading(true);
    hasMoreRef.current = true;
    setHasMore(true);
    lastVisibleRef.current = null;
    
    // Create an AbortController for cleanup
    const abortController = new AbortController();
    
    // Delayed fetch to avoid immediate execution
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        fetchPosts(true);
      }
    }, 0);
    
    // Clean up function
    return () => {
      clearTimeout(timeoutId);
      isMountedRef.current = false;
      abortController.abort();
    };
  }, [filter, contentTypeFilter]); // Removed fetchPosts from dependencies to break the cycle

  // Function to load more posts
  const fetchMorePosts = useCallback(async () => {
    if (!isFetchingRef.current && hasMoreRef.current) {
      await fetchPosts(false);
    }
  }, [fetchPosts]);

  // Function to refresh posts (used for pull-to-refresh)
  const refreshPosts = useCallback(async () => {
    // Reset state and fetch from beginning
    lastVisibleRef.current = null;
    hasMoreRef.current = true;
    setHasMore(true);
    isFetchingRef.current = false;
    await fetchPosts(true);
  }, [fetchPosts]);

  // Handle like/unlike with Firebase update
  const toggleLike = useCallback(async (postId: string) => {
    if (!user) return;
    
    // Find the post
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    const newLikedStatus = !post.likedByUser;
    
    try {
      const postRef = doc(db, 'posts', postId);
      
      // Update Firestore document
      if (newLikedStatus) {
        // Like the post
        await updateDoc(postRef, {
          likes: increment(1),
          likedBy: arrayUnion(user.uid)
        });
      } else {
        // Unlike the post
        await updateDoc(postRef, {
          likes: increment(-1),
          likedBy: arrayRemove(user.uid)
        });
      }
      
      // Update local state
      setPosts(prevPosts => 
        prevPosts.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              likes: newLikedStatus ? p.likes + 1 : p.likes - 1,
              likedByUser: newLikedStatus,
            };
          }
          return p;
        })
      );
    } catch (error) {
      console.error('Error updating like status:', error);
      setError('Failed to update like. Please try again.');
    }
  }, [user, posts]);

  // Handle comment action
  const handleComment = useCallback((postId: string) => {
    // This is where you would implement comment functionality
    console.log('Comment on post:', postId);
  }, []);

  // Handle share action
  const handleShare = useCallback((postId: string) => {
    // This is where you would implement share functionality
    console.log('Share post:', postId);
  }, []);

  return {
    // Data
    posts,
    
    // Status
    loading,
    initialLoading,
    hasMore,
    error,
    
    // Actions
    fetchMorePosts,
    refreshPosts,
    toggleLike,
    handleComment,
    handleShare,
    
    // Round data utilities
    fetchRoundData,
    fetchFullRoundData,
  };
}