/**
 * Firebase Configuration
 * Projeto: anest-ap (mesmo do app legado)
 */
import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDhFmRaMrLxKAlylqEZqXQtp3737ggJsGw",
  authDomain: "anest-ap.firebaseapp.com",
  projectId: "anest-ap",
  storageBucket: "anest-ap.firebasestorage.app",
  messagingSenderId: "899341881349",
  appId: "1:899341881349:web:33f38263f2c4b29f204c6c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Set persistence to LOCAL (survives browser close)
// This ensures the user stays logged in after closing the browser
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error('Error setting auth persistence:', error);
  });

export default app;
