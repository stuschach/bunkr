// src/types/auth.ts
export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL?: string | null;
    createdAt: Date;
    handicapIndex: number | null;
    homeCourse: string | null;
    profileComplete: boolean;
    bio?: string;
    location?: string;
    favoriteClubs?: string[];
    phoneNumber?: string | null;
  }
  
  export interface LoginCredentials {
    email: string;
    password: string;
  }
  
  export interface RegistrationData {
    email: string;
    password: string;
    displayName: string;
  }
  
  export interface ResetPasswordData {
    email: string;
  }
  
  export interface UpdatePasswordData {
    currentPassword: string;
    newPassword: string;
  }
  
  export interface UpdateProfileData {
    displayName?: string;
    bio?: string;
    location?: string;
    favoriteClubs?: string[];
    handicapIndex?: number;
    homeCourse?: string;
  }
  
  // This is the interface for the AuthContext
  export interface AuthContextType {
    user: UserProfile | null;
    loading: boolean;
    error: string | null;
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (data: RegistrationData) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
  }