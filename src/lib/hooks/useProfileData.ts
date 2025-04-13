// src/lib/hooks/useProfileData.ts
import { useState, useCallback } from 'react';
import { UserProfile } from '@/types/auth';

export function useProfileData() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  const loadProfile = useCallback(async (profileData: UserProfile): Promise<UserProfile> => {
    setProfile(profileData);
    return profileData;
  }, []);
  
  return { profile, loadProfile };
}