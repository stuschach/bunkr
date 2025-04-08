import { 
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    DocumentData,
    QueryDocumentSnapshot,
    serverTimestamp,
    increment,
    arrayUnion,
    arrayRemove
  } from 'firebase/firestore';
  import { db } from './config';
  
  // Generic function to get a document
  export const getDocument = async <T>(
    collectionName: string, 
    documentId: string
  ): Promise<T | null> => {
    try {
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting document from ${collectionName}:`, error);
      throw error;
    }
  };
  
  // Generic function to create/update a document
  export const setDocument = async <T extends { id?: string }>(
    collectionName: string,
    data: T,
    documentId?: string
  ): Promise<string> => {
    try {
      const id = documentId || data.id || doc(collection(db, collectionName)).id;
      const docRef = doc(db, collectionName, id);
      
      // Add timestamps
      const dataWithTimestamps = {
        ...data,
        updatedAt: serverTimestamp(),
        // Only set createdAt if it's a new document
        ...(documentId ? {} : { createdAt: serverTimestamp() }),
      };
      
      // Remove id from data to avoid duplication
      if ('id' in dataWithTimestamps) {
        delete dataWithTimestamps.id;
      }
      
      await setDoc(docRef, dataWithTimestamps, { merge: true });
      return id;
    } catch (error) {
      console.error(`Error setting document in ${collectionName}:`, error);
      throw error;
    }
  };
  
  // Generic function to delete a document
  export const deleteDocument = async (
    collectionName: string, 
    documentId: string
  ): Promise<void> => {
    try {
      const docRef = doc(db, collectionName, documentId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document from ${collectionName}:`, error);
      throw error;
    }
  };
  
  // Generic paginated query function
  export const getPaginatedDocuments = async <T>(
    collectionName: string,
    conditions: { 
      field: string; 
      operator: '==' | '!=' | '>' | '>=' | '<' | '<='; 
      value: any 
    }[] = [],
    orderByField: string = 'createdAt',
    orderDirection: 'asc' | 'desc' = 'desc',
    pageSize: number = 10,
    lastDocument?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{ data: T[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
    try {
      let q = collection(db, collectionName);
      
      // Apply filters
      let compositeQuery = query(q);
      conditions.forEach(condition => {
        compositeQuery = query(
          compositeQuery, 
          where(condition.field, condition.operator, condition.value)
        );
      });
      
      // Apply ordering
      compositeQuery = query(compositeQuery, orderBy(orderByField, orderDirection));
      
      // Apply pagination
      compositeQuery = query(compositeQuery, limit(pageSize));
      
      // If we have a last document, start after it
      if (lastDocument) {
        compositeQuery = query(compositeQuery, startAfter(lastDocument));
      }
      
      const querySnapshot = await getDocs(compositeQuery);
      
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      
      const lastDoc = querySnapshot.docs.length > 0 
        ? querySnapshot.docs[querySnapshot.docs.length - 1] 
        : null;
      
      return { data, lastDoc };
    } catch (error) {
      console.error(`Error querying ${collectionName}:`, error);
      throw error;
    }
  };
  
  // Helper functions for common operations
  export const updateCounter = async (
    collectionName: string,
    documentId: string,
    field: string,
    value: number = 1
  ): Promise<void> => {
    const docRef = doc(db, collectionName, documentId);
    await updateDoc(docRef, {
      [field]: increment(value),
      updatedAt: serverTimestamp()
    });
  };
  
  export const addToArray = async (
    collectionName: string,
    documentId: string,
    field: string,
    value: any
  ): Promise<void> => {
    const docRef = doc(db, collectionName, documentId);
    await updateDoc(docRef, {
      [field]: arrayUnion(value),
      updatedAt: serverTimestamp()
    });
  };
  
  export const removeFromArray = async (
    collectionName: string,
    documentId: string,
    field: string,
    value: any
  ): Promise<void> => {
    const docRef = doc(db, collectionName, documentId);
    await updateDoc(docRef, {
      [field]: arrayRemove(value),
      updatedAt: serverTimestamp()
    });
  };