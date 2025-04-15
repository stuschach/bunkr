// src/components/common/social/PostMenu.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu'; // Now using our custom Menu component
import { usePostDeletion } from '@/lib/hooks/usePostDeletion';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Post } from '@/types/post';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/Dialog';

interface PostMenuProps {
  post: Post;
  onDeleted?: () => void;
}

export function PostMenu({ post, onDeleted }: PostMenuProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { deletePost, isDeleting } = usePostDeletion();
  const [showDialog, setShowDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState<'user_requested' | 'privacy_violation' | 'content_policy'>('user_requested');
  
  // Check if current user is the author
  const isAuthor = user?.uid === post.authorId;
  
  // Check if the current user is an admin (this would be implemented based on your app's logic)
  const isAdmin = user?.role === 'admin' || false;
  
  // Identify post type for better UX
  const getPostTypeLabel = () => {
    if (post.postType === 'round') return 'round';
    if (post.postType === 'tee-time') return 'tee time';
    if (post.media && post.media.length > 0) {
      return post.media[0].type === 'image' ? 'photo' : 'video';
    }
    return 'post';
  };
  
  const handleDelete = async () => {
    const success = await deletePost(post.id, {
      skipConfirmation: true, // We already confirmed in our dialog
      showSuccess: true,
      reason: deleteReason,
      refreshFeed: true
    });
    
    if (success && onDeleted) {
      onDeleted();
    }
    
    setShowDialog(false);
  };
  
  const handleEdit = () => {
    router.push(`/edit-post/${post.id}`);
  };
  
  const handleReport = () => {
    router.push(`/report?type=post&id=${post.id}`);
  };
  
  return (
    <>
      <Menu>
        <Menu.Button asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Post menu"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" 
              />
            </svg>
          </Button>
        </Menu.Button>
        <Menu.Items>
          {/* Edit option - only for author */}
          {isAuthor && (
            <Menu.Item onClick={handleEdit}>
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-4 w-4 mr-2 inline" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
                  />
                </svg>
                Edit {getPostTypeLabel()}
              </button>
            </Menu.Item>
          )}
          
          {/* Copy link option */}
          <Menu.Item onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
          }}>
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 mr-2 inline" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" 
                />
              </svg>
              Copy link
            </button>
          </Menu.Item>
          
          {/* Delete option - only for author or admin */}
          {(isAuthor || isAdmin) && (
            <Menu.Item 
              onClick={() => setShowDialog(true)}
              disabled={isDeleting[post.id]}
            >
              <button
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                disabled={isDeleting[post.id]}
              >
                {isDeleting[post.id] ? (
                  <>
                    <svg 
                      className="animate-spin h-4 w-4 mr-2 inline" 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24"
                    >
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                      ></circle>
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-4 w-4 mr-2 inline" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                      />
                    </svg>
                    Delete {getPostTypeLabel()}
                  </>
                )}
              </button>
            </Menu.Item>
          )}
          
          {/* Report option - only for non-authors */}
          {!isAuthor && (
            <Menu.Item onClick={handleReport}>
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-4 w-4 mr-2 inline" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                  />
                </svg>
                Report {getPostTypeLabel()}
              </button>
            </Menu.Item>
          )}
        </Menu.Items>
      </Menu>
      
      {/* Confirmation Dialog */}
      {showDialog && (
        <Dialog 
          open={showDialog} 
          onClose={() => setShowDialog(false)}
        >
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">
              Delete {getPostTypeLabel()}?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This action cannot be undone. This will permanently delete the {getPostTypeLabel()}
              {post.postType === 'round' ? ' and remove it from your profile, stats, and feeds.' : 
               post.postType === 'tee-time' ? ' and cancel any associated tee time.' : 
               ' and remove it from all feeds.'}
            </p>
            
            {/* Only show reason selection for admins */}
            {isAdmin && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for deletion
                </label>
                <select
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value as any)}
                >
                  <option value="user_requested">User requested</option>
                  <option value="privacy_violation">Privacy violation</option>
                  <option value="content_policy">Content policy violation</option>
                </select>
              </div>
            )}
            
            <div className="flex justify-end space-x-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting[post.id]}
                isLoading={isDeleting[post.id]}
              >
                {isDeleting[post.id] ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}