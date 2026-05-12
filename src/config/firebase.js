/**
 * Firebase Configuration
 * Projeto: anest-ap (mesmo do app legado)
 */
import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
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

// Sprint 14d: Firestore com persistência local (IndexedDB) habilitada.
// Permite que writes/reads funcionem offline e sincronizem ao reconectar.
// `persistentMultipleTabManager` coordena várias abas do mesmo browser.
// `initializeFirestore` precisa ser chamado UMA ÚNICA VEZ antes de qualquer
// outro acesso ao Firestore — daí o try/catch idempotente com fallback para
// getFirestore quando o cache não pode ser inicializado.
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (error) {
  // `failed-precondition`: multi-tab sem suporte / já inicializado em outra parte
  // `unimplemented`: browser sem IndexedDB (Safari private, etc.)
  // Em qualquer caso, degradamos para o Firestore in-memory padrão.
  console.warn(
    '[firebase] persistência local indisponível, usando cache in-memory:',
    error?.code || error?.message || error
  );
  firestoreInstance = getFirestore(app);
}
export const db = firestoreInstance;
export const storage = getStorage(app);

// Set persistence to LOCAL (survives browser close)
// This ensures the user stays logged in after closing the browser
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error('Error setting auth persistence:', error);
  });

export default app;
