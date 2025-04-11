// src/components/marketplace/ListingCard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MarketplaceListing, conditionLabels } from '@/types/marketplace';
import { Card, CardContent } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils/cn';
import { formatShortDate } from '@/lib/utils/date-format';
import { useMarketplace } from '@/lib/hooks/useMarketplace';

interface ListingCardProps {
  listing: MarketplaceListing;
  className?: string;
  showSellerInfo?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export function ListingCard({
  listing,
  className,
  showSellerInfo = true,
  compact = false,
  onClick
}: ListingCardProps) {
  const router = useRouter();
  const { toggleSaveListing, isListingSaved } = useMarketplace();
  const [saved, setSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  // Check if this listing is saved by the current user
  useEffect(() => {
    const checkSaved = async () => {
      const isSaved = await isListingSaved(listing.id);
      setSaved(isSaved);
    };
    
    checkSaved();
  }, [listing.id, isListingSaved]);

  // Navigate to listing detail
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/marketplace/${listing.id}`);
    }
  };

  // Handle save button click
  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    if (loading) return;
    
    setLoading(true);
    try {
      const isSaved = await toggleSaveListing(listing.id);
      setSaved(isSaved);
    } catch (error) {
      console.error('Error saving listing:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all hover:shadow-md cursor-pointer group',
        className
      )}
      onClick={handleClick}
    >
      {/* Image area with "Save" button */}
      <div className="relative h-48 overflow-hidden bg-gray-100 dark:bg-gray-800">
        {listing.images && listing.images.length > 0 ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12"
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

        {/* Save button */}
        <button
          onClick={handleSave}
          className={cn(
            'absolute top-2 right-2 p-2 rounded-full bg-white/80 dark:bg-gray-800/80 transition-colors',
            saved
              ? 'text-red-500 hover:text-red-600'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          )}
          aria-label={saved ? 'Unsave listing' : 'Save listing'}
          disabled={loading}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill={saved ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>

        {/* Status badge */}
        {listing.status === 'sold' && (
          <div className="absolute top-0 left-0 w-full h-full bg-black/40 flex items-center justify-center">
            <Badge
              variant="secondary"
              className="text-lg font-bold bg-white text-gray-900 px-4 py-1 transform -rotate-12"
            >
              SOLD
            </Badge>
          </div>
        )}
        
        {listing.status === 'pending' && (
          <Badge
            variant="warning"
            className="absolute top-2 left-2 text-xs"
          >
            Pending
          </Badge>
        )}
        
        {listing.featured && (
          <Badge
            variant="default"
            className="absolute bottom-2 left-2 text-xs"
          >
            Featured
          </Badge>
        )}
      </div>

      <CardContent className={cn(
        "p-4", 
        compact ? "space-y-1" : "space-y-3"
      )}>
        {/* Listing title and price */}
        <div className="flex justify-between items-start">
          <h3 
            className={cn(
              "font-medium text-gray-900 dark:text-gray-100 line-clamp-2",
              compact ? "text-sm" : "text-base"
            )}
          >
            {listing.title}
          </h3>
          <span 
            className={cn(
              "font-bold text-green-600 dark:text-green-400 whitespace-nowrap ml-2",
              compact ? "text-sm" : "text-lg"
            )}
          >
            ${listing.price}
          </span>
        </div>

        {/* Condition badge */}
        {!compact && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              {conditionLabels[listing.condition]}
            </Badge>
            {listing.dexterity && (
              <Badge variant="outline" className="text-xs">
                {listing.dexterity === 'right' ? 'Right-handed' : listing.dexterity === 'left' ? 'Left-handed' : 'Universal'}
              </Badge>
            )}
          </div>
        )}

        {/* Location and date */}
        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
          <div className="truncate">
            {listing.location.city}, {listing.location.state || listing.location.country}
          </div>
          <div>
            {formatShortDate(listing.createdAt)}
          </div>
        </div>

        {/* Seller info */}
        {showSellerInfo && listing.seller && (
          <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-800 flex items-center">
            <Avatar
              src={listing.seller.photoURL}
              alt={listing.seller.displayName || "Seller"}
              size="sm"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 truncate">
              {listing.seller.displayName}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}