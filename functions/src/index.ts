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

// Log initialization
logger.info('Firebase Functions initialized');