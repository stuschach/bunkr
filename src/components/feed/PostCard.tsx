// src/components/feed/PostCard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MediaGallery } from '@/components/common/media/MediaGallery';
import { formatHandicapIndex } from '@/lib/utils/formatting';
import { getRelativeTimeString } from '@/lib/utils/date-format';
import { Post, Comment } from '@/types/post';
import { Input } from '@/components/ui/Input';
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

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Post Header */}
        <div className="flex items-center mb-4">
          <Link href={`/profile/${post.authorId}`} className="flex items-center">
            <Avatar 
              src={post.author?.photoURL} 
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
        <div className="flex items-center justify-between w-full text-gray-500 dark:text-gray-400">
          <Button 
            variant="ghost" 
            size="sm" 
            className={post.likedByUser ? "text-green-500" : ""}
            onClick={onLike}
          >
            <svg
              className="mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={post.likedByUser ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            {post.likes > 0 && <span>{post.likes}</span>}
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              // Toggle comment input visibility
              setShowCommentInput(!showCommentInput);
              // Toggle showing comments
              setShowComments(!showComments);
              // Only call the onComment prop if needed for analytics or other purposes
              if (onComment) {
                onComment();
              }
            }}
          >
            <svg
              className="mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {post.comments > 0 && <span>{post.comments}</span>}
          </Button>
          
          <Button variant="ghost" size="sm" onClick={onShare}>
            <svg
              className="mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </Button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="mt-4 w-full">
            {/* Comment list */}
            {loadingComments ? (
              <div className="flex justify-center py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-green-500"></div>
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-3">
                {comments.map(comment => (
                  <div key={comment.id} className="flex space-x-2 text-sm">
                    <Avatar 
                      src={comment.author?.photoURL} 
                      alt={comment.author?.displayName || 'User'} 
                      size="sm" 
                    />
                    <div className="flex-1">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                        <div className="font-medium text-xs">
                          {comment.author?.displayName || 'User'}
                        </div>
                        <div className="mt-1">{comment.text}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {getRelativeTimeString(comment.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-2 text-sm">
                No comments yet
              </div>
            )}
          </div>
        )}

        {/* Comment input section */}
        {showCommentInput && user && (
          <div className="mt-4 w-full">
            <div className="flex space-x-2">
              <Avatar 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                size="sm" 
              />
              <div className="flex-1">
                <Input
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="mb-2"
                />
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setShowCommentInput(false);
                      setCommentText('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSubmitComment}
                    disabled={!commentText.trim() || isSubmittingComment}
                    isLoading={isSubmittingComment}
                  >
                    Comment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}