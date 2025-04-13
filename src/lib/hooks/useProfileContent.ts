// src/lib/hooks/useProfileContent.ts
import { useState, useCallback } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserProfile } from '@/types/auth';
import { Post } from '@/types/post';
import { Scorecard } from '@/types/scorecard';

export function useProfileContent(userId: string, itemsPerPage: number = 5) {
  const [posts, setPosts] = useState({
    allPosts: [] as Post[],
    regularPosts: [] as Post[],
    isLoading: true
  });
  
  const [rounds, setRounds] = useState([] as Scorecard[]);
  
  // Track the last document for pagination
  const [lastPostDoc, setLastPostDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastRoundDoc, setLastRoundDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  
  // Load initial content
  const loadContent = useCallback(async (profile: UserProfile) => {
    try {
      // Load posts
      const postsQuery = query(
        collection(db, 'posts'),
        where('authorId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(itemsPerPage)
      );
      
      // Load rounds
      const roundsQuery = query(
        collection(db, 'scorecards'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(itemsPerPage)
      );
      
      // Execute both queries in parallel
      const [postsSnapshot, roundsSnapshot] = await Promise.all([
        getDocs(postsQuery),
        getDocs(roundsQuery)
      ]);
      
      // Store last documents for pagination
      setLastPostDoc(postsSnapshot.docs.length > 0 ? postsSnapshot.docs[postsSnapshot.docs.length - 1] : null);
      setLastRoundDoc(roundsSnapshot.docs.length > 0 ? roundsSnapshot.docs[roundsSnapshot.docs.length - 1] : null);
      
      // Process posts
      const allPosts = postsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          authorId: userId,
          author: {
            uid: profile.uid,
            displayName: profile.displayName || '',
            photoURL: profile.photoURL || '',
            handicapIndex: profile.handicapIndex
          },
          content: data.content || '',
          media: data.media || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          postType: data.postType || 'regular',
          visibility: data.visibility || 'public',
          likes: data.likes || 0,
          comments: data.comments || 0,
          likedByUser: false, // This would be set based on current user
          hashtags: data.hashtags || []
        } as Post;
      });
      
      // Filter regular posts (non-round posts)
      const regularPosts = allPosts.filter(post => post.postType !== 'round');
      
      // Process rounds
      const roundsData = roundsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Scorecard[];
      
      // Update state
      setPosts({
        allPosts,
        regularPosts,
        isLoading: false
      });
      
      setRounds(roundsData);
    } catch (error) {
      console.error('Error loading content:', error);
      setPosts(prev => ({ ...prev, isLoading: false }));
    }
  }, [userId, itemsPerPage]);
  
  // Load more posts for infinite scrolling
  const loadMorePosts = useCallback(async (page: number): Promise<{ posts: Post[], hasMore: boolean }> => {
    try {
      if (!lastPostDoc) {
        return { posts: [], hasMore: false };
      }
      
      // Create query with startAfter for pagination
      const postsQuery = query(
        collection(db, 'posts'),
        where('authorId', '==', userId),
        orderBy('createdAt', 'desc'),
        startAfter(lastPostDoc),
        limit(itemsPerPage)
      );
      
      const postsSnapshot = await getDocs(postsQuery);
      
      // Update last document for pagination
      if (postsSnapshot.docs.length > 0) {
        setLastPostDoc(postsSnapshot.docs[postsSnapshot.docs.length - 1]);
      }
      
      // Process new posts
      const newPosts = postsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          authorId: userId,
          author: {
            uid: userId,
            displayName: data.author?.displayName || '',
            photoURL: data.author?.photoURL || '',
            handicapIndex: data.author?.handicapIndex
          },
          content: data.content || '',
          media: data.media || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          postType: data.postType || 'regular',
          visibility: data.visibility || 'public',
          likes: data.likes || 0,
          comments: data.comments || 0,
          likedByUser: false,
          hashtags: data.hashtags || []
        } as Post;
      });
      
      // Filter regular posts
      const newRegularPosts = newPosts.filter(post => post.postType !== 'round');
      
      // Update state
      setPosts(prev => ({
        allPosts: [...prev.allPosts, ...newPosts],
        regularPosts: [...prev.regularPosts, ...newRegularPosts],
        isLoading: false
      }));
      
      return {
        posts: newPosts,
        hasMore: newPosts.length === itemsPerPage
      };
    } catch (error) {
      console.error('Error loading more posts:', error);
      return { posts: [], hasMore: false };
    }
  }, [userId, lastPostDoc, itemsPerPage]);
  
  // Load more rounds for infinite scrolling
  const loadMoreRounds = useCallback(async (page: number): Promise<{ rounds: Scorecard[], hasMore: boolean }> => {
    try {
      if (!lastRoundDoc) {
        return { rounds: [], hasMore: false };
      }
      
      // Create query with startAfter for pagination
      const roundsQuery = query(
        collection(db, 'scorecards'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        startAfter(lastRoundDoc),
        limit(itemsPerPage)
      );
      
      const roundsSnapshot = await getDocs(roundsQuery);
      
      // Update last document for pagination
      if (roundsSnapshot.docs.length > 0) {
        setLastRoundDoc(roundsSnapshot.docs[roundsSnapshot.docs.length - 1]);
      }
      
      // Process new rounds
      const newRounds = roundsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Scorecard[];
      
      // Update state
      setRounds(prev => [...prev, ...newRounds]);
      
      return {
        rounds: newRounds,
        hasMore: newRounds.length === itemsPerPage
      };
    } catch (error) {
      console.error('Error loading more rounds:', error);
      return { rounds: [], hasMore: false };
    }
  }, [userId, lastRoundDoc, itemsPerPage]);
  
  return {
    posts,
    rounds,
    loadContent,
    loadMorePosts,
    loadMoreRounds
  };
}