// src/app/(app)/marketplace/my-listings/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useMarketplace } from '@/lib/hooks/useMarketplace';
import { MarketplaceListing, ListingStatus } from '@/types/marketplace';

// Components
import { Heading, Text } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Toast } from '@/components/common/feedback/Toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';

// Status badge colors
const statusColors: Record<ListingStatus, { variant: 'default' | 'success' | 'warning' | 'error' | 'outline'; text: string }> = {
  'active': { variant: 'success', text: 'Active' },
  'pending': { variant: 'warning', text: 'Pending' },
  'sold': { variant: 'outline', text: 'Sold' },
  'draft': { variant: 'outline', text: 'Draft' }
};

export default function MyListingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { getMyListings, deleteListing, markListingAsSold, isLoading } = useMarketplace();
  
  // State
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [filteredListings, setFilteredListings] = useState<MarketplaceListing[]>([]);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingAsSold, setIsMarkingAsSold] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSoldDialog, setShowSoldDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Load user's listings
  useEffect(() => {
    const fetchListings = async () => {
      try {
        const userListings = await getMyListings();
        setListings(userListings);
        setFilteredListings(userListings); // Initially show all
      } catch (error) {
        console.error('Error fetching listings:', error);
        setErrorMessage('Failed to load your listings');
      }
    };
    
    if (user) {
      fetchListings();
    }
  }, [user, getMyListings]);
  
  // Filter listings based on active tab
  useEffect(() => {
    if (activeTab === 'all') {
      setFilteredListings(listings);
    } else {
      setFilteredListings(listings.filter(listing => listing.status === activeTab));
    }
  }, [activeTab, listings]);
  
  // Handle delete listing
  const handleDeleteListing = async () => {
    if (!selectedListing) return;
    
    setIsDeleting(true);
    try {
      const success = await deleteListing(selectedListing.id);
      if (success) {
        // Remove from local state
        setListings(prev => prev.filter(item => item.id !== selectedListing.id));
        
        setSuccessMessage('Listing deleted successfully');
        setShowSuccessToast(true);
        setShowDeleteDialog(false);
        setSelectedListing(null);
      }
    } catch (error) {
      console.error('Error deleting listing:', error);
      setErrorMessage('Failed to delete listing');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Handle mark as sold
  const handleMarkAsSold = async () => {
    if (!selectedListing) return;
    
    setIsMarkingAsSold(true);
    try {
      const success = await markListingAsSold(selectedListing.id);
      if (success) {
        // Update local state
        setListings(prev => 
          prev.map(item => 
            item.id === selectedListing.id 
              ? { ...item, status: 'sold' } 
              : item
          )
        );
        
        setSuccessMessage('Listing marked as sold');
        setShowSuccessToast(true);
        setShowSoldDialog(false);
        setSelectedListing(null);
      }
    } catch (error) {
      console.error('Error marking listing as sold:', error);
      setErrorMessage('Failed to update listing status');
    } finally {
      setIsMarkingAsSold(false);
    }
  };
  
  // Check if user is authenticated
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading..." />
      </div>
    );
  }
  
  if (!user) {
    router.push('/login?returnUrl=/marketplace/my-listings');
    return null;
  }
  
  // Count listings by status
  const listingCounts = {
    all: listings.length,
    active: listings.filter(l => l.status === 'active').length,
    pending: listings.filter(l => l.status === 'pending').length,
    sold: listings.filter(l => l.status === 'sold').length,
    draft: listings.filter(l => l.status === 'draft').length
  };

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <Heading level={1}>My Listings</Heading>
          <Text className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your marketplace listings
          </Text>
        </div>
        
        <Button onClick={() => router.push('/marketplace/create')}>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 mr-2" 
            fill="none" 
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
            />
          </svg>
          Create New Listing
        </Button>
      </div>
      
      {/* Error display */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-6">
          {errorMessage}
        </div>
      )}
      
      {/* Tabs for filtering */}
      <Tabs
        tabs={[
          {
            id: 'all',
            label: `All (${listingCounts.all})`,
            content: (
              <ListingsContent 
                listings={filteredListings}
                isLoading={isLoading}
                onEdit={(listing) => router.push(`/marketplace/manage/${listing.id}`)}
                onView={(listing) => router.push(`/marketplace/${listing.id}`)}
                onDelete={(listing) => {
                  setSelectedListing(listing);
                  setShowDeleteDialog(true);
                }}
                onMarkAsSold={(listing) => {
                  setSelectedListing(listing);
                  setShowSoldDialog(true);
                }}
              />
            )
          },
          {
            id: 'active',
            label: `Active (${listingCounts.active})`,
            content: (
              <ListingsContent 
                listings={filteredListings}
                isLoading={isLoading}
                onEdit={(listing) => router.push(`/marketplace/manage/${listing.id}`)}
                onView={(listing) => router.push(`/marketplace/${listing.id}`)}
                onDelete={(listing) => {
                  setSelectedListing(listing);
                  setShowDeleteDialog(true);
                }}
                onMarkAsSold={(listing) => {
                  setSelectedListing(listing);
                  setShowSoldDialog(true);
                }}
              />
            )
          },
          {
            id: 'pending',
            label: `Pending (${listingCounts.pending})`,
            content: (
              <ListingsContent 
                listings={filteredListings}
                isLoading={isLoading}
                onEdit={(listing) => router.push(`/marketplace/manage/${listing.id}`)}
                onView={(listing) => router.push(`/marketplace/${listing.id}`)}
                onDelete={(listing) => {
                  setSelectedListing(listing);
                  setShowDeleteDialog(true);
                }}
                onMarkAsSold={(listing) => {
                  setSelectedListing(listing);
                  setShowSoldDialog(true);
                }}
              />
            )
          },
          {
            id: 'sold',
            label: `Sold (${listingCounts.sold})`,
            content: (
              <ListingsContent 
                listings={filteredListings}
                isLoading={isLoading}
                onEdit={(listing) => router.push(`/marketplace/manage/${listing.id}`)}
                onView={(listing) => router.push(`/marketplace/${listing.id}`)}
                onDelete={(listing) => {
                  setSelectedListing(listing);
                  setShowDeleteDialog(true);
                }}
                hideEdit={true}
                hideMarkAsSold={true}
              />
            )
          }
        ]}
        defaultTab="all"
        onChange={setActiveTab}
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
        onClose={() => !isDeleting && setShowDeleteDialog(false)}
      >
        <DialogHeader>
          <DialogTitle>Delete Listing</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <Text>
            Are you sure you want to delete "{selectedListing?.title}"? This action cannot be undone.
          </Text>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteListing}
            isLoading={isDeleting}
            disabled={isDeleting}
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
            Are you sure you want to mark "{selectedListing?.title}" as sold? This will remove it from active listings.
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

// Listings content component
interface ListingsContentProps {
  listings: MarketplaceListing[];
  isLoading: boolean;
  onEdit: (listing: MarketplaceListing) => void;
  onView: (listing: MarketplaceListing) => void;
  onDelete: (listing: MarketplaceListing) => void;
  onMarkAsSold?: (listing: MarketplaceListing) => void;
  hideEdit?: boolean;
  hideMarkAsSold?: boolean;
}

function ListingsContent({
  listings,
  isLoading,
  onEdit,
  onView,
  onDelete,
  onMarkAsSold,
  hideEdit = false,
  hideMarkAsSold = false
}: ListingsContentProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <LoadingSpinner size="lg" color="primary" label="Loading listings..." />
      </div>
    );
  }
  
  if (listings.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-8 text-center">
        <svg 
          className="mx-auto h-12 w-12 text-gray-400" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1} 
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" 
          />
        </svg>
        <Heading level={3} className="mt-4 text-lg font-medium">No listings found</Heading>
        <Text className="mt-2 text-gray-500 dark:text-gray-400">
          You don't have any listings in this category yet.
        </Text>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {listings.map(listing => (
        <Card key={listing.id} className="overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            {/* Image */}
            <div className="w-full sm:w-48 h-48 flex-shrink-0 bg-gray-100 dark:bg-gray-800">
              {listing.images && listing.images.length > 0 ? (
                <img 
                  src={listing.images[0]} 
                  alt={listing.title} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg 
                    className="h-12 w-12 text-gray-400" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={1} 
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                    />
                  </svg>
                </div>
              )}
            </div>
            
            {/* Content */}
            <CardContent className="flex-1 flex flex-col p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Heading level={3} className="text-lg font-semibold">
                      {listing.title}
                    </Heading>
                    <Badge variant={statusColors[listing.status].variant}>
                      {statusColors[listing.status].text}
                    </Badge>
                  </div>
                  <Text className="text-green-600 dark:text-green-400 font-semibold mt-1">
                    ${listing.price}
                  </Text>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-1 sm:mt-0">
                  <Badge variant="outline">
                    {listing.views || 0} views
                  </Badge>
                  <Badge variant="outline">
                    {listing.saves || 0} saves
                  </Badge>
                </div>
              </div>
              
              <Text className="text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                {listing.description}
              </Text>
              
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                <div>
                  Location: {listing.location.city}, {listing.location.state || ''} {listing.location.country}
                </div>
                <div>
                  Listed on: {new Date(listing.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              {/* Actions row */}
              <div className="mt-auto flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onView(listing)}
                >
                  View
                </Button>
                
                {!hideEdit && listing.status !== 'sold' && (
                  <Button 
                    size="sm"
                    onClick={() => onEdit(listing)}
                  >
                    Edit
                  </Button>
                )}
                
                {!hideMarkAsSold && listing.status === 'active' && onMarkAsSold && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => onMarkAsSold(listing)}
                  >
                    Mark as Sold
                  </Button>
                )}
                
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => onDelete(listing)}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      ))}
    </div>
  );
}