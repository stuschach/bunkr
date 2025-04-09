// src/types/auth.ts
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Date | any; // Firebase Timestamp or Date
  handicapIndex: number | null;
  homeCourse: string | null;
  bio?: string;
  location?: string;
  website?: string;
  equipment?: string;
  favoriteCoursesIds?: string[];
  profileComplete: boolean;
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