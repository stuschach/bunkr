// src/lib/api/firebase-hooks.ts
import { 
    collection, 
    doc, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter,
    getDocs, 
    getDoc, 
    QueryConstraint, 
    DocumentReference,
    Query,
    DocumentData,
    QuerySnapshot,
    DocumentSnapshot
  } from 'firebase/firestore';
  import { 
    useQuery, 
    useInfiniteQuery,
    QueryKey
  } from '@tanstack/react-query';
  import { db } from '@/lib/firebase/config';
  
  // Type for collection query options
  interface CollectionQueryOptions {
    constraints?: QueryConstraint[];
    idField?: string;
  }
  
  // Helper to convert Firestore timestamp to Date
  const convertTimestamps = (data: any): any => {
    if (!data) return data;
    
    if (data.toDate && typeof data.toDate === 'function') {
      return data.toDate();
    }
    
    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map(convertTimestamps);
      }
      
      const result: Record<string, any> = {};
      Object.keys(data).forEach(key => {
        result[key] = convertTimestamps(data[key]);
      });
      return result;
    }
    
    return data;
  };
  
  // Helper to process document data
  export const processDocument = <T>(
    doc: DocumentSnapshot,
    idField: string = 'id'
  ): T => {
    if (!doc.exists()) {
      return {} as T;
    }
    
    const data = doc.data();
    return {
      [idField]: doc.id,
      ...convertTimestamps(data),
    } as T;
  };
  
  // Helper to process collection data
  export const processCollection = <T>(
    snapshot: QuerySnapshot,
    idField: string = 'id'
  ): T[] => {
    return snapshot.docs.map(doc => processDocument<T>(doc, idField));
  };
  
  // Hook to query a single document
  export function useFirestoreDocument<T>(
    docPath: string | null,
    options?: any
  ) {
    return useQuery({
      queryKey: ['document', docPath],
      queryFn: async () => {
        if (!docPath) throw new Error('Document path is required');
        
        const docRef = doc(db, docPath);
        const snapshot = await getDoc(docRef);
        
        if (!snapshot.exists()) {
          throw new Error(`Document at ${docPath} does not exist`);
        }
        
        return processDocument<T>(snapshot);
      },
      enabled: !!docPath,
      ...options,
    });
  }
  
  // Hook to query a collection
  export function useFirestoreCollection<T>(
    collectionPath: string | null,
    {
      constraints = [],
      idField = 'id',
    }: CollectionQueryOptions = {},
    options?: any
  ) {
    return useQuery({
      queryKey: ['collection', collectionPath, constraints],
      queryFn: async () => {
        if (!collectionPath) throw new Error('Collection path is required');
        
        const collectionRef = collection(db, collectionPath);
        const q = query(collectionRef, ...constraints);
        const snapshot = await getDocs(q);
        
        return processCollection<T>(snapshot, idField);
      },
      enabled: !!collectionPath,
      ...options,
    });
  }
  
  // Hook for infinite query (pagination)
  export function useFirestoreInfiniteQuery<T extends Record<string, any>>(
    collectionPath: string | null,
    {
      constraints = [],
      idField = 'id',
      pageSize = 10,
    }: CollectionQueryOptions & { pageSize?: number } = {},
    options?: any
  ) {
    return useInfiniteQuery({
      queryKey: ['infinite', collectionPath, constraints, pageSize],
      queryFn: async ({ pageParam }: { pageParam?: any }) => {
        if (!collectionPath) throw new Error('Collection path is required');
        
        const collectionRef = collection(db, collectionPath);
        let q = query(collectionRef, ...constraints, limit(pageSize));
        
        if (pageParam) {
          q = query(q, startAfter(pageParam));
        }
        
        const snapshot = await getDocs(q);
        return processCollection<T>(snapshot, idField);
      },
      getNextPageParam: (lastPage: T[], allPages: T[][]) => {
        if (lastPage.length < pageSize) return undefined;
        // Make sure the last item exists and has the idField
        const lastItem = lastPage[lastPage.length - 1];
        return lastItem && idField in lastItem ? lastItem[idField] : undefined;
      },
      enabled: !!collectionPath,
      ...options,
    });
  }