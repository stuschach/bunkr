// src/app/(app)/marketplace/manage/[listingId]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useMarketplace } from '@/lib/hooks/useMarketplace';
import { ListingForm } from '@/components/marketplace/ListingForm';
import { Heading, Text } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Toast } from '@/components/common/feedback/Toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';

export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { getListing, updateListing, markListingAsSold, deleteListing, isLoading } = useMarketplace();
  
  // State
  const [listing, setListing] = useState<any>(null);
  const [isLoadingListing, setIsLoadingListing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Delete confirmation dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSoldDialog, setShowSoldDialog] = useState(false);
  const [isDeletingListing, setIsDeletingListing] = useState(false);
  const [isMarkingAsSold, setIsMarkingAsSold] = useState(false);
  
  const listingId = params.listingId as string;
  
  // Load listing data
  useEffect(() => {
    const fetchListing = async () => {
      try {
        const listingData = await getListing(listingId);
        
        if (!listingData) {
          setErrorMessage('Listing not found');
          return;
        }
        
        // Check if the current user is the owner
        if (user && listingData.sellerId !== user.uid) {
          setErrorMessage('You do not have permission to edit this listing');
          return;
        }
        
        setListing(listingData);
      } catch (error) {
        console.error('Error fetching listing:', error);
        setErrorMessage('Failed to load listing details');
      } finally {
        setIsLoadingListing(false);
      }
    };
    
    if (user) {
      fetchListing();
    }
  }, [listingId, getListing, user]);
  
  // Handle form submission (update listing)
  const handleSubmit = async (formData: any, images: File[]) => {
    if (!user || !listing) {
      setErrorMessage('You must be logged in to update a listing');
      return;
    }
    
    try {
      const success = await updateListing(
        listingId, 
        formData,
        images.length > 0 ? images : undefined,
        // No image deletions handled in this simplified version
      );
      
      if (success) {
        setSuccessMessage('Listing updated successfully');
        setShowSuccessToast(true);
        
        // Redirect to the listing detail page after a short delay
        setTimeout(() => {
          router.push(`/marketplace/${listingId}`);
        }, 1500);
      }
    } catch (error) {
      console.error('Error updating listing:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update listing');
    }
  };
  
  // Handle delete listing
  const handleDeleteListing = async () => {
    if (!user || !listing) return;
    
    setIsDeletingListing(true);
    
    try {
      const success = await deleteListing(listingId);
      
      if (success) {
        setSuccessMessage('Listing deleted successfully');
        setShowSuccessToast(true);
        
        // Close dialog
        setShowDeleteDialog(false);
        
        // Redirect to marketplace after a short delay
        setTimeout(() => {
          router.push('/marketplace?tab=my-listings');
        }, 1500);
      }
    } catch (error) {
      console.error('Error deleting listing:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete listing');
      setShowDeleteDialog(false);
    } finally {
      setIsDeletingListing(false);
    }
  };
  
  // Handle mark as sold
  const handleMarkAsSold = async () => {
    if (!user || !listing) return;
    
    setIsMarkingAsSold(true);
    
    try {
      const success = await markListingAsSold(listingId);
      
      if (success) {
        setSuccessMessage('Listing marked as sold');
        setShowSuccessToast(true);
        
        // Close dialog
        setShowSoldDialog(false);
        
        // Redirect to the listing detail page after a short delay
        setTimeout(() => {
          router.push(`/marketplace/${listingId}`);
        }, 1500);
      }
    } catch (error) {
      console.error('Error marking listing as sold:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update listing status');
      setShowSoldDialog(false);
    } finally {
      setIsMarkingAsSold(false);
    }
  };
  
  // Loading state
  if (authLoading || isLoadingListing) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading listing..." />
      </div>
    );
  }
  
  // Check if user is authenticated
  if (!user) {
    router.push(`/login?returnUrl=/marketplace/manage/${listingId}`);
    return null;
  }
  
  // Error states
  if (errorMessage) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-lg text-center">
          <Heading level={3} className="text-xl font-bold mb-4">{errorMessage}</Heading>
          <Button onClick={() => router.push('/marketplace')}>
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }
  
  // If listing not loaded yet
  if (!listing) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <div className="text-center">
          <Heading level={3} className="text-xl font-bold mb-4">Listing Not Found</Heading>
          <Button onClick={() => router.push('/marketplace')}>
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }
  
  // Show sold notice if applicable
  if (listing.status === 'sold') {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 p-6 rounded-lg text-center mb-4">
          <Heading level={3} className="text-xl font-bold mb-4">This listing has been marked as sold</Heading>
          <Text className="mb-4">
            You can view the listing details, but it cannot be edited anymore.
          </Text>
          <div className="flex justify-center space-x-4">
            <Button onClick={() => router.push(`/marketplace/${listingId}`)}>
              View Listing
            </Button>
            <Button variant="outline" onClick={() => router.push('/marketplace?tab=my-listings')}>
              My Listings
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="mb-8">
        <Heading level={1}>Edit Listing</Heading>
        <Text className="text-gray-600 dark:text-gray-400 mt-2">
          Update your listing details below.
        </Text>
        
        {/* Action buttons */}
        <div className="flex flex-wrap gap-4 mt-4">
          <Button 
            variant="outline" 
            onClick={() => setShowSoldDialog(true)}
          >
            Mark as Sold
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete Listing
          </Button>
        </div>
      </div>
      
      <ListingForm
        listing={listing}
        onSubmit={handleSubmit}
        isSubmitting={isLoading}
        error={errorMessage}
      />
      
      {/* Success toast notification */}
      <Toast
        open={showSuccessToast}
        onClose={() => setShowSuccessToast(false)}
        variant="success"
        title="Success!"
        description={successMessage}
        duration={5000}
      />
      
      {/* Delete confirmation dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => !isDeletingListing && setShowDeleteDialog(false)}
      >
        <DialogHeader>
          <DialogTitle>Delete Listing</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <Text>
            Are you sure you want to delete this listing? This action cannot be undone.
          </Text>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(false)}
            disabled={isDeletingListing}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteListing}
            isLoading={isDeletingListing}
            disabled={isDeletingListing}
          >
            Delete
          </Button>
        </DialogFooter>
      </Dialog>
      
      {/* Mark as sold confirmation dialog */}
      <Dialog
        open={showSoldDialog}
        onClose={() => !isMarkingAsSold && setShowSoldDialog(false)}
      >
        <DialogHeader>
          <DialogTitle>Mark as Sold</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <Text>
            Are you sure you want to mark this listing as sold? This will remove it from active listings and it will no longer be editable.
          </Text>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowSoldDialog(false)}
            disabled={isMarkingAsSold}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMarkAsSold}
            isLoading={isMarkingAsSold}
            disabled={isMarkingAsSold}
          >
            Confirm
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}