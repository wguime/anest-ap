// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDhFmRaMrLxKAlylqEZqXQtp3737ggJsGw",
    authDomain: "anest-ap.firebaseapp.com",
    projectId: "anest-ap",
    storageBucket: "anest-ap.firebasestorage.app",
    messagingSenderId: "899341881349",
    appId: "1:899341881349:web:33f38263f2c4b29f204c6c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// CRÍTICO: Expor globalmente para módulos (search, etc)
window.auth = auth;
window.db = db;
window.storage = storage;

console.log('Firebase initialized successfully');

