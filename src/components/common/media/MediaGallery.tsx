'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { VideoPlayer } from './VideoPlayer';

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  alt?: string;
}

export interface MediaGalleryProps {
  items: MediaItem[];
  className?: string;
  aspectRatio?: '16:9' | '4:3' | '1:1' | 'free';
  columns?: 1 | 2 | 3 | 4;
  maxItems?: number;
  onItemClick?: (item: MediaItem, index: number) => void;
}

export function MediaGallery({
  items,
  className,
  aspectRatio = 'free',
  columns = 3,
  maxItems = 9,
  onItemClick,
}: MediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const aspectRatioClasses = {
    '16:9': 'aspect-video',
    '4:3': 'aspect-4/3',
    '1:1': 'aspect-square',
    'free': '',
  };

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  };

  const displayItems = items.slice(0, maxItems);
  const hasMore = items.length > maxItems;
  const remainingCount = items.length - maxItems;

  const handleItemClick = (item: MediaItem, index: number) => {
    if (onItemClick) {
      onItemClick(item, index);
    } else {
      setActiveIndex(index);
    }
  };

  const closeModal = () => {
    setActiveIndex(null);
  };

  return (
    <>
      <div
        className={cn(
          'grid gap-2',
          columnClasses[columns],
          className
        )}
      >
        {displayItems.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              'relative cursor-pointer rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800',
              aspectRatioClasses[aspectRatio]
            )}
            onClick={() => handleItemClick(item, index)}
          >
            {item.type === 'image' ? (
              <img
                src={item.url}
                alt={item.alt || `Media item ${index + 1}`}
                className="w-full h-full object-cover transition-transform hover:scale-105"
              />
            ) : (
              <div className="relative w-full h-full">
                <img
                  src={item.thumbnail || item.url}
                  alt={item.alt || `Video thumbnail ${index + 1}`}
                  className="w-full h-full object-cover transition-transform hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-black/50 flex items-center justify-center">
                    <svg
                      className="h-6 w-6 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {index === maxItems - 1 && hasMore && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-lg font-bold">+{remainingCount}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {activeIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={closeModal}>
          <div className="max-w-4xl w-full max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <button
                className="absolute top-2 right-2 z-10 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                onClick={closeModal}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Media Display */}
              {items[activeIndex].type === 'image' ? (
                <img
                  src={items[activeIndex].url}
                  alt={items[activeIndex].alt || `Media item ${activeIndex + 1}`}
                  className="max-h-[80vh] mx-auto object-contain"
                />
              ) : (
                <VideoPlayer
                  src={items[activeIndex].url}
                  poster={items[activeIndex].thumbnail}
                  aspectRatio="16:9"
                  controls
                  autoPlay
                />
              )}

              {/* Navigation Controls */}
              {items.length > 1 && (
                <div className="absolute inset-x-0 bottom-0 flex justify-between items-center px-4 py-2">
                  <button
                    className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIndex((activeIndex - 1 + items.length) % items.length);
                    }}
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-white text-sm">
                    {activeIndex + 1} / {items.length}
                  </span>
                  <button
                    className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIndex((activeIndex + 1) % items.length);
                    }}
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}