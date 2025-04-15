// src/components/feed/RoundShareCard.tsx
// Modified to include notifications for comments on round posts

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { formatScoreWithRelationToPar } from '@/lib/utils/formatting';
import { Scorecard, HoleData } from '@/types/scorecard';
import { UserProfile } from '@/types/auth';
import { useAuth } from '@/lib/contexts/AuthContext';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
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
import { Comment, Post } from '@/types/post';
import { PostActions } from '@/components/common/social/PostActions';
import { CommentSection } from '@/components/common/social/CommentSection';
import { fetchFullRoundData } from '@/lib/firebase/feed-service';
import { useNotificationCreator } from '@/lib/hooks/useNotificationCreator';

interface RoundShareCardProps {
  round: Scorecard | Post;
  user: UserProfile;
  postId?: string;
  showActions?: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  likedByUser?: boolean;
  likes?: number;
  comments?: number;
  // New props for virtualization support
  isExpanded?: boolean;
  onToggleExpand?: (isExpanded: boolean) => void;
}

export function RoundShareCard({ 
  round, 
  user,
  postId,
  showActions = true,
  onLike,
  onComment,
  onShare,
  likedByUser = false,
  likes = 0,
  comments = 0,
  // Handle the new props with defaults
  isExpanded: externalExpanded,
  onToggleExpand
}: RoundShareCardProps) {
  const { user: currentUser } = useAuth();
  const { notifyComment } = useNotificationCreator();
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [postComments, setPostComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showComments, setShowComments] = useState(false);
  
  // Use local state, but respect external control if provided
  const [localExpanded, setLocalExpanded] = useState(false);
  
  // Determine if expanded based on props or local state
  const isExpanded = externalExpanded !== undefined ? externalExpanded : localExpanded;
  
  // Add state for full round data
  const [fullRoundData, setFullRoundData] = useState<Scorecard | null>(null);
  const [loadingFullData, setLoadingFullData] = useState(false);
  
  // Detect if this is a Post object or a Scorecard object
  const isPostType = 'postType' in round;
  
  // Extract the round ID for fetching complete data
  const roundId = isPostType ? (round as Post).roundId : (round as Scorecard).id;
  
  // Extract authorId safely
  const authorId = isPostType ? (round as Post).authorId : 
                  ('authorId' in round ? round.authorId : user.uid);
  
  // Safely extract data with fallbacks regardless of source
  const roundStats = round.stats || {};
  const courseName = 'courseName' in round ? round.courseName : 
                    (round.location?.name || 'Unknown Course');
  const coursePar = 'coursePar' in round ? round.coursePar : 72;
  
  // Only use holes from fullRoundData if available, otherwise use holes from round if they exist
  const holes: HoleData[] = fullRoundData ? fullRoundData.holes : 
                            ('holes' in round && Array.isArray(round.holes)) ? round.holes : [];
  
  const teeBox = 'teeBox' in round ? round.teeBox : { name: 'Default', yardage: 0 };
  const roundDate = 'date' in round ? round.date : new Date();
  
  // Calculate front 9, back 9, and total scores from available holes
  const frontNine = holes.filter(hole => hole && hole.number <= 9);
  const backNine = holes.filter(hole => hole && hole.number > 9);
  
  const frontNinePar = frontNine.reduce((sum, hole) => sum + (hole?.par || 0), 0);
  const frontNineScore = frontNine.reduce((sum, hole) => sum + (hole?.score || 0), 0);
  const backNinePar = backNine.reduce((sum, hole) => sum + (hole?.par || 0), 0);
  const backNineScore = backNine.reduce((sum, hole) => sum + (hole?.score || 0), 0);
  
  // Safely calculate total score
  const totalScore = 'totalScore' in round ? round.totalScore : 
                     (frontNineScore + backNineScore) || 0;
  
  // Calculate stats percentages for visualizations with safety checks
  const fairwayPercentage = roundStats.fairwaysTotal ? 
    (roundStats.fairwaysHit / roundStats.fairwaysTotal) * 100 : 0;
    
  const girPercentage = roundStats.greensInRegulation ? 
    (roundStats.greensInRegulation / 18) * 100 : 0;
    
  const averagePutts = roundStats.totalPutts ? 
    roundStats.totalPutts / 18 : 0;
  
  // Function to fetch full round data when expanded
  const fetchCompleteRoundData = useCallback(async () => {
    if (!roundId || fullRoundData) return;
    
    setLoadingFullData(true);
    try {
      const data = await fetchFullRoundData(roundId);
      if (data) {
        setFullRoundData(data);
      }
    } catch (error) {
      console.error('Error fetching complete round data:', error);
    } finally {
      setLoadingFullData(false);
    }
  }, [roundId, fullRoundData]);
  
  // Fetch comments when showComments is toggled on
  useEffect(() => {
    if (showComments && postId) {
      fetchComments();
    }
  }, [showComments, postId]);
  
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
    if (!postId || loadingComments) return;
    
    try {
      setLoadingComments(true);
      
      // Query comments for this post
      const commentsQuery = query(
        collection(db, 'posts', postId, 'comments'),
        orderBy('createdAt', 'desc')
      );
      
      const commentsSnapshot = await getDocs(commentsQuery);
      
      // Process comments with user data
      const commentsData = await Promise.all(commentsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const author = await fetchUserData(data.authorId);
        
        return {
          id: doc.id,
          postId: postId,
          authorId: data.authorId,
          author: author,
          text: data.text,
          createdAt: data.createdAt?.toDate() || new Date(),
          likes: data.likes || 0,
          likedByUser: false // Default, can be updated if needed
        } as Comment;
      }));
      
      setPostComments(commentsData);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };
  
  // Handle comment submission
  const handleSubmitComment = async () => {
    if (!currentUser || !commentText.trim() || isSubmittingComment || !postId) return;

    try {
      setIsSubmittingComment(true);

      // Add comment to the comments subcollection
      const commentRef = await addDoc(collection(db, 'posts', postId, 'comments'), {
        authorId: currentUser.uid,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
        likes: 0
      });

      // Update the comment count on the post
      await updateDoc(doc(db, 'posts', postId), {
        comments: increment(1)
      });

      // Create a new comment object for the UI
      const newComment: Comment = {
        id: commentRef.id,
        postId: postId,
        authorId: currentUser.uid,
        author: currentUser,
        text: commentText.trim(),
        createdAt: new Date(),
        likes: 0,
        likedByUser: false
      };

      // Add the new comment to the state
      setPostComments(prevComments => [newComment, ...prevComments]);
      
      // Ensure comments are visible
      setShowComments(true);
      
      // Reset form state
      setCommentText('');
      
      // Send notification to round post author (if not self-commenting)
      if (authorId && authorId !== currentUser.uid) {
        await notifyComment(
          postId,
          authorId,
          commentText.trim(),
          `Round at ${courseName} (${totalScore})`
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

  // Get score colors based on relation to par
  const getScoreColor = (score: number, par: number) => {
    const diff = score - par;
    if (diff < 0) return 'text-green-500'; // Under par
    if (diff === 0) return 'text-gray-700 dark:text-gray-300'; // Par
    return 'text-red-500'; // Over par
  };
  
  // Get date in formatted string
  const playedDate = roundDate ? 
    (typeof roundDate === 'string' ? new Date(roundDate) : 
    roundDate instanceof Date ? roundDate : new Date()).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) : 'Unknown date';

  // Toggle expanded view - updated to support virtualization
  const toggleExpand = () => {
    if (!isExpanded && !fullRoundData) {
      fetchCompleteRoundData();
    }
    
    // Update local state
    const newExpandedState = !isExpanded;
    setLocalExpanded(newExpandedState);
    
    // Notify parent component if callback provided
    if (onToggleExpand) {
      onToggleExpand(newExpandedState);
    }
  };

  // Extract scorecard highlights (best holes, worst holes)
  const getScoreHighlights = () => {
    const availableHoles = fullRoundData?.holes || 
      (('holes' in round && Array.isArray(round.holes)) ? round.holes : []);
      
    if (!availableHoles || availableHoles.length === 0) return null;
    
    const sortedHoles = [...availableHoles]
      .filter(h => h && h.score && h.par)
      .sort((a, b) => {
        const aRelation = a.score - a.par;
        const bRelation = b.score - b.par;
        return aRelation - bRelation;
      });
    
    if (sortedHoles.length === 0) return null;
    
    const bestHole = sortedHoles[0];
    const worstHole = sortedHoles[sortedHoles.length - 1];
    
    return { bestHole, worstHole };
  };
  
  const scoreHighlights = getScoreHighlights();

  // Ensure user object has required fields
  const userPhotoURL = user?.photoURL || '';
  const userDisplayName = user?.displayName || 'User';

  // ScorecardSummary component
  const ScorecardSummary = () => (
    <div 
      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-3 rounded-md transition-colors mt-4" 
      onClick={toggleExpand}
    >
      <div className="flex justify-between items-center">
        <div className="text-sm font-medium">View Full Scorecard</div>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Mini scorecard summary */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <div>Front: {frontNineScore || 0} ({formatScoreWithRelationToPar(frontNineScore || 0, frontNinePar || 36)})</div>
        {backNine.length > 0 && (
          <div>Back: {backNineScore || 0} ({formatScoreWithRelationToPar(backNineScore || 0, backNinePar || 36)})</div>
        )}
      </div>
    </div>
  );

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center mb-1">
              <Link href={`/profile/${user.uid}`} className="flex items-center">
                <Avatar 
                  src={userPhotoURL} 
                  alt={userDisplayName} 
                  size="sm"
                  className="mr-2"
                />
                <div className="font-medium">
                  {userDisplayName}
                </div>
              </Link>
              <span className="text-gray-500 text-xs mx-2">posted a round</span>
            </div>
            <CardTitle className="text-lg">{courseName || 'Unnamed Course'}</CardTitle>
            <div className="text-sm text-gray-500 dark:text-gray-400">{playedDate}</div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getScoreColor(totalScore, coursePar)}`}>
              {formatScoreWithRelationToPar(totalScore, coursePar)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {teeBox?.name || 'Default'} • {teeBox?.yardage ? `${teeBox.yardage} yards` : 'N/A'}
            </div>
          </div>
        </div>
        
        {/* Score Highlights */}
        {scoreHighlights && scoreHighlights.bestHole && (
          <div className="mt-2 flex flex-wrap gap-2">
            {scoreHighlights.bestHole.score < scoreHighlights.bestHole.par && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {scoreHighlights.bestHole.score === scoreHighlights.bestHole.par - 1 ? 'Birdie' : 
                 scoreHighlights.bestHole.score === scoreHighlights.bestHole.par - 2 ? 'Eagle' : 'Double Eagle'} on Hole {scoreHighlights.bestHole.number}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {/* Stats Overview - Always shown */}
        {roundStats && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Fairways</div>
              <div className="text-lg font-medium">
                {roundStats.fairwaysHit || 0}/{roundStats.fairwaysTotal || 0}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-1">
                <div 
                  className="bg-green-500 h-full rounded-full" 
                  style={{ width: `${fairwayPercentage}%` }}
                ></div>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">GIR</div>
              <div className="text-lg font-medium">
                {roundStats.greensInRegulation || 0}/18
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-1">
                <div 
                  className="bg-green-500 h-full rounded-full" 
                  style={{ width: `${girPercentage}%` }}
                ></div>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Putts</div>
              <div className="text-lg font-medium">
                {roundStats.totalPutts || 0} ({averagePutts.toFixed(1)}/hole)
              </div>
            </div>
          </div>
        )}
        
        {/* Score Distribution - Always shown */}
        {roundStats && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2 mt-2">
              {roundStats.eagles && roundStats.eagles > 0 && (
                <Badge variant="success" className="bg-green-600">
                  {roundStats.eagles} Eagle{roundStats.eagles > 1 ? 's' : ''}
                </Badge>
              )}
              {roundStats.birdies && roundStats.birdies > 0 && (
                <Badge variant="success">
                  {roundStats.birdies} Birdie{roundStats.birdies > 1 ? 's' : ''}
                </Badge>
              )}
              {roundStats.pars && roundStats.pars > 0 && (
                <Badge variant="secondary">
                  {roundStats.pars} Par{roundStats.pars > 1 ? 's' : ''}
                </Badge>
              )}
              {roundStats.bogeys && roundStats.bogeys > 0 && (
                <Badge variant="outline" className="text-red-500 border-red-500">
                  {roundStats.bogeys} Bogey{roundStats.bogeys > 1 ? 's' : ''}
                </Badge>
              )}
              {roundStats.doubleBogeys && roundStats.doubleBogeys > 0 && (
                <Badge variant="error">
                  {roundStats.doubleBogeys} Double{roundStats.doubleBogeys > 1 ? 's' : ''}
                </Badge>
              )}
              {roundStats.worseThanDouble && roundStats.worseThanDouble > 0 && (
                <Badge variant="error" className="bg-red-700">
                  {roundStats.worseThanDouble} Other
                </Badge>
              )}
            </div>
          </div>
        )}
        
        {/* Collapsible section */}
        {!isExpanded ? (
          <ScorecardSummary />
        ) : (
          <div className="mt-4">
            {/* Loading indicator */}
            {loadingFullData && (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="md" color="primary" label="Loading full scorecard..." />
              </div>
            )}
            
            {/* Animated container for scorecard tables */}
            <div className={`transition-all duration-300 ease-in-out ${loadingFullData ? 'opacity-50' : 'opacity-100'}`}>
              {/* Front Nine Table */}
              {frontNine.length > 0 && (
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full align-middle">
                    <div className="border rounded-md overflow-hidden border-gray-200 dark:border-gray-700">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Hole</th>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(holeNum => (
                              <th key={holeNum} className="px-3 py-2 text-center font-medium">{holeNum}</th>
                            ))}
                            <th className="px-3 py-2 text-center font-medium">OUT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          <tr className="bg-white dark:bg-gray-900">
                            <td className="px-3 py-2 font-medium">Par</td>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(holeNum => {
                              const hole = frontNine.find(h => h && h.number === holeNum);
                              return (
                                <td key={`par-${holeNum}`} className="px-3 py-2 text-center">
                                  {hole?.par || '-'}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-center font-medium">
                              {frontNinePar || '-'}
                            </td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-800">
                            <td className="px-3 py-2 font-medium">Score</td>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(holeNum => {
                              const hole = frontNine.find(h => h && h.number === holeNum);
                              if (!hole) return (
                                <td key={`score-${holeNum}`} className="px-3 py-2 text-center">-</td>
                              );
                              
                              return (
                                <td 
                                  key={`score-${holeNum}`} 
                                  className={`px-3 py-2 text-center ${hole.score && hole.par ? getScoreColor(hole.score, hole.par) : ''}`}
                                >
                                  {hole.score || '-'}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-center font-medium">
                              {frontNineScore || '-'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Back Nine Table */}
              {backNine.length > 0 && (
                <div className="overflow-x-auto mt-4">
                  <div className="inline-block min-w-full align-middle">
                    <div className="border rounded-md overflow-hidden border-gray-200 dark:border-gray-700">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Hole</th>
                            {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(holeNum => (
                              <th key={holeNum} className="px-3 py-2 text-center font-medium">{holeNum}</th>
                            ))}
                            <th className="px-3 py-2 text-center font-medium">IN</th>
                            <th className="px-3 py-2 text-center font-medium">TOT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          <tr className="bg-white dark:bg-gray-900">
                            <td className="px-3 py-2 font-medium">Par</td>
                            {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(holeNum => {
                              const hole = backNine.find(h => h && h.number === holeNum);
                              return (
                                <td key={`par-${holeNum}`} className="px-3 py-2 text-center">
                                  {hole?.par || '-'}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-center font-medium">{backNinePar || '-'}</td>
                            <td className="px-3 py-2 text-center font-medium">
                              {(frontNinePar || 0) + (backNinePar || 0) || '-'}
                            </td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-800">
                            <td className="px-3 py-2 font-medium">Score</td>
                            {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(holeNum => {
                              const hole = backNine.find(h => h && h.number === holeNum);
                              if (!hole) return (
                                <td key={`score-${holeNum}`} className="px-3 py-2 text-center">-</td>
                              );
                              
                              return (
                                <td 
                                  key={`score-${holeNum}`} 
                                  className={`px-3 py-2 text-center ${hole.score && hole.par ? getScoreColor(hole.score, hole.par) : ''}`}
                                >
                                  {hole.score || '-'}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-center font-medium">{backNineScore || '-'}</td>
                            <td className="px-3 py-2 text-center font-medium">
                              {(frontNineScore || 0) + (backNineScore || 0) || '-'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Collapse button */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleExpand} 
                className="mt-3 w-full flex justify-center items-center"
              >
                <span>Collapse Scorecard</span>
                <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      {showActions && (
        <CardFooter className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-col">
          <PostActions
            isLiked={likedByUser || false}
            likeCount={likes}
            commentCount={comments}
            onLike={onLike || (() => {})}
            onComment={handleCommentClick}
            onShare={onShare || (() => {})}
          />

          <CommentSection
            currentUser={currentUser}
            comments={postComments}
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
      )}
    </Card>
  );
}