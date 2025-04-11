// src/components/marketplace/CategoryNav.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  ListingCategory, 
  categoryLabels,
  categoryIcons 
} from '@/types/marketplace';
import { cn } from '@/lib/utils/cn';

interface CategoryNavProps {
  onCategorySelect: (category: ListingCategory | 'all') => void;
  vertical?: boolean;
  className?: string;
}

// SVG icon components (simplified versions for each category)
const CategoryIcon = ({ category }: { category: ListingCategory | 'all' }) => {
  // Default icon for 'all' or unknown categories
  if (category === 'all') {
    return (
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
          strokeWidth={1.5}
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    );
  }

  // Return appropriate icon based on category
  switch (category) {
    case 'drivers':
      return (
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
            strokeWidth={1.5}
            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
          />
        </svg>
      );
    case 'irons':
      return (
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
            strokeWidth={1.5}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      );
    case 'wedges':
      return (
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
            strokeWidth={1.5}
            d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    case 'putters':
      return (
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
            strokeWidth={1.5}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      );
    case 'bags':
      return (
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
            strokeWidth={1.5}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      );
    case 'balls':
      return (
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
            strokeWidth={1.5}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      );
    case 'technology':
      return (
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
            strokeWidth={1.5}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      );
    // Default generic icon for other categories
    default:
      return (
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
            strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      );
  }
};

export function CategoryNav({ 
  onCategorySelect, 
  vertical = false,
  className 
}: CategoryNavProps) {
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<ListingCategory | 'all'>('all');

  // Initialize active category from URL params
  useEffect(() => {
    const category = searchParams.get('category') as ListingCategory | null;
    if (category && Object.keys(categoryLabels).includes(category)) {
      setActiveCategory(category);
    } else {
      setActiveCategory('all');
    }
  }, [searchParams]);

  // Handle category selection
  const handleCategoryClick = (category: ListingCategory | 'all') => {
    setActiveCategory(category);
    onCategorySelect(category);
  };

  // Group categories for organization
  const categoryGroups = {
    clubs: ['drivers', 'woods', 'hybrids', 'irons', 'wedges', 'putters', 'complete-sets'],
    accessories: ['bags', 'balls', 'push-carts', 'accessories', 'technology'],
    apparel: ['apparel', 'shoes'],
    other: ['other']
  };

  // If vertical, render categories in groups with headings
  if (vertical) {
    return (
      <div className={cn("space-y-4", className)}>
        <div>
          <button
            onClick={() => handleCategoryClick('all')}
            className={cn(
              "flex items-center space-x-2 w-full text-left px-3 py-2 rounded-md transition-colors",
              activeCategory === 'all'
                ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <CategoryIcon category="all" />
            <span>All Categories</span>
          </button>
        </div>

        <div className="space-y-4">
          {/* Clubs Section */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 px-3">Clubs</h4>
            <ul className="space-y-1">
              {categoryGroups.clubs.map(cat => (
                <li key={cat}>
                  <button
                    onClick={() => handleCategoryClick(cat as ListingCategory)}
                    className={cn(
                      "flex items-center space-x-2 w-full text-left px-3 py-2 rounded-md transition-colors text-sm",
                      activeCategory === cat
                        ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    <CategoryIcon category={cat as ListingCategory} />
                    <span>{categoryLabels[cat as ListingCategory]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Accessories Section */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 px-3">Accessories</h4>
            <ul className="space-y-1">
              {categoryGroups.accessories.map(cat => (
                <li key={cat}>
                  <button
                    onClick={() => handleCategoryClick(cat as ListingCategory)}
                    className={cn(
                      "flex items-center space-x-2 w-full text-left px-3 py-2 rounded-md transition-colors text-sm",
                      activeCategory === cat
                        ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    <CategoryIcon category={cat as ListingCategory} />
                    <span>{categoryLabels[cat as ListingCategory]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Apparel Section */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 px-3">Apparel</h4>
            <ul className="space-y-1">
              {categoryGroups.apparel.map(cat => (
                <li key={cat}>
                  <button
                    onClick={() => handleCategoryClick(cat as ListingCategory)}
                    className={cn(
                      "flex items-center space-x-2 w-full text-left px-3 py-2 rounded-md transition-colors text-sm",
                      activeCategory === cat
                        ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    <CategoryIcon category={cat as ListingCategory} />
                    <span>{categoryLabels[cat as ListingCategory]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Other */}
          <div>
            <ul className="space-y-1">
              {categoryGroups.other.map(cat => (
                <li key={cat}>
                  <button
                    onClick={() => handleCategoryClick(cat as ListingCategory)}
                    className={cn(
                      "flex items-center space-x-2 w-full text-left px-3 py-2 rounded-md transition-colors text-sm",
                      activeCategory === cat
                        ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    <CategoryIcon category={cat as ListingCategory} />
                    <span>{categoryLabels[cat as ListingCategory]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Horizontal scrollable version for mobile
  return (
    <div className={cn("", className)}>
      <div className="flex overflow-x-auto pb-2 no-scrollbar">
        <div className="flex space-x-2">
          <button
            onClick={() => handleCategoryClick('all')}
            className={cn(
              "flex flex-col items-center space-y-1 min-w-[80px] px-3 py-2 rounded-md transition-colors",
              activeCategory === 'all'
                ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            <CategoryIcon category="all" />
            <span className="text-xs">All</span>
          </button>

          {/* Map all categories in a flat list */}
          {Object.entries(categoryLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleCategoryClick(key as ListingCategory)}
              className={cn(
                "flex flex-col items-center space-y-1 min-w-[80px] px-3 py-2 rounded-md transition-colors",
                activeCategory === key
                  ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                  : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              <CategoryIcon category={key as ListingCategory} />
              <span className="text-xs whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}