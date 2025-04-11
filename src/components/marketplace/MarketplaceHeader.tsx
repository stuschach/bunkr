// src/components/marketplace/MarketplaceHeader.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ListingCategory, ListingFilter, ListingSortOption, categoryLabels } from '@/types/marketplace';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Heading, Text } from '@/components/ui/Typography';
import { cn } from '@/lib/utils/cn';

interface MarketplaceHeaderProps {
  onFilterChange: (filters: ListingFilter) => void;
  onSortChange: (sort: ListingSortOption) => void;
  onSearch: (query: string) => void;
  totalListings?: number;
  isLoading?: boolean;
}

export function MarketplaceHeader({
  onFilterChange,
  onSortChange,
  onSearch,
  totalListings,
  isLoading = false
}: MarketplaceHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State for filters and search
  const [searchValue, setSearchValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ListingCategory | 'all'>('all');
  const [selectedSort, setSelectedSort] = useState<ListingSortOption>({ 
    field: 'createdAt', 
    direction: 'desc' 
  });
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Initialize state from URL params if available
  useEffect(() => {
    const category = searchParams.get('category') as ListingCategory | 'all' || 'all';
    const search = searchParams.get('q') || '';
    const sort = searchParams.get('sort') || 'createdAt';
    const direction = searchParams.get('direction') || 'desc';
    const min = searchParams.get('min') || '';
    const max = searchParams.get('max') || '';
    
    setSelectedCategory(category);
    setSearchValue(search);
    setSelectedSort({ 
      field: sort as 'price' | 'createdAt' | 'views' | 'condition', 
      direction: direction as 'asc' | 'desc' 
    });
    setMinPrice(min);
    setMaxPrice(max);
    
    // Apply initial filters
    if (category !== 'all' || search || min || max) {
      onFilterChange({
        category: category !== 'all' ? category : undefined,
        searchQuery: search || undefined,
        minPrice: min ? parseInt(min) : undefined,
        maxPrice: max ? parseInt(max) : undefined
      });
    }
    
    // Apply initial sort
    onSortChange({ 
      field: sort as 'price' | 'createdAt' | 'views' | 'condition', 
      direction: direction as 'asc' | 'desc' 
    });
  }, [searchParams, onFilterChange, onSortChange]);

  // Handle category change
  const handleCategoryChange = (category: string) => {
    const newCategory = category as ListingCategory | 'all';
    setSelectedCategory(newCategory);
    
    // Update URL params
    updateUrlParams({
      category: newCategory === 'all' ? null : newCategory
    });
    
    // Apply filters
    onFilterChange({
      ...getCurrentFilters(),
      category: newCategory === 'all' ? undefined : newCategory
    });
  };

  // Handle sort change
  const handleSortChange = (sortValue: string) => {
    // Parse sort value in format "field:direction"
    const [field, direction] = sortValue.split(':');
    const newSort = { 
      field: field as 'price' | 'createdAt' | 'views' | 'condition', 
      direction: direction as 'asc' | 'desc' 
    };
    
    setSelectedSort(newSort);
    
    // Update URL params
    updateUrlParams({
      sort: field,
      direction
    });
    
    // Apply sort
    onSortChange(newSort);
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Update URL params
    updateUrlParams({
      q: searchValue || null
    });
    
    // Apply search
    onSearch(searchValue);
    
    // Apply filters
    onFilterChange({
      ...getCurrentFilters(),
      searchQuery: searchValue || undefined
    });
  };

  // Handle price range changes
  const handleApplyPriceRange = () => {
    // Update URL params
    updateUrlParams({
      min: minPrice || null,
      max: maxPrice || null
    });
    
    // Apply filters
    onFilterChange({
      ...getCurrentFilters(),
      minPrice: minPrice ? parseInt(minPrice) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice) : undefined
    });
  };

  // Helper to get current filters
  const getCurrentFilters = (): ListingFilter => {
    return {
      category: selectedCategory === 'all' ? undefined : selectedCategory,
      searchQuery: searchValue || undefined,
      minPrice: minPrice ? parseInt(minPrice) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice) : undefined
    };
  };

  // Helper to update URL params
  const updateUrlParams = (params: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    
    // Update or remove each param
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });
    
    // Update URL without reload
    router.push(url.pathname + url.search);
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedCategory('all');
    setSearchValue('');
    setMinPrice('');
    setMaxPrice('');
    
    // Clear URL params except sort
    const sortField = selectedSort.field;
    const sortDirection = selectedSort.direction;
    router.push(`/marketplace?sort=${sortField}&direction=${sortDirection}`);
    
    // Apply empty filters
    onFilterChange({});
  };

  // Handle show/hide filters
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Heading level={2}>Golf Marketplace</Heading>
          {totalListings !== undefined && !isLoading && (
            <Text className="text-gray-600 dark:text-gray-400">
              {totalListings} {totalListings === 1 ? 'listing' : 'listings'} available
            </Text>
          )}
          {isLoading && (
            <Text className="text-gray-600 dark:text-gray-400">
              Loading listings...
            </Text>
          )}
        </div>
        
        <div className="flex space-x-2 w-full md:w-auto">
          <Button 
            onClick={() => router.push('/marketplace/create')}
            className="flex-grow md:flex-grow-0"
          >
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
            Sell an Item
          </Button>
          
          <Button 
            variant="outline" 
            onClick={toggleFilters}
            className="md:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
          </Button>
        </div>
      </div>
      
      {/* Search and filters bar */}
      <div className={cn(
        "flex flex-col md:flex-row md:items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800",
        !showFilters && "md:flex hidden"
      )}>
        {/* Search input */}
        <div className="flex-grow">
          <form onSubmit={handleSearch} className="flex">
            <Input
              placeholder="Search for clubs, accessories, etc."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="rounded-r-none"
              leftIcon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              }
            />
            <Button type="submit" className="rounded-l-none">
              Search
            </Button>
          </form>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Category filter */}
          <Select
            options={[
              { value: 'all', label: 'All Categories' },
              ...Object.entries(categoryLabels).map(([value, label]) => ({
                value,
                label
              }))
            ]}
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="w-full md:w-44"
          />
          
          {/* Price range */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Input
              placeholder="Min $"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              type="number"
              min="0"
              className="w-24"
            />
            <span className="text-gray-500">-</span>
            <Input
              placeholder="Max $"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              type="number"
              min="0"
              className="w-24"
            />
            <Button variant="outline" size="sm" onClick={handleApplyPriceRange}>
              Apply
            </Button>
          </div>
          
          {/* Sort options */}
          <Select
            options={[
              { value: 'createdAt:desc', label: 'Newest First' },
              { value: 'createdAt:asc', label: 'Oldest First' },
              { value: 'price:asc', label: 'Price: Low to High' },
              { value: 'price:desc', label: 'Price: High to Low' },
              { value: 'views:desc', label: 'Most Viewed' }
            ]}
            value={`${selectedSort.field}:${selectedSort.direction}`}
            onChange={handleSortChange}
            className="w-full md:w-48"
          />
          
          {/* Clear filters */}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>
    </div>
  );
}