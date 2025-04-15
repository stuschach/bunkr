// src/components/feed/PostCard.tsx
// Enhanced with deletion support
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { MediaGallery } from '@/components/common/media/MediaGallery';
import { getRelativeTimeString } from '@/lib/utils/date-format';
import { formatHandicapIndex } from '@/lib/utils/formatting';
import { Post, Comment } from '@/types/post';
import { 
  addCommentToPost,
  subscribeToComments
} from '@/lib/firebase/feed-service';
import { useAuth } from '@/lib/contexts/AuthContext';
import { UserProfile } from '@/types/auth';
import { PostActions } from '@/components/common/social/PostActions';
import { CommentSection } from '@/components/common/social/CommentSection';
import { useNotificationCreator } from '@/lib/hooks/useNotificationCreator';
import { PostListener } from '@/components/common/data/PostListener';
import { PostMenu } from '@/components/common/social/PostMenu'; // Import the new PostMenu component
import { checkPostExists } from '@/lib/firebase/feed-delete-service'; // Import the check function

interface PostCardProps {
  post: Post;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onDelete?: (postId: string) => void; // Add deletion callback
  extraActions?: React.ReactNode;
  isVisible?: boolean;
  isLoading?: boolean;
  pendingLike?: boolean;
}

export function PostCard({ 
  post, 
  onLike, 
  onComment, 
  onShare,
  onDelete,
  extraActions, 
  isVisible = true,
  isLoading = false,
  pendingLike = false
}: PostCardProps) {
  const { user } = useAuth();
  const { notifyComment } = useNotificationCreator();
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsSubscribed, setCommentsSubscribed] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false); // Track if post is deleted
  const [fadeOut, setFadeOut] = useState(false); // For smooth UI transition

  // Handle post deletion
  const handlePostDeleted = () => {
    // Begin fade out animation
    setFadeOut(true);
    
    // Wait for animation to complete before removing from DOM
    setTimeout(() => {
      setIsDeleted(true);
      if (onDelete) {
        onDelete(post.id);
      }
    }, 300); // Transition duration in ms, should match CSS
  };

  // Verify post still exists
  useEffect(() => {
    // If post is already marked as deleted, do nothing
    if (isDeleted) return;
    
    // No need to check immediately, only for posts that linger in feed
    const timer = setTimeout(() => {
      // Only check if component is still mounted
      checkPostExists(post.id)
        .then(exists => {
          if (!exists) {
            handlePostDeleted();
          }
        })
        .catch(err => {
          console.error(`Error checking if post ${post.id} exists:`, err);
        });
    }, 60000); // Check after 1 minute
    
    return () => clearTimeout(timer);
  }, [post.id, isDeleted]);

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

  // Subscribe to comments when they become visible
  useEffect(() => {
    // Only subscribe when comments are shown and the post is visible
    if (showComments && isVisible && !commentsSubscribed && post.id) {
      setLoadingComments(true);
      setCommentsSubscribed(true);
      
      console.log(`Subscribing to comments for post ${post.id}`);
      // Set up comment subscription
      const unsubscribe = subscribeToComments(post.id, async (commentsData) => {
        // Process comments to add author data and format dates
        try {
          const processedComments = await Promise.all(commentsData.map(async (comment) => {
            // Use existing author data if available
            if (comment.author) {
              return {
                ...comment,
                createdAt: comment.createdAt?.toDate ? comment.createdAt.toDate() : new Date(comment.createdAt),
                likedByUser: comment.likedBy?.includes(user?.uid || '') || false
              } as Comment;
            }
            
            // Fetch author data if needed
            const authorData = await fetchUserData(comment.authorId);
            
            return {
              ...comment,
              author: authorData,
              createdAt: comment.createdAt?.toDate ? comment.createdAt.toDate() : new Date(comment.createdAt),
              likedByUser: comment.likedBy?.includes(user?.uid || '') || false
            } as Comment;
          }));
          
          setComments(processedComments);
        } catch (error) {
          console.error('Error processing comments:', error);
        } finally {
          setLoadingComments(false);
        }
      });
      
      // Clean up subscription when component unmounts or comments are hidden
      return () => {
        unsubscribe();
        setCommentsSubscribed(false);
      };
    }
    
    // If comments are hidden or post is not visible, unsubscribe
    if ((!showComments || !isVisible) && commentsSubscribed) {
      setCommentsSubscribed(false);
    }
  }, [showComments, isVisible, post.id, user, commentsSubscribed]);

  // Helper function to fetch user data
  const fetchUserData = async (userId: string): Promise<UserProfile | null> => {
    // This would be your implementation to fetch user data
    // For now, we'll return a placeholder
    return {
      uid: userId,
      displayName: 'User',
      photoURL: '',
      createdAt: new Date(),
      email: null,
      handicapIndex: null,
      homeCourse: null,
      profileComplete: false
    };
  };

  // Handle comment submission
  const handleSubmitComment = async () => {
    if (!user || !commentText.trim() || isSubmittingComment) return;

    try {
      setIsSubmittingComment(true);
      console.log(`Submitting comment for post ${post.id}`);

      // Add comment to the post
      await addCommentToPost(post.id, user.uid, commentText.trim());
      
      // Create a new comment object for immediate UI feedback
      const newComment: Comment = {
        id: 'temp-' + Date.now(), // Temporary ID until we refresh comments
        postId: post.id,
        authorId: user.uid,
        author: user,
        text: commentText.trim(),
        createdAt: new Date(),
        likes: 0,
        likedByUser: false
      };

      // Add the new comment to the state for immediate feedback
      // Even if we're subscribed, optimistic UI is good for responsiveness
      setComments(prevComments => [newComment, ...prevComments]);
      
      // Reset form state
      setCommentText('');
      
      // Send notification to post author (if not self-commenting)
      if (post.authorId !== user.uid) {
        // Determine post type for better notification message
        const postType = post.postType === 'round' 
          ? 'round' 
          : post.postType === 'tee-time' 
            ? 'tee time' 
            : 'post';
            
        await notifyComment(
          post.id,
          post.authorId,
          commentText.trim(),
          post.content
        );
      }

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

  // If post is marked as deleted, don't render anything
  if (isDeleted) {
    return null;
  }

  // For rendering the card contents - extracted to avoid duplication
  const renderCardContent = (currentPost: Post, loading: boolean = false) => (
    <>
      <CardContent className={`pt-6 ${loading ? 'opacity-70' : ''}`}>
        {/* Post Header with Menu */}
        <div className="flex items-center justify-between mb-4">
          <Link href={`/profile/${currentPost.authorId}`} className="flex items-center">
            <Avatar 
              src={currentPost.author?.photoURL || ''} 
              alt={currentPost.author?.displayName || 'User'} 
              size="md"
              className="mr-3"
            />
            <div>
              <div className="font-medium flex items-center">
                {currentPost.author?.displayName || 'User'}
                {currentPost.author?.handicapIndex !== undefined && currentPost.author?.handicapIndex !== null && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {formatHandicapIndex(currentPost.author.handicapIndex)}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {getRelativeTimeString(currentPost.createdAt)}
                {currentPost.location && (
                  <> • {currentPost.location.name}</>
                )}
              </div>
            </div>
          </Link>
          
          {/* Add PostMenu component */}
          <PostMenu post={currentPost} onDeleted={handlePostDeleted} />
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

        {/* Post Tags */}
        {currentPost.hashtags && currentPost.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {currentPost.hashtags.map(tag => (
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
          isLiked={currentPost.likedByUser || false}
          likeCount={currentPost.likes || 0}
          commentCount={currentPost.comments || 0}
          onLike={onLike || (() => {})}
          onComment={handleCommentClick}
          onShare={onShare || (() => {})}
          extraActions={extraActions}
          isLoading={loading}
          pendingLike={pendingLike}
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
    </>
  );

  // Use the PostListener for real-time updates when visible
  // Force isVisible to true to ensure the listener stays active
  return (
    <Card 
      className={`hover:shadow-md transition-all duration-300 ${fadeOut ? 'opacity-0 transform translate-y-4' : 'opacity-100'}`}
    >
      <PostListener 
        postId={post.id} 
        initialData={post} 
        isVisible={true} // Always keep listener active
        priority={showComments ? 8 : 5} // Give higher priority to posts with open comments
      >
        {(updatedPost, isLoadingData) => renderCardContent(
          updatedPost, 
          isLoadingData || isLoading
        )}
      </PostListener>
    </Card>
  );
}