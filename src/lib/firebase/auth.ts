import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    sendPasswordResetEmail,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    User,
    UserCredential,
    onAuthStateChanged
  } from 'firebase/auth';
  import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
  import { auth, db } from './config';
  
  // Register a new user
  export const registerUser = async (
    email: string, 
    password: string, 
    displayName: string
  ): Promise<UserCredential> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { user } = userCredential;
      
      // Update profile with display name
      await updateProfile(user, { displayName });
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName,
        createdAt: serverTimestamp(),
        handicapIndex: null,
        homeCourse: null,
        profileComplete: false,
      });
      
      return userCredential;
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  };
  
  // Sign in user
  export const signIn = async (
    email: string, 
    password: string
  ): Promise<UserCredential> => {
    return signInWithEmailAndPassword(auth, email, password);
  };
  
  // Sign in with Google
  export const signInWithGoogle = async (): Promise<UserCredential> => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    
    // Check if user document exists, create if not
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName,
        createdAt: serverTimestamp(),
        handicapIndex: null,
        homeCourse: null,
        profileComplete: false,
      });
    }
    
    return userCredential;
  };
  
  // Sign out
  export const signOut = async (): Promise<void> => {
    return firebaseSignOut(auth);
  };
  
  // Reset password
  export const resetPassword = async (email: string): Promise<void> => {
    return sendPasswordResetEmail(auth, email);
  };
  
  // Get current user
  export const getCurrentUser = (): User | null => {
    return auth.currentUser;
  };
  
  // Auth state observer
  export const onAuthStateChange = (callback: (user: User | null) => void): () => void => {
    return onAuthStateChanged(auth, callback);
  };