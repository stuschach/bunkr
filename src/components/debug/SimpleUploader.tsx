// src/components/debug/SimpleUploader.tsx
'use client';

import React, { useState, useRef } from 'react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { Button } from '@/components/ui/Button';

export function SimpleUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const [downloadURL, setDownloadURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      console.log("Starting upload process...");
      setIsUploading(true);
      setError(null);

      // Create a reference to the storage location
      const storageRef = ref(storage, `test-uploads/${Date.now()}-${file.name}`);
      console.log("Storage reference created:", storageRef.fullPath);

      // Upload the file
      console.log("Uploading file:", file.name, file.size, "bytes");
      const snapshot = await uploadBytes(storageRef, file);
      console.log("Upload completed:", snapshot);

      // Get download URL
      console.log("Getting download URL...");
      const url = await getDownloadURL(snapshot.ref);
      console.log("Download URL:", url);
      
      setDownloadURL(url);
      alert("Upload successful!");
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      alert("Upload failed. Check console for details.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-bold mb-4">Debug Uploader</h2>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        accept="image/*"
        className="mb-4"
      />
      
      <div className="mb-4">
        <Button 
          onClick={() => fileInputRef.current?.click()}
          isLoading={isUploading}
          disabled={isUploading}
        >
          Select File to Upload
        </Button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {downloadURL && (
        <div className="mb-4">
          <p className="mb-2 font-semibold">Upload successful:</p>
          <img 
            src={downloadURL} 
            alt="Uploaded file" 
            className="max-w-full h-auto max-h-40 border rounded-md" 
          />
          <p className="mt-2 text-sm break-all">{downloadURL}</p>
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-500">
        <p>Check the browser console for detailed logs</p>
      </div>
    </div>
  );
}