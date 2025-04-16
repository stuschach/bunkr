// src/index.ts
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Import and re-export the functions
export {
  deletePostReferences,
  onPostDeleted,
  scheduledOrphanedFeedCleanup
} from './deletePostReferences.function';

// Export messaging functions
export {
  sendMessage,
  markChatAsRead,
  getChatMessages,
  getOrCreateChat,
  getTotalUnreadCount,
  searchUsers,
  onUserUpdated,
  onUserDeleted
} from './messaging.function';

// Export notification functions
export {
  cleanupOldNotifications,
  onUserDeleted as onUserDeletedNotifications,
  onPostDeleted as onPostDeletedNotifications,
  onNotificationCreated,
  updateNotificationMetrics
} from './notification.functions';

// Export scorecard functions
export {
  onScorecardUpdated,
  scheduledHandicapUpdate,
  onPostDeleted as onPostDeletedScorecard,
  handicapFunctions
} from './scorecard.functions';

// Log initialization
logger.info('Firebase Functions initialized');