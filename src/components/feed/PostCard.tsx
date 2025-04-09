// src/components/feed/PostCard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { MediaGallery } from '@/components/common/media/MediaGallery';
import { formatHandicapIndex } from '@/lib/utils/formatting';
import { getRelativeTimeString } from '@/lib/utils/date-format';
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
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { UserProfile } from '@/types/auth';
import { PostActions } from '@/components/common/social/PostActions';
import { CommentSection } from '@/components/common/social/CommentSection';

interface PostCardProps {
  post: Post;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
}

export function PostCard({ post, onLike, onComment, onShare }: PostCardProps) {
  const { user } = useAuth();
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Format post content (handle hashtags, mentions, etc.)
  const formattedContent = post.content.replace(
    /#(\w+)/g,
    '<span class="text-green-500">#$1</span>'
  );

  // Convert post media to MediaGallery format
  const mediaItems = post.media?.map(item => ({
    id: item.id,
    type: item.type,
    url: item.url,
    thumbnail: item.thumbnailUrl,
    alt: `Media by ${post.author?.displayName || 'user'}`
  })) || [];

  // Fetch comments when showComments is toggled on
  useEffect(() => {
    if (showComments && post.comments > 0) {
      fetchComments();
    }
  }, [showComments, post.id, post.comments]);
  
  // Helper function to fetch user data for comment author
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
      
      // Update the post's comment count in the local state
      post.comments += 1;

      // Call the onComment callback to refresh data if needed
      if (onComment) {
        onComment();
      }
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
    if (onComment) {
      onComment();
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="pt-6">
        {/* Post Header */}
        <div className="flex items-center mb-4">
          <Link href={`/profile/${post.authorId}`} className="flex items-center">
            <Avatar 
              src={post.author?.photoURL || ''} 
              alt={post.author?.displayName || 'User'} 
              size="md"
              className="mr-3"
            />
            <div>
              <div className="font-medium flex items-center">
                {post.author?.displayName || 'User'}
                {post.author?.handicapIndex !== undefined && post.author?.handicapIndex !== null && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {formatHandicapIndex(post.author.handicapIndex)}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {getRelativeTimeString(post.createdAt)}
                {post.location && (
                  <> • {post.location.name}</>
                )}
              </div>
            </div>
          </Link>
        </div>

        {/* Post Content */}
        <div 
          className="mb-4" 
          dangerouslySetInnerHTML={{ __html: formattedContent }}
        />

        {/* Post Media */}
        {mediaItems.length > 0 && (
          <div className="mb-4">
            <MediaGallery 
              items={mediaItems}
              aspectRatio="16:9"
              columns={mediaItems.length > 1 ? 2 : 1}
            />
          </div>
        )}

        {/* Round Data (if post type is round) */}
        {post.postType === 'round' && post.roundId && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-3 mb-4">
            <div className="text-sm font-medium mb-1">
              Round at {post.location?.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Click to see full scorecard
            </div>
          </div>
        )}

        {/* Post Tags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {post.hashtags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      {/* Post Footer - Interactions */}
      <CardFooter className="pt-0 pb-4 px-6 border-t border-gray-100 dark:border-gray-800 flex flex-col">
        <PostActions
          isLiked={post.likedByUser || false}
          likeCount={post.likes || 0}
          commentCount={post.comments || 0}
          onLike={onLike || (() => {})}
          onComment={handleCommentClick}
          onShare={onShare || (() => {})}
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