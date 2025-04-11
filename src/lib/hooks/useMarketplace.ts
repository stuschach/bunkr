// src/lib/hooks/useMarketplace.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  MarketplaceListing, 
  ListingFilter, 
  ListingSortOption 
} from '@/types/marketplace';
import { 
  createListing,
  uploadListingImages,
  updateListing,
  deleteListing,
  getListingById,
  incrementListingViewCount,
  getListings,
  getMyListings,
  getMySavedListings,
  getFeaturedListings,
  getListingsBySeller,
  searchListings,
  toggleSaveListing,
  checkIfListingSaved,
  markListingAsSold
} from '@/lib/firebase/marketplace';

export const useMarketplace = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  
  // Use useRef for the lastVisible since we don't need to re-render when it changes
  const lastVisibleRef = useRef<any>(null);
  
  // Store viewed listings to prevent duplicate view counts
  const viewedListingsRef = useRef<Set<string>>(new Set());

  // Create a new listing
  const createNewListing = useCallback(async (
    listingData: Omit<MarketplaceListing, 'id' | 'createdAt' | 'sellerId'>,
    imageFiles: File[]
  ) => {
    if (!user) {
      setError('You must be logged in to create a listing');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First create the listing without images
      const newListing = await createListing({
        ...listingData,
        images: [] // Start with empty images array
      });

      // Then upload the images if there are any
      if (imageFiles.length > 0) {
        const imageUrls = await uploadListingImages(imageFiles, newListing.id);
        
        // Update the listing with image URLs
        await updateListing(newListing.id, { images: imageUrls });
        
        // Return updated listing with images
        return {
          ...newListing,
          images: imageUrls
        };
      }

      return newListing;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create listing';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Update an existing listing
  const updateExistingListing = useCallback(async (
    listingId: string,
    updateData: Partial<MarketplaceListing>,
    newImageFiles?: File[],
    imagesToDelete?: string[]
  ) => {
    if (!user) {
      setError('You must be logged in to update a listing');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current listing to access its current images
      const currentListing = await getListingById(listingId);
      if (!currentListing) {
        throw new Error('Listing not found');
      }

      // Verify ownership
      if (currentListing.sellerId !== user.uid) {
        throw new Error('You do not have permission to edit this listing');
      }

      // Handle image deletions if needed
      let updatedImages = [...(currentListing.images || [])];
      
      if (imagesToDelete && imagesToDelete.length > 0) {
        // Remove deleted images from the array
        updatedImages = updatedImages.filter(img => !imagesToDelete.includes(img));
      }

      // Handle new image uploads if needed
      if (newImageFiles && newImageFiles.length > 0) {
        const newImageUrls = await uploadListingImages(newImageFiles, listingId);
        updatedImages = [...updatedImages, ...newImageUrls];
      }

      // Update the listing with all changes
      await updateListing(listingId, {
        ...updateData,
        images: updatedImages
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update listing';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Delete a listing
  const removeExistingListing = useCallback(async (listingId: string) => {
    if (!user) {
      setError('You must be logged in to delete a listing');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      await deleteListing(listingId);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete listing';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Get a single listing
  const getListing = useCallback(async (listingId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const listing = await getListingById(listingId);
      
      // Record view and increment view count if this is the first view
      // in this session
      if (listing && !viewedListingsRef.current.has(listingId)) {
        // Add to viewed listings set
        viewedListingsRef.current.add(listingId);
        
        // Increment view count separately
        await incrementListingViewCount(listingId);
      }
      
      return listing;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch listing';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch listings with pagination
  const fetchListings = useCallback(async (
    filterOptions: ListingFilter = {},
    sortOption: ListingSortOption = { field: 'createdAt', direction: 'desc' },
    pageSize: number = 20,
    reset: boolean = false
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      // Reset pagination if requested
      if (reset) {
        lastVisibleRef.current = null;
      }

      const { listings, lastVisible: newLastVisible } = await getListings(
        filterOptions,
        sortOption,
        pageSize,
        lastVisibleRef.current
      );

      // Update pagination state
      lastVisibleRef.current = newLastVisible;
      setHasMoreListings(listings.length === pageSize);

      return listings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch listings';
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch my listings
  const fetchMyListings = useCallback(async () => {
    if (!user) {
      setError('You must be logged in to view your listings');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const listings = await getMyListings();
      return listings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch your listings';
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch my saved listings
  const fetchMySavedListings = useCallback(async () => {
    if (!user) {
      setError('You must be logged in to view saved listings');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const listings = await getMySavedListings();
      return listings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch saved listings';
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch featured listings
  const fetchFeaturedListings = useCallback(async (limit: number = 6) => {
    setIsLoading(true);
    setError(null);

    try {
      const listings = await getFeaturedListings(limit);
      return listings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch featured listings';
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch seller's listings
  const fetchSellerListings = useCallback(async (sellerId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const listings = await getListingsBySeller(sellerId);
      return listings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch seller listings';
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search listings
  const searchForListings = useCallback(async (searchQuery: string, pageSize: number = 20) => {
    setIsLoading(true);
    setError(null);

    try {
      const listings = await searchListings(searchQuery, pageSize);
      return listings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search listings';
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save/unsave a listing
  const toggleSaved = useCallback(async (listingId: string) => {
    if (!user) {
      setError('You must be logged in to save listings');
      return false;
    }

    setError(null);
    
    try {
      const isSaved = await toggleSaveListing(listingId);
      return isSaved;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save listing';
      setError(errorMessage);
      return false;
    }
  }, [user]);

  // Check if a listing is saved
  const checkSaved = useCallback(async (listingId: string) => {
    if (!user) return false;

    try {
      return await checkIfListingSaved(listingId);
    } catch (error) {
      console.error('Error checking if listing is saved:', error);
      return false;
    }
  }, [user]);

  // Mark listing as sold
  const markAsSold = useCallback(async (listingId: string) => {
    if (!user) {
      setError('You must be logged in to mark a listing as sold');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      await markListingAsSold(listingId);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark listing as sold';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Reset pagination
  const resetPagination = useCallback(() => {
    lastVisibleRef.current = null;
    setHasMoreListings(true);
  }, []);
  
  // Clear viewed listings (used when user logs out or for testing)
  const clearViewedListings = useCallback(() => {
    viewedListingsRef.current.clear();
  }, []);

  // Clear error when component unmounts or when dependencies change
  useEffect(() => {
    return () => {
      setError(null);
    };
  }, [user]);

  return {
    isLoading,
    error,
    hasMoreListings,
    createListing: createNewListing,
    updateListing: updateExistingListing,
    deleteListing: removeExistingListing,
    getListing,
    getListings: fetchListings,
    getMyListings: fetchMyListings,
    getMySavedListings: fetchMySavedListings,
    getFeaturedListings: fetchFeaturedListings,
    getSellerListings: fetchSellerListings,
    searchListings: searchForListings,
    toggleSaveListing: toggleSaved,
    isListingSaved: checkSaved,
    markListingAsSold: markAsSold,
    resetPagination,
    clearViewedListings
  };
};