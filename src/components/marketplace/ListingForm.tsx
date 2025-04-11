// src/components/marketplace/ListingForm.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  MarketplaceListing,
  ListingCategory,
  ListingCondition,
  ShippingOption,
  categoryLabels,
  conditionLabels
} from '@/types/marketplace';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { RadioGroup } from '@/components/ui/Radio';
import { Heading, Text } from '@/components/ui/Typography';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { cn } from '@/lib/utils/cn';

interface ListingFormProps {
  listing?: MarketplaceListing; // For editing, undefined for new listing
  onSubmit: (data: any, images: File[]) => Promise<any>;
  isSubmitting: boolean;
  error?: string | null;
}

export function ListingForm({
  listing,
  onSubmit,
  isSubmitting,
  error
}: ListingFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [title, setTitle] = useState(listing?.title || '');
  const [description, setDescription] = useState(listing?.description || '');
  const [price, setPrice] = useState(listing?.price ? listing.price.toString() : '');
  const [category, setCategory] = useState<ListingCategory>(listing?.category || 'other');
  const [condition, setCondition] = useState<ListingCondition>(listing?.condition || 'good');
  const [brand, setBrand] = useState(listing?.brand || '');
  const [model, setModel] = useState(listing?.model || '');
  const [dexterity, setDexterity] = useState(listing?.dexterity || 'right');
  const [yearManufactured, setYearManufactured] = useState(
    listing?.yearManufactured?.toString() || ''
  );
  const [city, setCity] = useState(listing?.location?.city || '');
  const [state, setState] = useState(listing?.location?.state || '');
  const [country, setCountry] = useState(listing?.location?.country || 'USA');
  const [zipCode, setZipCode] = useState(listing?.location?.zipCode || '');
  const [shippingOption, setShippingOption] = useState<ShippingOption>(
    listing?.shippingOption || 'both'
  );
  const [shippingPrice, setShippingPrice] = useState(
    listing?.shippingPrice ? listing.shippingPrice.toString() : ''
  );
  const [negotiable, setNegotiable] = useState(listing?.negotiable || false);
  
  // Image handling
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(listing?.images || []);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  
  // Validation state
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  // Form and additional fields state
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);
  
  // Specifications handling
  const [specifications, setSpecifications] = useState<Record<string, string>>(
    listing?.specifications || {}
  );
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecValue, setNewSpecValue] = useState('');
  
  // Initialize image previews from existing images
  useEffect(() => {
    if (existingImages.length > 0) {
      setImagePreviewUrls(existingImages);
    }
  }, [existingImages]);
  
  // Generate preview URLs for newly selected images
  useEffect(() => {
    if (images.length > 0) {
      const newPreviews = Array.from(images).map(file => URL.createObjectURL(file));
      
      // Combine with existing images that aren't scheduled for deletion
      const validExistingImages = existingImages.filter(url => !imagesToDelete.includes(url));
      
      setImagePreviewUrls([...validExistingImages, ...newPreviews]);
      
      // Clean up preview URLs on unmount
      return () => {
        newPreviews.forEach(url => URL.revokeObjectURL(url));
      };
    }
  }, [images, existingImages, imagesToDelete]);
  
  // Validate form fields
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!title.trim()) {
      errors.title = 'Title is required';
    } else if (title.length < 5) {
      errors.title = 'Title must be at least 5 characters';
    }
    
    if (!description.trim()) {
      errors.description = 'Description is required';
    } else if (description.length < 10) {
      errors.description = 'Description must be at least 10 characters';
    }
    
    if (!price) {
      errors.price = 'Price is required';
    } else if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      errors.price = 'Please enter a valid price';
    }
    
    if (!city.trim()) {
      errors.city = 'City is required';
    }
    
    if (!country.trim()) {
      errors.country = 'Country is required';
    }
    
    if (shippingOption === 'shipping' || shippingOption === 'both') {
      if (!shippingPrice) {
        errors.shippingPrice = 'Shipping price is required when shipping is offered';
      } else if (isNaN(parseFloat(shippingPrice)) || parseFloat(shippingPrice) < 0) {
        errors.shippingPrice = 'Please enter a valid shipping price';
      }
    }
    
    if (imagePreviewUrls.length === 0) {
      errors.images = 'At least one image is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Check file limits
      if (e.target.files.length + imagePreviewUrls.length - imagesToDelete.length > 10) {
        setFormErrors({
          ...formErrors,
          images: 'Maximum 10 images allowed'
        });
        return;
      }
      
      // Check file sizes (limit to 5MB per file)
      const oversizedFiles = Array.from(e.target.files).filter(file => file.size > 5 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        setFormErrors({
          ...formErrors,
          images: 'Some images exceed the 5MB size limit'
        });
        return;
      }
      
      setImages(prevImages => [...prevImages, ...Array.from(e.target.files!)]);
      
      // Clear any previous image errors
      const { images: _, ...remainingErrors } = formErrors;
      setFormErrors(remainingErrors);
    }
  };
  
  // Handle removing an image
  const handleRemoveImage = (index: number) => {
    // Check if it's an existing image or a new one
    if (index < existingImages.length - imagesToDelete.length) {
      // It's an existing image
      const imageUrl = imagePreviewUrls[index];
      setImagesToDelete(prev => [...prev, imageUrl]);
    } else {
      // It's a new image
      const adjustedIndex = index - (existingImages.length - imagesToDelete.length);
      setImages(prevImages => {
        const newImages = [...prevImages];
        newImages.splice(adjustedIndex, 1);
        return newImages;
      });
    }
    
    // Remove the preview
    setImagePreviewUrls(prevUrls => {
      const newUrls = [...prevUrls];
      newUrls.splice(index, 1);
      return newUrls;
    });
  };
  
  // Handle adding a specification
  const handleAddSpecification = () => {
    if (newSpecKey.trim() && newSpecValue.trim()) {
      setSpecifications({
        ...specifications,
        [newSpecKey]: newSpecValue
      });
      setNewSpecKey('');
      setNewSpecValue('');
    }
  };
  
  // Handle removing a specification
  const handleRemoveSpecification = (key: string) => {
    const { [key]: _, ...rest } = specifications;
    setSpecifications(rest);
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    
    if (!validateForm()) {
      // Scroll to first error
      const firstErrorKey = Object.keys(formErrors)[0];
      const errorElement = document.getElementById(firstErrorKey);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    
    const formData = {
      title,
      description,
      price: parseFloat(price),
      category,
      condition,
      brand: brand || null,  // Changed from undefined to null
      model: model || null,  // Changed from undefined to null
      dexterity,
      yearManufactured: yearManufactured ? parseInt(yearManufactured) : null,  // Changed from undefined to null
      location: {
        city,
        state: state || null,  // Changed from undefined to null
        country,
        zipCode: zipCode || null  // Changed from undefined to null
      },
      shippingOption,
      shippingPrice: shippingPrice ? parseFloat(shippingPrice) : null,  // Changed from undefined to null
      negotiable,
      specifications: Object.keys(specifications).length > 0 ? specifications : null  // Changed from undefined to null
    };
    
    try {
      await onSubmit(formData, images);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information Section */}
      <Card>
        <CardContent className="p-6">
          <Heading level={3} className="text-xl font-bold mb-6">
            Basic Information
          </Heading>
          
          <div className="space-y-4">
            {/* Title */}
            <div>
              <Input
                id="title"
                label="Title *"
                placeholder="e.g., Titleist TS2 10.5° Driver"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={formSubmitted && formErrors.title ? formErrors.title : undefined}
                helper="Be descriptive to help buyers find your item"
              />
            </div>
            
            {/* Price */}
            <div>
              <Input
                id="price"
                label="Price ($) *"
                placeholder="e.g., 199.99"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                error={formSubmitted && formErrors.price ? formErrors.price : undefined}
                leftIcon={
                  <span className="text-gray-500">$</span>
                }
              />
            </div>
            
            <div className="ml-1">
              <Checkbox
                label="Accept offers (mark as negotiable)"
                checked={negotiable}
                onChange={(e) => setNegotiable(e.target.checked)}
              />
            </div>
            
            {/* Category */}
            <div>
              <Select
                id="category"
                label="Category *"
                options={Object.entries(categoryLabels).map(([value, label]) => ({
                  value,
                  label
                }))}
                value={category}
                onChange={(value) => setCategory(value as ListingCategory)}
              />
            </div>
            
            {/* Condition */}
            <div>
              <Select
                id="condition"
                label="Condition *"
                options={Object.entries(conditionLabels).map(([value, label]) => ({
                  value,
                  label
                }))}
                value={condition}
                onChange={(value) => setCondition(value as ListingCondition)}
                helper="Be honest about the condition for best results"
              />
            </div>
            
            {/* Description */}
            <div>
              <Input
                id="description"
                label="Description *"
                placeholder="Describe your item in detail. Include any relevant information about its features, condition, and history."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                error={formSubmitted && formErrors.description ? formErrors.description : undefined}
                multiline
                rows={5}
                helper="Include details like usage history, any defects, features, and why you're selling"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Images Section */}
      <Card>
        <CardContent className="p-6">
          <Heading level={3} className="text-xl font-bold mb-6">
            Images *
          </Heading>
          
          <div className="space-y-4">
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              Add up to 10 photos. First image will be the main image. Each image must be under 5MB.
            </Text>
            
            {/* Image upload */}
            <div 
              className={cn(
                "border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer",
                formSubmitted && formErrors.images 
                  ? "border-red-500 bg-red-50 dark:bg-red-900/10" 
                  : "border-gray-300 hover:border-green-500 bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg
                className="h-12 w-12 text-gray-400 mb-2"
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
              <p className="text-sm font-medium">Click to upload photos</p>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
            
            {formSubmitted && formErrors.images && (
              <p className="text-sm text-red-500">{formErrors.images}</p>
            )}
            
            {/* Image previews */}
            {imagePreviewUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                {imagePreviewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {index === 0 && (
                      <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-2 py-1 rounded">
                        Main
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(index);
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Location Section */}
      <Card>
        <CardContent className="p-6">
          <Heading level={3} className="text-xl font-bold mb-6">
            Location & Shipping
          </Heading>
          
          <div className="space-y-4">
            {/* Location fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  id="city"
                  label="City *"
                  placeholder="e.g., Seattle"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  error={formSubmitted && formErrors.city ? formErrors.city : undefined}
                />
              </div>
              <div>
                <Input
                  id="state"
                  label="State/Province"
                  placeholder="e.g., WA"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>
              <div>
                <Input
                  id="country"
                  label="Country *"
                  placeholder="e.g., USA"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  error={formSubmitted && formErrors.country ? formErrors.country : undefined}
                />
              </div>
              <div>
                <Input
                  id="zipCode"
                  label="Zip/Postal Code"
                  placeholder="e.g., 98101"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                />
              </div>
            </div>
            
            {/* Shipping options */}
            <div className="mt-6">
              <RadioGroup
                name="shippingOption"
                label="Shipping Options *"
                options={[
                  { value: 'local-pickup', label: 'Local Pickup Only' },
                  { value: 'shipping', label: 'Shipping Only' },
                  { value: 'both', label: 'Both Shipping and Local Pickup' }
                ]}
                value={shippingOption}
                onChange={(value) => setShippingOption(value as ShippingOption)}
              />
            </div>
            
            {/* Shipping price (conditional) */}
            {(shippingOption === 'shipping' || shippingOption === 'both') && (
              <div className="mt-4">
                <Input
                  id="shippingPrice"
                  label="Shipping Price ($) *"
                  placeholder="e.g., 15.00"
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingPrice}
                  onChange={(e) => setShippingPrice(e.target.value)}
                  error={formSubmitted && formErrors.shippingPrice ? formErrors.shippingPrice : undefined}
                  leftIcon={
                    <span className="text-gray-500">$</span>
                  }
                  helper="Enter 0 for free shipping"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Additional Information - Togglable */}
      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAdditionalFields(!showAdditionalFields)}
        >
          {showAdditionalFields ? 'Hide Additional Information' : 'Add More Details'}
          <svg
            className={cn(
              "ml-2 h-5 w-5 transform transition-transform",
              showAdditionalFields ? "rotate-180" : ""
            )}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </Button>
      </div>
      
      {/* Additional Information Section */}
      {showAdditionalFields && (
        <Card>
          <CardContent className="p-6">
            <Heading level={3} className="text-xl font-bold mb-6">
              Additional Information
            </Heading>
            
            <div className="space-y-6">
              {/* Brand and Model */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    id="brand"
                    label="Brand"
                    placeholder="e.g., Titleist"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    id="model"
                    label="Model"
                    placeholder="e.g., TS2"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Dexterity and Year */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Select
                    id="dexterity"
                    label="Dexterity"
                    options={[
                      { value: 'right', label: 'Right-handed' },
                      { value: 'left', label: 'Left-handed' },
                      { value: 'universal', label: 'Universal' }
                    ]}
                    value={dexterity}
                    onChange={(value) => setDexterity(value)}
                  />
                </div>
                <div>
                  <Input
                    id="yearManufactured"
                    label="Year Manufactured"
                    placeholder="e.g., 2021"
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    value={yearManufactured}
                    onChange={(e) => setYearManufactured(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Specifications */}
              <div>
                <Heading level={4} className="text-md font-semibold mb-2">
                  Specifications
                </Heading>
                <Text className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Add any additional specifications about your item. For example: Shaft Type, Loft, Length, etc.
                </Text>
                
                {/* Existing specs */}
                {Object.entries(specifications).length > 0 && (
                  <div className="mb-4 space-y-2">
                    {Object.entries(specifications).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        <div>
                          <span className="font-medium">{key}:</span> {value}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSpecification(key)}
                        >
                          <svg className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add new spec */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Specification Name"
                      value={newSpecKey}
                      onChange={(e) => setNewSpecKey(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder="Value"
                      value={newSpecValue}
                      onChange={(e) => setNewSpecValue(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddSpecification}
                    disabled={!newSpecKey.trim() || !newSpecValue.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}
      
      {/* Form actions */}
      <div className="flex justify-between items-center mt-8">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        
        <Button
          type="submit"
          disabled={isSubmitting}
          isLoading={isSubmitting}
        >
          {listing ? 'Update Listing' : 'Publish Listing'}
        </Button>
      </div>
    </form>
  );
}