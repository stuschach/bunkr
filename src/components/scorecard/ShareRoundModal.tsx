// src/components/scorecard/ShareRoundModal.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotification } from '@/lib/contexts/NotificationContext';

import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Scorecard } from '@/types/scorecard';
import { formatScoreWithRelationToPar } from '@/lib/utils/formatting';

interface ShareRoundModalProps {
  open: boolean;
  onClose: () => void;
  scorecard: Scorecard;
}

export function ShareRoundModal({ open, onClose, scorecard }: ShareRoundModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [message, setMessage] = useState<string>('');
  const [isSharing, setIsSharing] = useState<boolean>(false);

  // Generate default message based on scorecard
  React.useEffect(() => {
    if (scorecard) {
      const scoreText = formatScoreWithRelationToPar(scorecard.totalScore, scorecard.coursePar);
      setMessage(`Just finished a round at ${scorecard.courseName} with a score of ${scoreText}!`);
    }
  }, [scorecard]);

  const handleShareToFeed = async () => {
    if (!user) {
      showNotification({
        type: 'error',
        title: 'Authentication required',
        description: 'You must be logged in to share to the feed'
      });
      return;
    }

    setIsSharing(true);

    try {
      // Create a new post in the 'posts' collection
      const postData = {
        authorId: user.uid,
        content: message,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        postType: 'round',
        roundId: scorecard.id,
        location: {
          name: scorecard.courseName,
          id: scorecard.courseId
        },
        visibility: 'public',
        likes: 0,
        comments: 0,
        likedByUser: false,
        hashtags: ['golf', 'scorecard'],
        media: [] // No media for now
      };

      const postRef = await addDoc(collection(db, 'posts'), postData);

      showNotification({
        type: 'success',
        title: 'Round shared',
        description: 'Your round has been shared to your feed'
      });

      // Close the modal
      onClose();

      // Navigate to the feed to see the post
      router.push('/feed');
    } catch (error) {
      console.error('Error sharing round:', error);
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to share your round. Please try again.'
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Share Round to Feed</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="mb-4">
          <label 
            htmlFor="share-message" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Message
          </label>
          <textarea
            id="share-message"
            rows={4}
            className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-gray-700 dark:text-gray-100"
            placeholder="Share some thoughts about your round..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          ></textarea>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Round Details:
          </div>
          <div className="text-base font-medium">
            {scorecard.courseName} • {formatScoreWithRelationToPar(scorecard.totalScore, scorecard.coursePar)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(scorecard.date).toLocaleDateString()} • {scorecard.teeBox.name} tees
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isSharing}>
          Cancel
        </Button>
        <Button 
          onClick={handleShareToFeed} 
          isLoading={isSharing}
          disabled={isSharing || !message.trim()}
        >
          Share to Feed
        </Button>
      </DialogFooter>
    </Dialog>
  );
}