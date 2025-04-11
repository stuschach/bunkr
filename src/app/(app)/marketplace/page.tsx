// src/app/(app)/marketplace/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MarketplaceListing, ListingFilter, ListingSortOption } from '@/types/marketplace';
import { useMarketplace } from '@/lib/hooks/useMarketplace';
import { useAuth } from '@/lib/contexts/AuthContext';

// Components
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Text } from '@/components/ui/Typography';
import { CategoryNav } from '@/components/marketplace/CategoryNav';
import { Tabs } from '@/components/ui/Tabs';

// Main Marketplace component
export default function MarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const {
    isLoading,
    error,
    hasMoreListings,
    getListings,
    getFeaturedListings,
    getMyListings,
    getMySavedListings,
    searchListings,
    resetPagination
  } = useMarketplace();

  // Component state
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [featuredListings, setFeaturedListings] = useState<MarketplaceListing[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [filters, setFilters] = useState<ListingFilter>({});
  const [sortOption, setSortOption] = useState<ListingSortOption>({
    field: 'createdAt',
    direction: 'desc'
  });
  const [pageSize] = useState(20);
  const [activeTab, setActiveTab] = useState('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Memoize the current filters to prevent unnecessary re-renders
  const currentFilters = useMemo(() => ({
    ...filters,
    searchQuery: searchQuery || undefined
  }), [filters, searchQuery]);
  
  // Set component as mounted on first render
  useEffect(() => {
    setIsMounted(true);
    
    // Get initial tab from URL if present
    const tab = searchParams.get('tab');
    if (tab && ['browse', 'my-listings', 'saved', 'search'].includes(tab)) {
      setActiveTab(tab);
    }
    
    return () => {
      // Reset pagination when component unmounts
      resetPagination();
    };
  }, [searchParams, resetPagination]);
  
  // Load featured listings
  useEffect(() => {
    if (!isMounted) return;
    
    const loadFeatured = async () => {
      try {
        const featured = await getFeaturedListings(4);
        setFeaturedListings(featured);
      } catch (error) {
        console.error('Error loading featured listings:', error);
      }
    };
    
    if (activeTab === 'browse') {
      loadFeatured();
    }
  }, [getFeaturedListings, isMounted, activeTab]);

  // Load initial listings
  useEffect(() => {
    if (!isMounted) return;
    
    const loadInitialListings = async () => {
      try {
        let results: MarketplaceListing[] = [];
        
        if (activeTab === 'browse') {
          results = await getListings(currentFilters, sortOption, pageSize, true);
        } else if (activeTab === 'my-listings' && user) {
          results = await getMyListings();
        } else if (activeTab === 'saved' && user) {
          results = await getMySavedListings();
        } else if (activeTab === 'search' && searchQuery) {
          results = await searchListings(searchQuery);
        }
        
        setListings(results);
        setTotalCount(results.length);
      } catch (error) {
        console.error('Error loading listings:', error);
      }
    };
    
    loadInitialListings();
    // We're using deep dependencies to avoid unnecessary re-renders
  }, [
    isMounted,
    activeTab, 
    JSON.stringify(currentFilters), 
    JSON.stringify(sortOption), 
    searchQuery, 
    user?.uid, 
    pageSize
  ]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: ListingFilter) => {
    setFilters(newFilters);
  }, []);

  // Handle sort changes
  const handleSortChange = useCallback((newSort: ListingSortOption) => {
    setSortOption(newSort);
  }, []);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setActiveTab('search');
    
    // Update URL to reflect the search tab
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'search');
    router.push(url.pathname + url.search);
  }, [router]);

  // Handle tab change
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    
    // Update URL to reflect the new tab
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.push(url.pathname + url.search);
  }, [router]);

  // Handle loading more listings with infinite scroll
  const loadMoreListings = useCallback(async () => {
    if (isFetchingMore || !hasMoreListings || activeTab !== 'browse') return;
    
    setIsFetchingMore(true);
    try {
      const moreListings = await getListings(filters, sortOption, pageSize, false);
      setListings(prev => [...prev, ...moreListings]);
      setTotalCount(prev => prev + moreListings.length);
    } catch (error) {
      console.error('Error loading more listings:', error);
    } finally {
      setIsFetchingMore(false);
    }
  }, [
    isFetchingMore, 
    hasMoreListings, 
    activeTab, 
    filters, 
    sortOption, 
    pageSize, 
    getListings
  ]);

  // Infinite scroll logic with Intersection Observer
  const observerTarget = useRef(null);
  
  useEffect(() => {
    if (!isMounted || activeTab !== 'browse') return;
    
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          loadMoreListings();
        }
      },
      { threshold: 0.1 }
    );
    
    const currentTarget = observerTarget.current;
    
    if (currentTarget) {
      observer.observe(currentTarget);
    }
    
    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loadMoreListings, isMounted, activeTab]);

  // Show loading during initial auth check
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading marketplace..." />
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-6">
      {/* Marketplace header with search and filters */}
      <MarketplaceHeader
        onFilterChange={handleFilterChange}
        onSortChange={handleSortChange}
        onSearch={handleSearch}
        totalListings={activeTab === 'browse' ? totalCount : undefined}
        isLoading={isLoading}
      />
      
      {/* Mobile category navigation */}
      <div className="md:hidden mb-6">
        <CategoryNav onCategorySelect={(category) => {
          handleFilterChange({ ...filters, category: category === 'all' ? undefined : category });
          setActiveTab('browse');
        }} />
      </div>
      
      {/* Tabs and main content layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar with category navigation (desktop) */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 sticky top-24">
            <h3 className="font-medium mb-4">Categories</h3>
            <CategoryNav 
              vertical 
              onCategorySelect={(category) => {
                handleFilterChange({ ...filters, category: category === 'all' ? undefined : category });
                setActiveTab('browse');
              }} 
            />
          </div>
        </div>
        
        {/* Main content area */}
        <div className="flex-grow">
          {/* Tabs */}
          <Tabs
            tabs={[
              {
                id: 'browse',
                label: 'Browse Listings',
                content: (
                  <div className="pb-8">
                    {/* Featured listings */}
                    {featuredListings.length > 0 && activeTab === 'browse' && !searchQuery && !filters.category && (
                      <div className="mb-8">
                        <h3 className="text-lg font-medium mb-4">Featured Listings</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {featuredListings.map(listing => (
                            <ListingCard
                              key={listing.id}
                              listing={listing}
                              showSellerInfo
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* All listings grid */}
                    {isLoading && listings.length === 0 ? (
                      <div className="flex justify-center items-center py-20">
                        <LoadingSpinner size="lg" color="primary" label="Loading listings..." />
                      </div>
                    ) : listings.length > 0 ? (
                      <>
                        <h3 className="text-lg font-medium mb-4">
                          {searchQuery ? 'Search Results' : filters.category ? 'Category Results' : 'All Listings'}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {listings.map(listing => (
                            <ListingCard
                              key={listing.id}
                              listing={listing}
                              showSellerInfo
                            />
                          ))}
                        </div>
                        
                        {/* Load more target */}
                        {hasMoreListings && activeTab === 'browse' && (
                          <div ref={observerTarget} className="py-8 flex justify-center">
                            {isFetchingMore ? (
                              <LoadingSpinner size="md" color="primary" label="Loading more..." />
                            ) : (
                              <Button variant="outline" onClick={loadMoreListings}>
                                Load More
                              </Button>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                          />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                          No listings found
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {searchQuery
                            ? 'Try a different search term or browse all listings.'
                            : filters.category
                            ? 'No listings in this category. Try another category or browse all listings.'
                            : 'There are no active listings at the moment.'}
                        </p>
                        <div className="mt-6">
                          <Button onClick={() => {
                            handleFilterChange({});
                            setSearchQuery('');
                            const url = new URL(window.location.href);
                            url.searchParams.delete('q');
                            url.searchParams.delete('category');
                            router.push(url.pathname + url.search);
                          }}>
                            View All Listings
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              },
              {
                id: 'my-listings',
                label: 'My Listings',
                content: (
                  <div className="pb-8">
                    {!user ? (
                      <div className="text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Please log in to view your listings
                        </h3>
                        <div className="mt-6">
                          <Button onClick={() => router.push('/login?returnUrl=/marketplace?tab=my-listings')}>
                            Log In
                          </Button>
                        </div>
                      </div>
                    ) : isLoading ? (
                      <div className="flex justify-center items-center py-20">
                        <LoadingSpinner size="lg" color="primary" label="Loading your listings..." />
                      </div>
                    ) : listings.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">Your Listings</h3>
                          <Button onClick={() => router.push('/marketplace/create')}>
                            Add New Listing
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {listings.map(listing => (
                            <ListingCard
                              key={listing.id}
                              listing={listing}
                              showSellerInfo={false}
                              onClick={() => router.push(`/marketplace/manage/${listing.id}`)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                          />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                          You haven't listed any items yet
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Start selling your golf equipment with just a few clicks.
                        </p>
                        <div className="mt-6">
                          <Button onClick={() => router.push('/marketplace/create')}>
                            Create Your First Listing
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              },
              {
                id: 'saved',
                label: 'Saved Items',
                content: (
                  <div className="pb-8">
                    {!user ? (
                      <div className="text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Please log in to view your saved items
                        </h3>
                        <div className="mt-6">
                          <Button onClick={() => router.push('/login?returnUrl=/marketplace?tab=saved')}>
                            Log In
                          </Button>
                        </div>
                      </div>
                    ) : isLoading ? (
                      <div className="flex justify-center items-center py-20">
                        <LoadingSpinner size="lg" color="primary" label="Loading saved items..." />
                      </div>
                    ) : listings.length > 0 ? (
                      <div>
                        <h3 className="text-lg font-medium mb-4">Saved Items</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {listings.map(listing => (
                            <ListingCard
                              key={listing.id}
                              listing={listing}
                              showSellerInfo
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                          No saved items yet
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Browse listings and click the heart icon to save items you're interested in.
                        </p>
                        <div className="mt-6">
                          <Button onClick={() => handleTabChange('browse')}>
                            Browse Listings
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
            ]}
            defaultTab={activeTab}
            onChange={handleTabChange}
          />
        </div>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}