// src/components/common/MessageNotificationListener.tsx
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useStore } from '@/store';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  getDocs 
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export function MessageNotificationListener() {
  const { user } = useAuth();
  const setUnreadMessageCount = useStore(state => state.setUnreadMessageCount);

  useEffect(() => {
    if (!user) {
      setUnreadMessageCount(0);
      return;
    }

    console.log("MessageNotificationListener: Starting for user", user.uid);

    // Function to count all unread messages across all chats
    const countAllUnreadMessages = async () => {
      try {
        // Get all chats for the current user
        const chatsQuery = query(
          collection(db, 'messages'),
          where('participantArray', 'array-contains', user.uid)
        );
        
        const chatsSnapshot = await getDocs(chatsQuery);
        
        let totalUnread = 0;
        
        // Check each chat for unread messages
        for (const chatDoc of chatsSnapshot.docs) {
          const chatId = chatDoc.id;
          
          // Get messages for this chat
          const messagesQuery = collection(db, 'messages', chatId, 'thread');
          const messagesSnapshot = await getDocs(messagesQuery);
          
          // Count unread messages
          const unreadCount = messagesSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.senderId !== user.uid && 
                  (!data.readBy || !data.readBy[user.uid]);
          }).length;
          
          totalUnread += unreadCount;
        }
        
        console.log("MessageNotificationListener: Total unread messages:", totalUnread);
        setUnreadMessageCount(totalUnread);
      } catch (error) {
        console.error("Error counting unread messages:", error);
      }
    };

    // Run initial count
    countAllUnreadMessages();

    // Listen for any changes to the user's chats
    const chatsQuery = query(
      collection(db, 'messages'),
      where('participantArray', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      console.log("MessageNotificationListener: Chats updated, recounting messages");
      countAllUnreadMessages();
    });

    return () => {
      console.log("MessageNotificationListener: Cleaning up");
      unsubscribe();
    };
  }, [user, setUnreadMessageCount]);

  return null;
}