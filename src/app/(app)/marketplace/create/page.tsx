// src/app/(app)/marketplace/create/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useMarketplace } from '@/lib/hooks/useMarketplace';
import { ListingForm } from '@/components/marketplace/ListingForm';
import { Heading, Text } from '@/components/ui/Typography';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Toast } from '@/components/common/feedback/Toast';

export default function CreateListingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { createListing, isLoading } = useMarketplace();
  
  // State for success message
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Handle form submission
  const handleSubmit = async (formData: any, images: File[]) => {
    if (!user) {
      setErrorMessage('You must be logged in to create a listing');
      return;
    }
    
    try {
      // Create the listing
      const listing = await createListing(formData, images);
      
      if (listing) {
        // Show success message
        setShowSuccessToast(true);
        
        // Redirect to the listing detail page after a short delay
        setTimeout(() => {
          router.push(`/marketplace/${listing.id}`);
        }, 1500);
      }
    } catch (error) {
      console.error('Error creating listing:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create listing');
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
    router.push('/login?returnUrl=/marketplace/create');
    return null;
  }
  
  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="mb-8">
        <Heading level={1}>Create New Listing</Heading>
        <Text className="text-gray-600 dark:text-gray-400 mt-2">
          Fill out the form below to list your golf equipment for sale.
        </Text>
      </div>
      
      <ListingForm
        onSubmit={handleSubmit}
        isSubmitting={isLoading}
        error={errorMessage}
      />
      
      {/* Success toast notification */}
      <Toast
        open={showSuccessToast}
        onClose={() => setShowSuccessToast(false)}
        variant="success"
        title="Listing Created!"
        description="Your listing has been successfully published."
        duration={5000}
      />
    </div>
  );
}