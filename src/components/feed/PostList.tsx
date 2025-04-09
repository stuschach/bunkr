// src/components/feed/PostList.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { PostCard } from '@/components/feed/PostCard';
import { RoundShareCard } from '@/components/feed/RoundShareCard';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Post } from '@/types/post';
import { UserProfile } from '@/types/auth';
import { Scorecard } from '@/types/scorecard';

interface PostListProps {
  filter: 'all' | 'following';
  contentTypeFilter?: 'all' | 'posts' | 'rounds';
}

export function PostList({ filter, contentTypeFilter = 'all' }: PostListProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  // Flag to prevent multiple simultaneous fetch operations
  const isFetchingRef = useRef(false);

  // Helper function to fetch user data
  const fetchUserData = async (userId: string): Promise<UserProfile | null> => {
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
  };

  // Helper function to fetch round data
  const fetchRoundData = async (roundId: string): Promise<Scorecard | null> => {
    try {
      const roundDoc = await getDoc(doc(db, 'scorecards', roundId));
      if (roundDoc.exists()) {
        const roundData = roundDoc.data();
        
        // Convert Firestore timestamps to Date objects
        if (roundData.date && roundData.date instanceof Timestamp) {
          roundData.date = roundData.date.toDate().toISOString();
        }
        
        return { id: roundDoc.id, ...roundData } as Scorecard;
      }
      return null;
    } catch (error) {
      console.error('Error fetching round data:', error);
      return null;
    }
  };

  // Fetch posts function with strict controls
  const fetchPosts = useCallback(async (isInitial = false) => {
    // Skip if already fetching, no user, or explicitly loading
    if (isFetchingRef.current || !user || loading) {
      console.log('Skipping fetch: already fetching or no user or loading');
      return;
    }
    
    // If we know there are no more posts, don't fetch
    if (!isInitial && !hasMore) {
      console.log('Skipping fetch: no more posts to load');
      return;
    }

    try {
      // Set fetching flag to prevent concurrent calls
      isFetchingRef.current = true;
      setLoading(true);

      console.log(`Fetching posts - isInitial: ${isInitial}, filter: ${filter}, contentType: ${contentTypeFilter}`);

      // For initial load, reset everything
      if (isInitial) {
        setPosts([]);
        setLastVisible(null);
        setHasMore(true); // Reset hasMore for initial load
      }
      
      // Add debounce/delay to avoid tight render loops
      await new Promise(resolve => setTimeout(resolve, 50));

      // Build query
      let postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );

      // Add filter for specific content types
      if (contentTypeFilter !== 'all') {
        if (contentTypeFilter === 'rounds') {
          postsQuery = query(
            postsQuery,
            where('postType', '==', 'round')
          );
        } else if (contentTypeFilter === 'posts') {
          postsQuery = query(
            postsQuery,
            where('postType', '==', 'regular')
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
                limit(5)
              );
              
              // Re-apply content type filter if needed
              if (contentTypeFilter !== 'all') {
                if (contentTypeFilter === 'rounds') {
                  postsQuery = query(
                    postsQuery,
                    where('postType', '==', 'round')
                  );
                } else if (contentTypeFilter === 'posts') {
                  postsQuery = query(
                    postsQuery,
                    where('postType', '==', 'regular')
                  );
                }
              }
            } else {
              // No following connections, return empty result
              console.log('User has no following connections');
              setHasMore(false);
              setPosts([]);
              setLoading(false);
              setInitialLoading(false);
              isFetchingRef.current = false;
              return;
            }
          } else {
            // No connections found, return empty result
            console.log('No connections found for user');
            setHasMore(false);
            setPosts([]);
            setLoading(false);
            setInitialLoading(false);
            isFetchingRef.current = false;
            return;
          }
        } catch (error) {
          console.error('Error fetching user connections:', error);
          // On error, return empty result
          setHasMore(false);
          setPosts([]);
          setLoading(false);
          setInitialLoading(false);
          isFetchingRef.current = false;
          return;
        }
      }

      // Add pagination if not initial load
      if (!isInitial && lastVisible) {
        postsQuery = query(postsQuery, startAfter(lastVisible));
      }

      const querySnapshot = await getDocs(postsQuery);
      console.log(`Fetched ${querySnapshot.docs.length} posts`);
      
      // If no documents returned on subsequent fetch, we've reached the end
      if (!isInitial && querySnapshot.docs.length === 0) {
        setHasMore(false);
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }
      
      // Update last visible for pagination
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        // Only set hasMore true if we got a full page of results
        setHasMore(querySnapshot.docs.length === 5);
      } else {
        setHasMore(false);
      }

      // Process posts
      const newPosts = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const postData = doc.data() as Omit<Post, 'id'>;
          
          // Fetch the actual author data
          const author = await fetchUserData(postData.authorId);
          
          // Check if the current user has liked this post
          const likedByUser = postData.likedBy?.includes(user.uid) || false;
          
          // Prepare the basic post object
          const post: Post = {
            id: doc.id,
            ...postData,
            author: author || {
              uid: postData.authorId,
              displayName: 'Unknown User',
              email: null,
              photoURL: null,
            },
            createdAt: postData.createdAt?.toDate() || new Date(),
            likedByUser,
            // Ensure these are numbers in case they're undefined
            likes: postData.likes || 0,
            comments: postData.comments || 0,
          };
          
          return post;
        })
      );

      // Update state based on whether this is initial load - do one state update at a time
      // with minimal batching to avoid render loops
      if (isInitial) {
        setPosts(newPosts);
        // Wait for state to settle
        await new Promise(resolve => setTimeout(resolve, 50));
        setFirstLoad(false);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      
    } catch (error) {
      console.error('Error fetching posts:', error);
      // On error, make sure we don't keep trying to load
      if (!isInitial) setHasMore(false);
    } finally {
      setLoading(false);
      setInitialLoading(false);
      // Reset fetching flag
      isFetchingRef.current = false;
    }
  }, [user, filter, contentTypeFilter, lastVisible, hasMore, loading]);

  // Initial fetch effect - runs only once when component mounts or filter changes
  useEffect(() => {
    // Use a local variable to track if the effect is still mounted
    let isMounted = true;
    
    const initializeAndFetch = async () => {
      if (!isMounted) return;
      
      setInitialLoading(true);
      setHasMore(true);
      setFirstLoad(true);
      
      // Reset ref flags
      isFetchingRef.current = false;
      
      // Initial fetch - delayed slightly to avoid race conditions
      setTimeout(() => {
        if (isMounted) {
          fetchPosts(true);
        }
      }, 0);
    };
    
    initializeAndFetch();
    
    // Clean up function
    return () => {
      isMounted = false;
      // Clean up observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [filter, contentTypeFilter]); // Add contentTypeFilter as dependency

  // Intersection Observer setup - using a stable callback to avoid dependency loops
  useEffect(() => {
    // Skip during first load or if already loading
    if (firstLoad || loading || !hasMore) return;
    
    // Clean up any existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1,
    };

    // Use a stable callback reference that checks current state values
    // This avoids the observer being recreated when fetchPosts changes
    const handleObserver = (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry && entry.isIntersecting && hasMore && !isFetchingRef.current && !loading) {
        console.log('Intersection observed, loading more posts');
        fetchPosts(false);
      }
    };

    // Create new observer
    const observer = new IntersectionObserver(handleObserver, options);
    observerRef.current = observer;

    // Observe the load more element if it exists
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [firstLoad, loading, hasMore]); // Removed fetchPosts from dependencies

  // Handle like/unlike with Firebase update
  const handleToggleLike = async (postId: string) => {
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
      // TODO: Show error notification
    }
  };

  const handleComment = async (postId: string) => {
    // Instead of navigating to a separate page, we'll toggle the comment form
    // in the PostCard component
    console.log('Show comment form for post:', postId);
    // No need to do anything else - the PostCard will handle showing the comment form
  };

  const handleShare = (postId: string) => {
    // TODO: Implement share functionality
    console.log('Share post:', postId);
  };

  // Rendering logic
  if (initialLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <LoadingSpinner size="lg" color="primary" label="Loading posts..." />
      </div>
    );
  }

  if (posts.length === 0 && !initialLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 text-center shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No posts found
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {filter === 'following'
            ? "Start following golfers to see their posts here!"
            : contentTypeFilter === 'rounds'
            ? "No round posts found. Share your scorecards to see them here!"
            : contentTypeFilter === 'posts'
            ? "No regular posts found. Create a post to get started!"
            : "Follow golfers or create your first post to get started!"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <div key={post.id} className="transition-all duration-200 hover:translate-y-[-2px]">
          {post.postType === 'round' && post.roundId ? (
            <RoundPostWrapper 
              postId={post.id} 
              roundId={post.roundId} 
              author={post.author} 
              onShare={() => handleShare(post.id)}
              onLike={() => handleToggleLike(post.id)}
              onComment={() => handleComment(post.id)}
            />
          ) : (
            <PostCard
              post={post}
              onLike={() => handleToggleLike(post.id)}
              onComment={() => handleComment(post.id)}
              onShare={() => handleShare(post.id)}
            />
          )}
        </div>
      ))}

      {/* Loading indicator and intersection observer target */}
      <div ref={loadMoreRef} className="py-4 flex justify-center">
        {loading && <LoadingSpinner size="md" color="primary" />}
        {!loading && !hasMore && posts.length > 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No more posts to load
          </p>
        )}
      </div>
    </div>
  );
}
// Separate component to handle fetching round data
function RoundPostWrapper({ 
    postId, 
    roundId, 
    author, 
    onShare,
    onLike,
    onComment
  }: { 
    postId: string; 
    roundId: string; 
    author: UserProfile; 
    onShare: () => void;
    onLike: () => void;
    onComment: () => void;
  }) {
    const [round, setRound] = useState<Scorecard | null>(null);
    const [fullRoundData, setFullRoundData] = useState<{ holes: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingFullData, setLoadingFullData] = useState(false);
    const { user } = useAuth();
    const [post, setPost] = useState<Post | null>(null);
  
    // Initial fetch - just get summary data
    useEffect(() => {
      const fetchBasicData = async () => {
        try {
          setLoading(true);
          
          // Fetch post data to get likes/comments/likedByUser
          const postDoc = await getDoc(doc(db, 'posts', postId));
          if (postDoc.exists()) {
            const postData = postDoc.data();
            setPost({
              id: postId,
              ...postData,
              author,
              createdAt: postData.createdAt?.toDate() || new Date(),
              likedByUser: postData.likedBy?.includes(user?.uid) || false,
              likes: postData.likes || 0,
              comments: postData.comments || 0,
            } as Post);
          }
          
          // Fetch basic round data
          const roundDoc = await getDoc(doc(db, 'scorecards', roundId));
          if (roundDoc.exists()) {
            const data = roundDoc.data();
            
            // Convert Firestore timestamps to Date objects
            if (data.date && data.date instanceof Timestamp) {
              data.date = data.date.toDate().toISOString();
            }
            
            setRound({
              id: roundDoc.id,
              courseName: data.courseName,
              totalScore: data.totalScore,
              coursePar: data.coursePar,
              date: data.date,
              teeBox: data.teeBox,
              stats: data.stats,
              // Include minimal hole data for summary display
              holes: data.holes?.slice(0, 1) || [] // Just include first hole to enable highlights
            } as Scorecard);
          }
        } catch (error) {
          console.error('Error fetching basic data:', error);
        } finally {
          setLoading(false);
        }
      };
  
      fetchBasicData();
    }, [postId, roundId, author, user?.uid]);
  
    // Function to fetch full hole-by-hole data when expanded
    const fetchFullRoundData = async () => {
      if (fullRoundData || loadingFullData) return;
      
      try {
        setLoadingFullData(true);
        
        const roundDoc = await getDoc(doc(db, 'scorecards', roundId));
        if (roundDoc.exists()) {
          const data = roundDoc.data();
          
          setFullRoundData({
            holes: data.holes || []
          });
        }
      } catch (error) {
        console.error('Error fetching full round data:', error);
      } finally {
        setLoadingFullData(false);
      }
    };
  
    if (loading) {
      return (
        <div className="flex justify-center items-center py-4">
          <LoadingSpinner size="md" color="primary" />
        </div>
      );
    }
  
    if (!round || !post) {
      return (
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Could not load round data
          </p>
        </div>
      );
    }
  
    return (
      <RoundShareCard
        round={round}
        fullRoundData={fullRoundData}
        fetchFullRoundData={fetchFullRoundData}
        loadingFullData={loadingFullData}
        user={author}
        postId={postId}
        onShare={onShare}
        onLike={onLike}
        onComment={onComment}
        likedByUser={post.likedByUser}
        likes={post.likes}
        comments={post.comments}
      />
    );
  }