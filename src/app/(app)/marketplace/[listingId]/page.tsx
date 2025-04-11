// src/app/(app)/marketplace/[listingId]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useMarketplace } from '@/lib/hooks/useMarketplace';
import { useMessages } from '@/lib/hooks/useMessages';
import { 
  MarketplaceListing, 
  conditionLabels, 
  categoryLabels 
} from '@/types/marketplace';

// UI Components
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/common/feedback/Toast';

// Utils
import { formatShortDate } from '@/lib/utils/date-format';
import { cn } from '@/lib/utils/cn';

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { getListing, toggleSaveListing, isListingSaved, getSellerListings } = useMarketplace();
  const { getOrCreateChat, sendMessage } = useMessages();

  // Component state
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [sellerListings, setSellerListings] = useState<MarketplaceListing[]>([]);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add state for notifications
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const listingId = params.listingId as string;

  // Load listing details
  useEffect(() => {
    // Safety check
    if (!listingId) {
      setError("No listing ID provided");
      setLoading(false);
      return;
    }
    
    let isActive = true;
    const viewKey = `listing_viewed_${listingId}`;
    const alreadyViewed = sessionStorage.getItem(viewKey);
    
    const fetchListing = async () => {
      try {
        console.log("Fetching listing data for:", listingId);
        const listingData = await getListing(listingId);
        
        // Only update state if component is still mounted
        if (!isActive) return;
        
        if (listingData) {
          console.log("Listing data received:", listingData.id);
          setListing(listingData);
          setError(null);
          
          // Mark as viewed in session storage
          if (!alreadyViewed) {
            sessionStorage.setItem(viewKey, 'true');
          }
          
          // Fetch other data after successful listing fetch
          if (user) {
            try {
              const isSaved = await isListingSaved(listingId);
              if (isActive) setSaved(isSaved);
            } catch (err) {
              console.error("Error checking saved status:", err);
            }
          }
          
          if (listingData.sellerId) {
            try {
              const sellerItems = await getSellerListings(listingData.sellerId);
              if (isActive) {
                setSellerListings(
                  sellerItems
                    .filter(item => item.id !== listingId)
                    .slice(0, 4)
                );
              }
            } catch (err) {
              console.error("Error fetching seller listings:", err);
            }
          }
        } else {
          console.log("No listing data found");
          setError("Listing not found");
        }
      } catch (err) {
        console.error('Error fetching listing:', err);
        if (isActive) setError("Failed to load listing");
      } finally {
        // Always update loading state unless component unmounted
        if (isActive) {
          console.log("Setting loading to false");
          setLoading(false);
        }
      }
    };
    
    fetchListing();
    
    // Cleanup function to prevent memory leaks
    return () => {
      isActive = false;
    };
  }, [listingId, getListing, user, isListingSaved, getSellerListings]);
  
  // Handle save/unsave listing
  const handleToggleSave = async () => {
    if (!user) {
      router.push(`/login?returnUrl=/marketplace/${listingId}`);
      return;
    }
    
    setSavingStatus(true);
    try {
      const isSaved = await toggleSaveListing(listingId);
      setSaved(isSaved);
    } catch (error) {
      console.error('Error toggling save status:', error);
    } finally {
      setSavingStatus(false);
    }
  };
  
  // Handle contact seller
  const handleContactSeller = () => {
    if (!user) {
      router.push(`/login?returnUrl=/marketplace/${listingId}`);
      return;
    }
    
    // Set default message with listing title
    setContactMessage(`Hi, I'm interested in your listing "${listing?.title}". Is it still available?`);
    setShowContactDialog(true);
  };
  
  // Handle share with improved error handling
  const handleShare = async () => {
    try {
      if (!navigator.share) {
        throw new Error('Web Share API not supported on this browser');
      }
      
      await navigator.share({
        title: listing?.title || 'Check out this listing on Bunkr',
        text: `Check out this ${listing?.title} for $${listing?.price} on Bunkr`,
        url: window.location.href
      });
    } catch (err) {
      // Don't treat "AbortError" (user canceled share) as an error
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Error sharing:', err);
        setShareError(err.message || 'Unable to share');
      }
    }
  };
  
  // Handle send message
  const handleSendMessage = async () => {
    if (!user || !listing || !listing.sellerId) return;
    
    setSendingMessage(true);
    try {
      // Create or get chat with seller
      const chat = await getOrCreateChat(listing.sellerId);
      
      // Send the message directly
      await sendMessage(chat.id, contactMessage);
      
      // Show success toast
      setShowSuccessToast(true);
      
      // Close the dialog
      setShowContactDialog(false);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };
  
  // Handle view image gallery
  const handleViewGallery = (index: number) => {
    setActiveImageIndex(index);
    setShowImageGallery(true);
  };
  
  // Convert listing images to MediaGallery format
  const mediaItems = listing?.images?.map((url, index) => ({
    id: `image-${index}`,
    type: 'image',
    url,
    alt: `${listing.title} - Image ${index + 1}`
  })) || [];
  
  // RENDERING LOGIC
  
  // Show loading state during initial load
  if ((loading || authLoading) && !error) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading listing..." />
      </div>
    );
  }
  
  // Handle error state (including not found)
  if (error) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-12 text-center">
        <Heading level={2} className="mb-4">Listing Not Found</Heading>
        <Text className="mb-8 text-gray-600 dark:text-gray-400">
          {error === "Listing not found" 
            ? "This listing may have been removed or is no longer available."
            : "There was a problem loading this listing. Please try again."}
        </Text>
        <Button onClick={() => router.push('/marketplace')}>
          Browse Other Listings
        </Button>
      </div>
    );
  }
  
  // Make sure we have a listing before rendering the main UI
  if (!listing) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading listing details..." />
      </div>
    );
  }
  
  // Main UI with listing details
  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      {/* Back button and breadcrumbs */}
      <div className="mb-6 flex items-center">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 111.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Marketplace
        </button>
      </div>
      
      {/* Main content layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left column - Images */}
        <div className="md:col-span-2">
          {/* Main image and gallery */}
          <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 mb-6">
            {listing?.images && listing.images.length > 0 ? (
              <>
                {/* Main image */}
                <div 
                  className="aspect-[4/3] overflow-hidden cursor-pointer relative"
                  onClick={() => handleViewGallery(0)}
                >
                  <img 
                    src={listing.images[0]} 
                    alt={listing.title} 
                    className="w-full h-full object-contain" 
                  />
                  
                  {listing.status === 'sold' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Badge 
                        variant="secondary"
                        className="text-2xl font-bold px-8 py-2 bg-white text-gray-900 transform -rotate-12"
                      >
                        SOLD
                      </Badge>
                    </div>
                  )}
                </div>
                
                {/* Thumbnail gallery */}
                {listing.images.length > 1 && (
                  <div className="flex gap-2 p-4">
                    {listing.images.map((image, index) => (
                      <div 
                        key={index}
                        className={cn(
                          "w-20 h-20 rounded overflow-hidden cursor-pointer border-2",
                          index === activeImageIndex 
                            ? "border-green-500" 
                            : "border-transparent hover:border-gray-300 dark:hover:border-gray-700"
                        )}
                        onClick={() => handleViewGallery(index)}
                      >
                        <img 
                          src={image} 
                          alt={`${listing.title} - Image ${index + 1}`} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <svg 
                  className="h-24 w-24 text-gray-400" 
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
          
          {/* Listing details */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 mb-6">
            <Heading level={3} className="text-xl font-bold mb-4">Description</Heading>
            <Text className="whitespace-pre-line mb-6">
              {listing?.description}
            </Text>
            
            {/* Specifications */}
            {listing?.specifications && Object.keys(listing.specifications).length > 0 && (
              <div className="mt-4">
                <Heading level={4} className="text-lg font-semibold mb-2">Specifications</Heading>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  {Object.entries(listing.specifications).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Shipping Details */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 mb-6">
            <Heading level={3} className="text-xl font-bold mb-4">Shipping & Pickup</Heading>
            
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <svg 
                  className="h-5 w-5 text-gray-600 dark:text-gray-400" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
                  />
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
                  />
                </svg>
                <span className="font-medium">Item Location:</span>
                <span>
                  {listing?.location.city}, 
                  {listing?.location.state ? `${listing.location.state}, ` : ''} 
                  {listing?.location.country}
                </span>
              </div>
              
              <div className="mt-4 space-y-2">
                {listing?.shippingOption === 'local-pickup' || listing?.shippingOption === 'both' ? (
                  <div className="flex items-center gap-2">
                    <svg 
                      className="h-5 w-5 text-green-500" 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                    <span>Local Pickup Available</span>
                  </div>
                ) : null}
                
                {listing?.shippingOption === 'shipping' || listing?.shippingOption === 'both' ? (
                  <div className="flex items-center gap-2">
                    <svg 
                      className="h-5 w-5 text-green-500" 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                    <span>
                      Shipping Available
                      {listing?.shippingPrice ? ` ($${listing.shippingPrice})` : ''}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        
        {/* Right column - Price, Seller info, and Actions */}
        <div className="md:col-span-1 space-y-6">
          {/* Price and Details Card */}
          <Card>
            <CardContent className="p-6">
              {/* Price */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <Heading level={2} className="text-3xl font-bold text-green-600 dark:text-green-400">
                    ${listing?.price}
                  </Heading>
                  {listing?.negotiable && (
                    <Text className="text-gray-600 dark:text-gray-400 text-sm">
                      or Best Offer
                    </Text>
                  )}
                </div>
                
                {/* Date posted */}
                <div className="text-right">
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    Listed on {formatShortDate(listing?.createdAt || new Date())}
                  </Text>
                </div>
              </div>
              
              {/* Status badge */}
              {listing?.status !== 'active' && (
                <div className="mb-4">
                  {listing?.status === 'sold' && (
                    <Badge variant="secondary" className="w-full py-1 justify-center text-sm bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                      Sold
                    </Badge>
                  )}
                  {listing?.status === 'pending' && (
                    <Badge variant="warning" className="w-full py-1 justify-center text-sm">
                      Sale Pending
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Key details */}
              <div className="space-y-3 mb-6">
                {/* Category */}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Category</span>
                  <span className="font-medium">{listing?.category ? categoryLabels[listing.category] : '-'}</span>
                </div>
                
                {/* Condition */}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Condition</span>
                  <span className="font-medium">{listing?.condition ? conditionLabels[listing.condition] : '-'}</span>
                </div>
                
                {/* Brand */}
                {listing?.brand && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Brand</span>
                    <span className="font-medium">{listing.brand}</span>
                  </div>
                )}
                
                {/* Model */}
                {listing?.model && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Model</span>
                    <span className="font-medium">{listing.model}</span>
                  </div>
                )}
                
                {/* Dexterity */}
                {listing?.dexterity && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Dexterity</span>
                    <span className="font-medium">
                      {listing.dexterity === 'right' ? 'Right-handed' : 
                       listing.dexterity === 'left' ? 'Left-handed' : 'Universal'}
                    </span>
                  </div>
                )}
                
                {/* Year */}
                {listing?.yearManufactured && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Year</span>
                    <span className="font-medium">{listing.yearManufactured}</span>
                  </div>
                )}
              </div>
              
              {/* Action buttons */}
              <div className="space-y-3">
                {listing?.status === 'active' && (
                  <Button
                    className="w-full"
                    onClick={handleContactSeller}
                    disabled={listing?.sellerId === user?.uid}
                  >
                    {listing?.sellerId === user?.uid ? "This is your listing" : "Contact Seller"}
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleToggleSave}
                  disabled={savingStatus || listing?.sellerId === user?.uid}
                >
                  {savingStatus ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" color="primary" className="mr-2" />
                      <span>Saving...</span>
                    </div>
                  ) : saved ? (
                    <>
                      <svg
                        className="mr-2 h-5 w-5 text-red-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Saved
                    </>
                  ) : (
                    <>
                      <svg
                        className="mr-2 h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                      Save
                    </>
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={handleShare}
                >
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  Share
                </Button>
                
                {listing?.status === 'active' && listing?.sellerId === user?.uid && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push(`/marketplace/manage/${listingId}`)}
                  >
                    <svg
                      className="mr-2 h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Listing
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Seller Information */}
          {listing?.seller && (
            <Card>
              <CardContent className="p-6">
                <Heading level={3} className="text-lg font-semibold mb-4">
                  Seller Information
                </Heading>
                
                <div className="flex items-center space-x-3 mb-4">
                  <Avatar
                    src={listing.seller.photoURL}
                    alt={listing.seller.displayName || "Seller"}
                    size="md"
                  />
                  <div>
                    <Text className="font-medium">
                      {listing.seller.displayName}
                    </Text>
                    {listing.seller.handicapIndex !== null && (
                      <Text className="text-sm text-gray-600 dark:text-gray-400">
                        Handicap: {listing.seller.handicapIndex}
                      </Text>
                    )}
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/profile/${listing.seller?.uid}`)}
                >
                  View Profile
                </Button>
              </CardContent>
            </Card>
          )}
          
          {/* Safety Tips */}
          <Card>
            <CardContent className="p-6">
              <Heading level={3} className="text-lg font-semibold mb-4">
                Marketplace Safety Tips
              </Heading>
              
              <ul className="space-y-2 text-sm">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Meet in a public place for in-person transactions</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Inspect items thoroughly before purchasing</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Use Bunkr's messaging system for all communications</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Report suspicious listings or behavior</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* More from this seller */}
      {sellerListings.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <Heading level={3} className="text-xl font-bold">
              More from this Seller
            </Heading>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push(`/marketplace?sellerId=${listing?.sellerId}`)}
            >
              View All
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sellerListings.map(item => (
              <ListingCard
                key={item.id}
                listing={item}
                showSellerInfo={false}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Contact Seller Dialog */}
      <Dialog
        open={showContactDialog}
        onClose={() => setShowContactDialog(false)}
      >
        <DialogHeader>
          <DialogTitle>Contact Seller</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <Text>
              Send a message to {listing?.seller?.displayName} about this listing:
            </Text>
            
            <Input
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              placeholder="Write your message here"
              className="w-full"
              multiline={true}
              rows={4}
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowContactDialog(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendMessage}
            disabled={!contactMessage.trim() || sendingMessage}
            isLoading={sendingMessage}
          >
            Send Message
          </Button>
        </DialogFooter>
      </Dialog>
      
      {/* Image Gallery Modal */}
      <Dialog
        open={showImageGallery}
        onClose={() => setShowImageGallery(false)}
        className="max-w-4xl"
      >
        {listing?.images && listing.images.length > 0 && (
          <DialogContent className="p-0">
            <div className="relative">
              <button
                onClick={() => setShowImageGallery(false)}
                className="absolute top-2 right-2 z-10 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <div className="flex justify-center items-center">
                <img
                  src={listing.images[activeImageIndex]}
                  alt={`${listing.title} - Image ${activeImageIndex + 1}`}
                  className="max-h-[80vh] object-contain"
                />
              </div>
              
              {/* Navigation controls */}
              {listing.images.length > 1 && (
                <div className="absolute inset-x-0 bottom-2 flex justify-between items-center px-4">
                  <button
                    className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                    onClick={() => setActiveImageIndex((activeImageIndex - 1 + listing.images.length) % listing.images.length)}
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <span className="text-white bg-black/50 px-3 py-1 rounded-full text-sm">
                    {activeImageIndex + 1} / {listing.images.length}
                  </span>
                  
                  <button
                    className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                    onClick={() => setActiveImageIndex((activeImageIndex + 1) % listing.images.length)}
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
      
      {/* Success Toast for message sent */}
      <Toast
        open={showSuccessToast}
        onClose={() => setShowSuccessToast(false)}
        variant="success"
        title="Message Sent!"
        description="Your message has been sent to the seller."
        duration={3000}
      />
      
      {/* Share Error Toast */}
      {shareError && (
        <Toast
          open={!!shareError}
          onClose={() => setShareError(null)}
          variant="error"
          title="Share Error"
          description={shareError}
          duration={3000}
        />
      )}
    </div>
  );
}