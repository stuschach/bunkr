import { 
    ref, 
    uploadBytes, 
    getDownloadURL, 
    deleteObject,
    listAll,
    UploadMetadata 
  } from 'firebase/storage';
  import { storage } from './config';
  
  // Upload a file
  export const uploadFile = async (
    path: string, 
    file: File | Blob, 
    metadata?: UploadMetadata
  ): Promise<string> => {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, metadata);
      return getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };
  
  // Get download URL for a file
  export const getFileUrl = async (path: string): Promise<string> => {
    try {
      const storageRef = ref(storage, path);
      return getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error getting file URL:', error);
      throw error;
    }
  };
  
  // Delete a file
  export const deleteFile = async (path: string): Promise<void> => {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  };
  
  // Delete multiple files by prefix (folder)
  export const deleteFiles = async (prefix: string): Promise<void> => {
    try {
      const folderRef = ref(storage, prefix);
      const fileList = await listAll(folderRef);
      
      const deletePromises = fileList.items.map(itemRef => deleteObject(itemRef));
      await Promise.all(deletePromises);
      
      // Recursively delete sub-folders
      const folderPromises = fileList.prefixes.map(prefixRef => 
        deleteFiles(prefixRef.fullPath)
      );
      await Promise.all(folderPromises);
    } catch (error) {
      console.error('Error deleting files:', error);
      throw error;
    }
  };
  
  // Generate a unique file path
  export const generateFilePath = (
    userId: string, 
    folder: string, 
    fileName: string
  ): string => {
    const timestamp = new Date().getTime();
    const randomString = Math.random().toString(36).substring(2, 10);
    const extension = fileName.split('.').pop();
    
    return `users/${userId}/${folder}/${timestamp}-${randomString}.${extension}`;
  };