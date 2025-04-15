// src/components/feed/PostCard.tsx
import React, { useState, useCallback, useEffect, memo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { PostActions } from '@/components/common/social/PostActions';
import { PostMenu } from '@/components/common/social/PostMenu';
import { Input } from '@/components/ui/Input';
import { format } from 'date-fns';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotificationCreator } from '@/lib/hooks/useNotificationCreator';
import { Post } from '@/types/post';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  increment, 
  doc 
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useVisibilityObserver } from '@/lib/hooks/useVisibilityObserver';

interface PostCardProps {
  post: Post;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onDelete: (postId: string) => void;
  isVisible?: boolean;
  pendingLike?: boolean;
}

export const PostCard = memo(({
  post,
  onLike,
  onComment,
  onShare,
  onDelete,
  isVisible = true,
  pendingLike = false
}: PostCardProps) => {
  const { user } = useAuth();
  const { notifyComment, notifyMention } = useNotificationCreator();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [isPostVisible, setIsPostVisible] = useState(isVisible);
  
  // Format the date
  const formatDate = useCallback((date: Date) => {
    try {
      return format(date, 'MMM d, yyyy • h:mm a');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown date';
    }
  }, []);
  
  // Set up visibility observer
  const { isElementVisible, registerElement } = useVisibilityObserver({
    threshold: 0.3,
    onVisibilityChange: (id, visible) => {
      if (id === post.id) {
        setIsPostVisible(visible);
      }
    }
  });
  
  // Register this element for visibility tracking
  useEffect(() => {
    const element = document.getElementById(`post-${post.id}`);
    if (element) {
      registerElement(post.id, element);
    }
    
    return () => {
      registerElement(post.id, null);
    };
  }, [post.id, registerElement]);
  
  // Load comments when showing comments
  useEffect(() => {
    if (showComments && !loadingComments && comments.length === 0) {
      loadComments();
    }
  }, [showComments]);
  
  // Load comments for this post
  const loadComments = async () => {
    if (loadingComments) return;
    
    setLoadingComments(true);
    
    try {
      // Query for comments
      const commentsQuery = collection(db, 'posts', post.id, 'comments');
      const commentsSnapshot = await getDocs(commentsQuery);
      
      // Process comments
      const commentsData = await Promise.all(commentsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        
        // Get author data if needed
        let author = null;
        if (data.authorId) {
          const authorDoc = await getDoc(doc(db, 'users', data.authorId));
          if (authorDoc.exists()) {
            author = {
              uid: data.authorId,
              displayName: authorDoc.data().displayName || 'User',
              photoURL: authorDoc.data().photoURL || null
            };
          }
        }
        
        return {
          id: doc.id,
          text: data.text,
          authorId: data.authorId,
          author,
          createdAt: data.createdAt?.toDate() || new Date()
        };
      }));
      
      // Sort by date (newest first)
      commentsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };
  
  // Handle comment button click
  const handleCommentClick = () => {
    setShowComments(!showComments);
    onComment();
  };
  
  // Handle comment submission
  const handleCommentSubmit = async () => {
    if (!user || !commentText.trim() || isSubmittingComment) return;
    
    setIsSubmittingComment(true);
    
    try {
      // Add comment to Firebase
      const commentRef = await addDoc(collection(db, 'posts', post.id, 'comments'), {
        authorId: user.uid,
        text: commentText.trim(),
        createdAt: serverTimestamp()
      });
      
      // Update comment count on post
      await updateDoc(doc(db, 'posts', post.id), {
        comments: increment(1)
      });
      
      // Add to local comments
      const newComment = {
        id: commentRef.id,
        text: commentText.trim(),
        authorId: user.uid,
        author: {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL
        },
        createdAt: new Date()
      };
      
      setComments([newComment, ...comments]);
      setCommentText('');
      
      // Send notification if commenting on someone else's post
      if (post.authorId !== user.uid) {
        try {
          // Determine post type for better notification
          let postTypeHint = "post";
          let notificationContent = post.content || "post";
          
          if (post.postType === 'round') {
            postTypeHint = "round";
            notificationContent = `Round at ${post.courseName || 'golf course'}`;
          } else if (post.postType === 'tee-time') {
            postTypeHint = "tee time";
            notificationContent = `Tee time at ${post.courseName || 'golf course'}`;
          } else if (post.media && post.media.length > 0) {
            postTypeHint = post.media[0].type === 'image' ? "photo" : "video";
            notificationContent = post.content || `${post.author?.displayName || 'User'}'s ${postTypeHint}`;
          }
          
          await notifyComment(post.id, post.authorId, commentText.trim(), notificationContent);
        } catch (error) {
          console.error('Error sending comment notification:', error);
        }
      }
      
      // Process @mentions in the comment
      const mentionRegex = /@(\w+)/g;
      let match;
      
      while ((match = mentionRegex.exec(commentText)) !== null) {
        const username = match[1];
        // Here you would need to resolve usernames to user IDs
        // This is just a placeholder
        try {
          // const userId = await getUserIdByUsername(username);
          // if (userId && userId !== user.uid && userId !== post.authorId) {
          //   await notifyMention(userId, post.id, 'comment', commentText);
          // }
        } catch (error) {
          console.error(`Error handling mention for ${username}:`, error);
        }
      }
      
      // Refresh post data (call parent handler)
      onComment();
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };
  
  // Handle delete post
  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(post.id);
    }
  }, [post.id, onDelete]);
  
  // Render media content 
  const renderMedia = () => {
    if (!post.media || post.media.length === 0) return null;
    
    // Only render first media item for now
    const mediaItem = post.media[0];
    
    if (mediaItem.type === 'image') {
      return (
        <div className="mt-3 overflow-hidden rounded-lg">
          <img 
            src={mediaItem.url} 
            alt="Post image" 
            className="w-full object-cover max-h-[400px]"
            loading="lazy"
          />
        </div>
      );
    } else if (mediaItem.type === 'video') {
      return (
        <div className="mt-3 overflow-hidden rounded-lg">
          <video 
            src={mediaItem.url} 
            controls
            className="w-full max-h-[400px]"
            preload="metadata"
          />
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <Card id={`post-${post.id}`} className="mb-4 hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex justify-between items-start space-y-0 pb-3">
        <div className="flex space-x-3">
          <Link href={`/profile/${post.author?.uid}`}>
            <Avatar 
              src={post.author?.photoURL} 
              alt={post.author?.displayName || 'User'} 
              size="md" 
            />
          </Link>
          
          <div className="flex flex-col">
            <Link href={`/profile/${post.author?.uid}`} className="font-medium hover:underline">
              {post.author?.displayName || 'User'}
            </Link>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(post.createdAt)}
            </span>
          </div>
        </div>
        
        {user && (user.uid === post.authorId || user.isAdmin) && (
          <PostMenu post={post} onDeleted={handleDelete} />
        )}
      </CardHeader>
      
      <CardContent className="py-2">
        {/* Post text content */}
        <div className="whitespace-pre-wrap">{post.content}</div>
        
        {/* Post media */}
        {renderMedia()}
        
        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {post.hashtags.map((tag, index) => (
              <Link 
                key={index} 
                href={`/hashtag/${tag}`}
                className="text-green-500 hover:text-green-600 text-sm"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-1 pb-2 flex flex-col space-y-3">
        {/* Action buttons */}
        <PostActions 
          isLiked={post.likedByUser || false}
          likeCount={post.likes || 0}
          commentCount={post.comments || 0}
          onLike={onLike}
          onComment={handleCommentClick}
          onShare={onShare}
          pendingLike={pendingLike}
        />
        
        {/* Comments section */}
        {showComments && (
          <div className="w-full mt-2">
            {/* Comment input */}
            {user && (
              <div className="flex space-x-2 mb-3">
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleCommentSubmit();
                      }
                    }}
                    disabled={isSubmittingComment}
                  />
                  <div className="flex justify-end mt-1">
                    <Button 
                      size="sm"
                      onClick={handleCommentSubmit}
                      disabled={!commentText.trim() || isSubmittingComment}
                      isLoading={isSubmittingComment}
                    >
                      Post
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Comments list */}
            {loadingComments ? (
              <div className="flex justify-center py-3">
                <div className="animate-spin h-5 w-5 border-2 border-green-500 rounded-full border-t-transparent"></div>
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-2">
                    <Link href={`/profile/${comment.authorId}`}>
                      <Avatar 
                        src={comment.author?.photoURL} 
                        alt={comment.author?.displayName || 'User'} 
                        size="sm" 
                      />
                    </Link>
                    <div className="flex-1">
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2">
                        <Link 
                          href={`/profile/${comment.authorId}`}
                          className="font-medium text-sm hover:underline"
                        >
                          {comment.author?.displayName || 'User'}
                        </Link>
                        <div className="text-sm mt-1">{comment.text}</div>
                      </div>
                      <div className="flex space-x-3 text-xs text-gray-500 mt-1">
                        <span>{format(comment.createdAt, 'MMM d, yyyy • h:mm a')}</span>
                        <button className="hover:text-gray-700">Like</button>
                        <button className="hover:text-gray-700">Reply</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3 text-gray-500">
                No comments yet. Be the first to comment!
              </div>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
});

PostCard.displayName = 'PostCard';

export default PostCard;

// Helper function to safely get Firestore data
async function getDocs(query: any) {
  try {
    return await getDocs(query);
  } catch (error) {
    console.error('Error in getDocs:', error);
    return { docs: [] };
  }
}

// Helper function to safely get a document
async function getDoc(docRef: any) {
  try {
    return await getDoc(docRef);
  } catch (error) {
    console.error('Error in getDoc:', error);
    return {
      exists: () => false,
      data: () => ({})
    };
  }
}