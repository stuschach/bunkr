// src/components/common/social/CommentSection.tsx
import React from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getRelativeTimeString } from '@/lib/utils/date-format';
import { Comment } from '@/types/post';
import { UserProfile } from '@/types/auth';

interface CommentSectionProps {
  currentUser: UserProfile | null;
  comments: Comment[];
  showComments: boolean;
  showCommentInput: boolean;
  loadingComments: boolean;
  commentText: string;
  setCommentText: (text: string) => void;
  setShowCommentInput: (show: boolean) => void;
  handleSubmitComment: () => void;
  isSubmittingComment: boolean;
}

export function CommentSection({
  currentUser,
  comments,
  showComments,
  showCommentInput,
  loadingComments,
  commentText,
  setCommentText,
  setShowCommentInput,
  handleSubmitComment,
  isSubmittingComment,
}: CommentSectionProps) {
  return (
    <>
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
      {showCommentInput && currentUser && (
        <div className="mt-4 w-full">
          <div className="flex space-x-2">
            <Avatar 
              src={currentUser.photoURL} 
              alt={currentUser.displayName || 'User'} 
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
    </>
  );
}