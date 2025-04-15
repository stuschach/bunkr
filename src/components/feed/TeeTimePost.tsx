// src/components/feed/TeeTimePost.tsx
// Modified to include notifications for comments on tee time posts

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistance, format } from 'date-fns';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { Post, Comment } from '@/types/post';
import { 
  doc, 
  addDoc, 
  collection, 
  serverTimestamp, 
  updateDoc, 
  increment, 
  query,
  orderBy,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotificationCreator } from '@/lib/hooks/useNotificationCreator';
import { CommentSection } from '@/components/common/social/CommentSection';
import { PostActions } from '@/components/common/social/PostActions';

interface TeeTimePostProps {
  post: Post;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
}

// Helper function to safely get date regardless of source format
const safelyGetDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  
  try {
    // Handle Firestore Timestamp objects
    if (typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // Handle JavaScript Date objects
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // Handle Firestore timestamp-like objects
    if (dateValue.seconds !== undefined) {
      return new Date(dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000);
    }
    
    // Handle ISO strings
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    }
    
    // Default fallback
    return new Date();
  } catch (error) {
    console.error('Error parsing date:', error);
    return new Date();
  }
};

export function TeeTimePost({ 
  post, 
  onLike,
  onComment,
  onShare
}: TeeTimePostProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { notifyComment } = useNotificationCreator();
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Safely format date and time with error handling
  const getFormattedDate = () => {
    try {
      const date = post.dateTime ? safelyGetDate(post.dateTime) : new Date();
      return format(date, 'EEE, MMM d, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Date unavailable';
    }
  };
  
  const getFormattedTime = () => {
    try {
      const date = post.dateTime ? safelyGetDate(post.dateTime) : new Date();
      return format(date, 'h:mm a');
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Time unavailable';
    }
  };

  // Calculate time since post creation
  const getTimeAgo = () => {
    try {
      const createdAt = post.createdAt instanceof Date ? 
        post.createdAt : safelyGetDate(post.createdAt);
      return formatDistance(createdAt, new Date(), { addSuffix: true });
    } catch (error) {
      console.error('Error calculating time ago:', error);
      return 'Recently';
    }
  };

  // Fetch comments when showComments is toggled on
  useEffect(() => {
    if (showComments && post.comments > 0) {
      fetchComments();
    }
  }, [showComments, post.id, post.comments]);
  
  // Helper function to fetch user data for comment author
  const fetchUserData = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return { uid: userDoc.id, ...userDoc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  // Fetch comments for this post
  const fetchComments = async () => {
    if (loadingComments) return;
    
    try {
      setLoadingComments(true);
      
      // Query comments for this post
      const commentsQuery = query(
        collection(db, 'posts', post.id, 'comments'),
        orderBy('createdAt', 'desc')
      );
      
      const commentsSnapshot = await getDocs(commentsQuery);
      
      // Process comments with user data
      const commentsData = await Promise.all(commentsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const author = await fetchUserData(data.authorId);
        
        return {
          id: doc.id,
          postId: post.id,
          authorId: data.authorId,
          author: author,
          text: data.text,
          createdAt: data.createdAt?.toDate() || new Date(),
          likes: data.likes || 0,
          likedByUser: false // Default, can be updated if needed
        } as Comment;
      }));
      
      setComments(commentsData);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  // Handle comment submission
  const handleSubmitComment = async () => {
    if (!user || !commentText.trim() || isSubmittingComment) return;

    try {
      setIsSubmittingComment(true);

      // Add comment to the comments subcollection
      const commentRef = await addDoc(collection(db, 'posts', post.id, 'comments'), {
        authorId: user.uid,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
        likes: 0
      });

      // Update the comment count on the post
      await updateDoc(doc(db, 'posts', post.id), {
        comments: increment(1)
      });

      // Create a new comment object for the UI
      const newComment: Comment = {
        id: commentRef.id,
        postId: post.id,
        authorId: user.uid,
        author: user,
        text: commentText.trim(),
        createdAt: new Date(),
        likes: 0,
        likedByUser: false
      };

      // Add the new comment to the state
      setComments(prevComments => [newComment, ...prevComments]);
      
      // Ensure comments are visible
      setShowComments(true);
      
      // Reset form state
      setCommentText('');
      
      // Notify the post author about the comment (if not self-commenting)
      if (post.authorId !== user.uid) {
        await notifyComment(
          post.id,
          post.authorId,
          commentText.trim(),
          `Tee time at ${post.courseName} on ${getFormattedDate()}`
        );
      }
      
      // Call the onComment callback
      onComment();
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Handle comment button click
  const handleCommentClick = () => {
    setShowCommentInput(!showCommentInput);
    setShowComments(!showComments);
    onComment();
  };

  const handleViewTeeTime = () => {
    router.push(`/tee-times/${post.teeTimeId}`);
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex items-start space-x-3 mb-3">
          <Avatar 
            src={post.author?.photoURL} 
            alt={post.author?.displayName || 'User'} 
            size="md" 
          />
          <div>
            <div className="font-medium">{post.author?.displayName}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{getTimeAgo()}</div>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <div className="mr-2">
              <Badge variant="outline">Tee Time</Badge>
            </div>
            <Heading level={4}>{post.courseName}</Heading>
          </div>
          
          <Text>{post.content}</Text>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-3 mb-3">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Date & Time</div>
              <div className="font-medium">{getFormattedDate()} • {getFormattedTime()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Group Size</div>
              <div className="font-medium">{post.maxPlayers} players</div>
            </div>
          </div>
          
          <Button 
            className="w-full"
            onClick={handleViewTeeTime}
          >
            View Tee Time
          </Button>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col pt-0 pb-2 border-t border-gray-100 dark:border-gray-800">
        <PostActions
          isLiked={post.likedByUser || false}
          likeCount={post.likes || 0}
          commentCount={post.comments || 0}
          onLike={onLike}
          onComment={handleCommentClick}
          onShare={onShare}
        />
        
        <CommentSection
          currentUser={user}
          comments={comments}
          showComments={showComments}
          showCommentInput={showCommentInput}
          loadingComments={loadingComments}
          commentText={commentText}
          setCommentText={setCommentText}
          setShowCommentInput={setShowCommentInput}
          handleSubmitComment={handleSubmitComment}
          isSubmittingComment={isSubmittingComment}
        />
      </CardFooter>
    </Card>
  );
}