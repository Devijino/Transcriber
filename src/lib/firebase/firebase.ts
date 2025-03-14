import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Use demo keys if environment variables are not defined
// Use this only in development environment
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDemoKeyForDevelopmentOnly-DkdXtM", 
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:a1b2c3d4e5f6a7b8c9d0e1",
};

// Display key status in log for debugging (without sensitive keys)
console.log("Firebase initialization with config:", { 
  usingEnvVars: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: firebaseConfig.projectId
});

// Check whether to use Firebase or mock mode
const useFirebaseMock = !process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_USE_FIREBASE_MOCK === 'true';

// Prepare variables for export
let app: any;
let auth: any;
let db: any;
let storage: any;

// If we're in mock mode, create a mock version of Firebase
if (useFirebaseMock) {
  console.log("Using Firebase mock mode. Firebase services will be simulated.");
  
  // Mock objects for local use
  app = { name: 'mock-app' };
  auth = { 
    currentUser: null,
    onAuthStateChanged: (callback: (user: null) => void) => {
      callback(null);
      return () => {};
    },
    signInWithEmailAndPassword: () => Promise.resolve({ user: null }),
    signOut: () => Promise.resolve(),
  };
  db = {};
  storage = {};
} else {
  // Initialize Firebase normally if there are valid keys
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

// Export variables
export { app, auth, db, storage };
