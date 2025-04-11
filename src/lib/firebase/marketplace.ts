// src/lib/firebase/marketplace.ts
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
    Timestamp,
    increment,
    arrayUnion,
    arrayRemove,
    serverTimestamp
  } from 'firebase/firestore';
  import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
  import { db, storage } from './config';
  import { MarketplaceListing, ListingFilter, ListingSortOption } from '@/types/marketplace';
  import { auth } from './config';
  import { getUserById } from './users';
  
  // Base collection reference
  const listingsCollection = collection(db, 'marketplace');
  
  // Function to format a listing from Firestore
  export const formatListing = async (doc: any): Promise<MarketplaceListing> => {
    const data = doc.data();
    
    // Convert timestamps to Date objects
    const createdAt = data.createdAt instanceof Timestamp ? 
      data.createdAt.toDate() : new Date(data.createdAt);
    
    const updatedAt = data.updatedAt instanceof Timestamp ? 
      data.updatedAt?.toDate() : data.updatedAt ? new Date(data.updatedAt) : undefined;
    
    // Fetch seller data if needed
    let seller = undefined;
    if (data.sellerId) {
      try {
        seller = await getUserById(data.sellerId);
      } catch (error) {
        console.error('Error fetching seller data:', error);
      }
    }
    
    return {
      id: doc.id,
      ...data,
      createdAt,
      updatedAt,
      seller
    } as MarketplaceListing;
  };
  
  // Create a new listing
  export const createListing = async (listingData: Omit<MarketplaceListing, 'id' | 'createdAt' | 'sellerId'>): Promise<MarketplaceListing> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be logged in to create a listing');
      }
      
      // Create a new document reference
      const newListingRef = doc(listingsCollection);
      
      // Prepare the data with additional fields
      const newListing = {
        ...listingData,
        id: newListingRef.id,
        sellerId: currentUser.uid,
        createdAt: serverTimestamp(),
        status: listingData.status || 'active',
        views: 0,
        saves: 0
      };
      
      // Save to Firestore
      await setDoc(newListingRef, newListing);
      
      // Return the full listing with the ID
      return {
        ...newListing,
        id: newListingRef.id,
        createdAt: new Date()
      } as MarketplaceListing;
    } catch (error) {
      console.error('Error creating listing:', error);
      throw new Error('Failed to create listing');
    }
  };
  
  // Upload multiple images for a listing
  export const uploadListingImages = async (
    files: File[], 
    listingId: string
  ): Promise<string[]> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be logged in to upload images');
      }
      
      const uploadPromises = files.map(async (file, index) => {
        // Create a unique file path
        const timestamp = Date.now();
        const fileName = `${timestamp}-${index}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const filePath = `marketplace/${currentUser.uid}/${listingId}/${fileName}`;
        
        // Create a storage reference
        const storageRef = ref(storage, filePath);
        
        // Upload the file
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        // Return a promise that resolves with the download URL
        return new Promise<string>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              // Optional: handle progress
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log(`Upload ${index + 1} is ${progress}% done`);
            },
            (error) => {
              // Handle errors
              console.error('Upload error:', error);
              reject(error);
            },
            async () => {
              // Get the download URL
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadUrl);
              } catch (error) {
                reject(error);
              }
            }
          );
        });
      });
      
      // Wait for all uploads to complete
      return Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading listing images:', error);
      throw new Error('Failed to upload images');
    }
  };
  
  // Delete an image
  export const deleteListingImage = async (imageUrl: string): Promise<void> => {
    try {
      // Extract the path from the URL
      const storageRef = ref(storage, imageUrl);
      
      // Delete the file
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting image:', error);
      throw new Error('Failed to delete image');
    }
  };
  
  // Get a single listing by ID without incrementing view count
  export const getListingById = async (listingId: string): Promise<MarketplaceListing | null> => {
    try {
      const listingRef = doc(db, 'marketplace', listingId);
      const listingSnap = await getDoc(listingRef);
      
      if (!listingSnap.exists()) {
        return null;
      }
      
      return formatListing(listingSnap);
    } catch (error) {
      console.error('Error fetching listing:', error);
      throw new Error('Failed to fetch listing');
    }
  };
  
  // Increment a listing's view count
  export const incrementListingViewCount = async (listingId: string): Promise<void> => {
    try {
      const listingRef = doc(db, 'marketplace', listingId);
      
      // Increment the view count
      await updateDoc(listingRef, {
        views: increment(1)
      });
    } catch (error) {
      console.error('Error incrementing view count:', error);
      // Don't throw error for view count failures - it's not critical
    }
  };
  
  // Update a listing
  export const updateListing = async (
    listingId: string, 
    updateData: Partial<MarketplaceListing>
  ): Promise<void> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be logged in to update a listing');
      }
      
      // Get the listing to verify ownership
      const listingRef = doc(db, 'marketplace', listingId);
      const listingSnap = await getDoc(listingRef);
      
      if (!listingSnap.exists()) {
        throw new Error('Listing not found');
      }
      
      const listingData = listingSnap.data();
      
      // Verify ownership
      if (listingData.sellerId !== currentUser.uid) {
        throw new Error('You do not have permission to edit this listing');
      }
      
      // Update the listing
      await updateDoc(listingRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating listing:', error);
      throw new Error('Failed to update listing');
    }
  };
  
  // Delete a listing
  export const deleteListing = async (listingId: string): Promise<void> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be logged in to delete a listing');
      }
      
      // Get the listing to verify ownership
      const listingRef = doc(db, 'marketplace', listingId);
      const listingSnap = await getDoc(listingRef);
      
      if (!listingSnap.exists()) {
        throw new Error('Listing not found');
      }
      
      const listingData = listingSnap.data();
      
      // Verify ownership
      if (listingData.sellerId !== currentUser.uid) {
        throw new Error('You do not have permission to delete this listing');
      }
      
      // Delete the listing
      await deleteDoc(listingRef);
      
      // Optional: Delete associated images
      if (listingData.images && listingData.images.length > 0) {
        // In a real app, you'd delete the images from storage here
        // This is left as an improvement
      }
    } catch (error) {
      console.error('Error deleting listing:', error);
      throw new Error('Failed to delete listing');
    }
  };
  
  // Toggle save/favorite a listing
  export const toggleSaveListing = async (listingId: string): Promise<boolean> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be logged in to save a listing');
      }
      
      const listingRef = doc(db, 'marketplace', listingId);
      const listingSnap = await getDoc(listingRef);
      
      if (!listingSnap.exists()) {
        throw new Error('Listing not found');
      }
      
      const listingData = listingSnap.data();
      const savedBy = listingData.savedBy || [];
      const isSaved = savedBy.includes(currentUser.uid);
      
      if (isSaved) {
        // Unsave the listing
        await updateDoc(listingRef, {
          savedBy: arrayRemove(currentUser.uid),
          saves: increment(-1)
        });
        return false;
      } else {
        // Save the listing
        await updateDoc(listingRef, {
          savedBy: arrayUnion(currentUser.uid),
          saves: increment(1)
        });
        return true;
      }
    } catch (error) {
      console.error('Error toggling save listing:', error);
      throw new Error('Failed to save listing');
    }
  };
  
  // Check if current user has saved a listing
  export const checkIfListingSaved = async (listingId: string): Promise<boolean> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return false;
      }
      
      const listingRef = doc(db, 'marketplace', listingId);
      const listingSnap = await getDoc(listingRef);
      
      if (!listingSnap.exists()) {
        return false;
      }
      
      const listingData = listingSnap.data();
      const savedBy = listingData.savedBy || [];
      
      return savedBy.includes(currentUser.uid);
    } catch (error) {
      console.error('Error checking if listing is saved:', error);
      return false;
    }
  };
  
  // Mark listing as sold
  export const markListingAsSold = async (listingId: string): Promise<void> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be logged in to mark a listing as sold');
      }
      
      // Get the listing to verify ownership
      const listingRef = doc(db, 'marketplace', listingId);
      const listingSnap = await getDoc(listingRef);
      
      if (!listingSnap.exists()) {
        throw new Error('Listing not found');
      }
      
      const listingData = listingSnap.data();
      
      // Verify ownership
      if (listingData.sellerId !== currentUser.uid) {
        throw new Error('You do not have permission to update this listing');
      }
      
      // Mark as sold
      await updateDoc(listingRef, {
        status: 'sold',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking listing as sold:', error);
      throw new Error('Failed to update listing');
    }
  };
  
  // Get listings with filtering and pagination
  export const getListings = async (
    filterOptions: ListingFilter = {},
    sortOption: ListingSortOption = { field: 'createdAt', direction: 'desc' },
    pageSize: number = 20,
    lastVisible: any = null
  ): Promise<{ listings: MarketplaceListing[], lastVisible: any }> => {
    try {
      let q = query(
        listingsCollection, 
        where('status', '==', 'active')
      );
      
      // Apply category filter
      if (filterOptions.category && filterOptions.category !== 'all') {
        q = query(q, where('category', '==', filterOptions.category));
      }
      
      // Apply price range filter
      if (filterOptions.minPrice !== undefined) {
        q = query(q, where('price', '>=', filterOptions.minPrice));
      }
      
      if (filterOptions.maxPrice !== undefined) {
        q = query(q, where('price', '<=', filterOptions.maxPrice));
      }
      
      // Apply dexterity filter
      if (filterOptions.dexterity) {
        q = query(q, where('dexterity', '==', filterOptions.dexterity));
      }
      
      // Apply sorting
      q = query(q, orderBy(sortOption.field, sortOption.direction));
      
      // Apply pagination
      if (lastVisible) {
        q = query(q, startAfter(lastVisible), limit(pageSize));
      } else {
        q = query(q, limit(pageSize));
      }
      
      const querySnapshot = await getDocs(q);
      
      // Get the last item for pagination
      const lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      
      // Format the listings
      const listings = await Promise.all(
        querySnapshot.docs.map(doc => formatListing(doc))
      );
      
      return {
        listings,
        lastVisible: lastVisibleDoc
      };
    } catch (error) {
      console.error('Error fetching listings:', error);
      throw new Error('Failed to fetch listings');
    }
  };
  
  // Get featured listings
  export const getFeaturedListings = async (maxResults: number = 6): Promise<MarketplaceListing[]> => {
    try {
      const q = query(
        listingsCollection,
        where('status', '==', 'active'),
        where('featured', '==', true),
        orderBy('createdAt', 'desc'),
        limit(maxResults)
      );
      
      const querySnapshot = await getDocs(q);
      
      return Promise.all(
        querySnapshot.docs.map(doc => formatListing(doc))
      );
    } catch (error) {
      console.error('Error fetching featured listings:', error);
      throw new Error('Failed to fetch featured listings');
    }
  };
  
  // Get listings by seller
  export const getListingsBySeller = async (sellerId: string): Promise<MarketplaceListing[]> => {
    try {
      const q = query(
        listingsCollection,
        where('sellerId', '==', sellerId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      return Promise.all(
        querySnapshot.docs.map(doc => formatListing(doc))
      );
    } catch (error) {
      console.error('Error fetching seller listings:', error);
      throw new Error('Failed to fetch seller listings');
    }
  };
  
  // Get my listings (for current user)
  export const getMyListings = async (): Promise<MarketplaceListing[]> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be logged in to view their listings');
      }
      
      return getListingsBySeller(currentUser.uid);
    } catch (error) {
      console.error('Error fetching my listings:', error);
      throw new Error('Failed to fetch my listings');
    }
  };
  
  // Get my saved listings
  export const getMySavedListings = async (): Promise<MarketplaceListing[]> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be logged in to view saved listings');
      }
      
      const q = query(
        listingsCollection,
        where('savedBy', 'array-contains', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      return Promise.all(
        querySnapshot.docs.map(doc => formatListing(doc))
      );
    } catch (error) {
      console.error('Error fetching saved listings:', error);
      throw new Error('Failed to fetch saved listings');
    }
  };
  
  // Search listings by text query
  export const searchListings = async (searchQuery: string, pageSize: number = 20): Promise<MarketplaceListing[]> => {
    try {
      // In a real app, you would use Algolia, Typesense, or Firebase's full-text search
      // For this implementation, we'll do a simple client-side filtering
      
      const q = query(
        listingsCollection,
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(pageSize * 5) // Fetch more to filter client-side
      );
      
      const querySnapshot = await getDocs(q);
      
      // Filter by title and description (client-side)
      const filteredDocs = querySnapshot.docs.filter(doc => {
        const data = doc.data();
        const searchTerms = searchQuery.toLowerCase().split(' ');
        
        return searchTerms.some(term => 
          data.title.toLowerCase().includes(term) || 
          data.description.toLowerCase().includes(term) ||
          (data.brand && data.brand.toLowerCase().includes(term)) ||
          (data.model && data.model.toLowerCase().includes(term))
        );
      }).slice(0, pageSize);
      
      return Promise.all(
        filteredDocs.map(doc => formatListing(doc))
      );
    } catch (error) {
      console.error('Error searching listings:', error);
      throw new Error('Failed to search listings');
    }
  };