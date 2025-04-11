// src/types/marketplace.ts
import { UserProfile } from './auth';

export type ListingCondition = 'new' | 'like-new' | 'good' | 'fair' | 'poor';

export type ListingCategory = 
  | 'drivers' 
  | 'woods' 
  | 'hybrids' 
  | 'irons' 
  | 'wedges' 
  | 'putters' 
  | 'complete-sets' 
  | 'balls' 
  | 'bags' 
  | 'push-carts'
  | 'accessories' 
  | 'apparel'
  | 'shoes'
  | 'technology'
  | 'other';

export type ListingStatus = 'active' | 'pending' | 'sold' | 'draft';

export type ShippingOption = 'local-pickup' | 'shipping' | 'both';

export interface MarketplaceLocation {
  city: string;
  state?: string;
  country: string;
  zipCode?: string;
}

export interface MarketplaceListing {
  id: string;
  sellerId: string;
  seller?: UserProfile;
  title: string;
  description: string;
  price: number;
  condition: ListingCondition;
  category: ListingCategory;
  brand?: string;
  model?: string;
  images: string[];
  location: MarketplaceLocation;
  createdAt: Date;
  updatedAt?: Date;
  status: ListingStatus;
  featured?: boolean;
  shippingOption: ShippingOption;
  shippingPrice?: number;
  views?: number;
  saves?: number;
  savedBy?: string[];
  negotiable?: boolean;
  yearManufactured?: number;
  dexterity?: 'right' | 'left' | 'universal';
  specifications?: Record<string, string>;
}

export interface ListingFilter {
  category?: ListingCategory | 'all';
  minPrice?: number;
  maxPrice?: number;
  condition?: ListingCondition[];
  location?: string; // For proximity search
  radius?: number; // Miles or km from location
  searchQuery?: string;
  dexterity?: 'right' | 'left' | 'universal';
}

export interface ListingSortOption {
  field: 'price' | 'createdAt' | 'views' | 'condition';
  direction: 'asc' | 'desc';
}

export const conditionLabels: Record<ListingCondition, string> = {
  'new': 'New',
  'like-new': 'Like New',
  'good': 'Good',
  'fair': 'Fair',
  'poor': 'Poor'
};

export const categoryLabels: Record<ListingCategory, string> = {
  'drivers': 'Drivers',
  'woods': 'Fairway Woods',
  'hybrids': 'Hybrids',
  'irons': 'Irons',
  'wedges': 'Wedges',
  'putters': 'Putters',
  'complete-sets': 'Complete Sets',
  'balls': 'Golf Balls',
  'bags': 'Golf Bags',
  'push-carts': 'Push Carts',
  'accessories': 'Accessories',
  'apparel': 'Apparel',
  'shoes': 'Golf Shoes',
  'technology': 'Technology & Gadgets',
  'other': 'Other'
};

// Category icons mapping (material-UI icons or custom SVG names)
export const categoryIcons: Record<ListingCategory, string> = {
  'drivers': 'driver',
  'woods': 'fairway-wood',
  'hybrids': 'hybrid',
  'irons': 'iron-set',
  'wedges': 'wedge',
  'putters': 'putter',
  'complete-sets': 'golf-set',
  'balls': 'golf-ball',
  'bags': 'golf-bag',
  'push-carts': 'push-cart',
  'accessories': 'accessories',
  'apparel': 'shirt',
  'shoes': 'golf-shoe',
  'technology': 'device',
  'other': 'more'
};