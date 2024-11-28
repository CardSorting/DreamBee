import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  DocumentData,
  Firestore
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
let app: FirebaseApp | undefined;
let analytics: Analytics | undefined;
let db: Firestore | undefined;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    
    // Initialize Analytics only on client side
    if (typeof window !== 'undefined') {
      analytics = getAnalytics(app);
    }
  } else {
    app = getApps()[0];
    db = getFirestore(app);
  }
} catch (error) {
  console.error('Error initializing Firebase:', error);
  // Don't throw error here, let the app continue without Firebase
}

// Firestore utility functions
export async function createOrUpdateUser(clerkUserId: string, userData: DocumentData) {
  if (!db) {
    console.error('Firestore not initialized');
    return false;
  }

  try {
    const userRef = doc(db, 'users', clerkUserId);
    await setDoc(userRef, {
      ...userData,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return false;
  }
}

export async function getUserData(clerkUserId: string) {
  if (!db) {
    console.error('Firestore not initialized');
    return null;
  }

  try {
    const userRef = doc(db, 'users', clerkUserId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
}

export { app, analytics, db };
