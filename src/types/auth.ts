import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  coverPhotoURL?: string | null; // Added for cover photo functionality
  createdAt: Date | Timestamp;
  handicapIndex: number | null;
  homeCourse: string | null;
  profileComplete: boolean;
  bio?: string | null;
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
  unreadMessageCount: number;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegistrationData) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}