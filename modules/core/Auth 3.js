/**
 * Auth Module
 * Handles Firebase Authentication and user state.
 */

let currentUser = null;
let userProfile = null;

export function initAuth() {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            console.log('👤 User logged in:', user.email);
            currentUser = user;
            await loadUserProfile(); // Load profile on auth state change
            document.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
            // Redirect to dashboard if on login page
            if (window.location.hash === '#/login' || window.location.hash === '') {
                window.location.hash = '#/dashboard';
            }
        } else {
            console.log('👋 User logged out');
            currentUser = null;
            userProfile = null;
            document.dispatchEvent(new CustomEvent('auth:logout'));
            window.location.hash = '#/login';
        }
    });
}

export function getCurrentUser() {
    return currentUser;
}

export function getUserProfile() {
    return userProfile;
}

async function loadUserProfile() {
    try {
        if (!currentUser) return;

        const db = firebase.firestore();
        const doc = await db.collection('userProfiles').doc(currentUser.uid).get();

        if (doc.exists) {
            userProfile = { ...doc.data(), uid: currentUser.uid };
        } else {
            // Create default profile if not exists
            const createdAt = firebase.firestore.FieldValue.serverTimestamp();
            userProfile = {
                uid: currentUser.uid,
                email: currentUser.email,
                firstName: currentUser.displayName?.split(' ')[0] || '',
                lastName: currentUser.displayName?.split(' ').slice(1).join(' ') || '',
                createdAt: createdAt,
                progress: {}
            };
            await db.collection('userProfiles').doc(currentUser.uid).set(userProfile);
        }
        console.log('👤 Profile loaded:', userProfile);
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

export async function login(email, password) {
    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

export async function logout() {
    try {
        await firebase.auth().signOut();
    } catch (error) {
        console.error('Logout error:', error);
    }
}
