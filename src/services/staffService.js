/**
 * Staff Service
 * Functions to manage staff schedule data in Firestore
 */
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createFirestoreSubscription } from './firestoreSubscriptionHelper';

// Base collection
const COLLECTION = 'staff';

/**
 * Get staff schedule data
 * @returns {Promise<{staff: Object|null, error: string|null}>}
 */
export async function getStaff() {
  try {
    const docRef = doc(db, COLLECTION, 'schedule');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { staff: docSnap.data(), error: null };
    }
    // Document does not exist, return null (will use mock as fallback)
    return { staff: null, error: null };
  } catch (error) {
    console.error('Error fetching staff schedule:', error);
    return { staff: null, error: error.message };
  }
}

/**
 * Update staff schedule data
 * @param {Object} staffData - Staff schedule data {hospitais, consultorio}
 * @param {string} userId - ID of the user making the update
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function updateStaff(staffData, userId) {
  try {
    const docRef = doc(db, COLLECTION, 'schedule');
    await setDoc(docRef, {
      ...staffData,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating staff schedule:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Subscribe to real-time updates of staff schedule data
 * @param {Function} callback - Callback receiving {staff: Object|null, error: string|null}
 * @param {Object} [options] - Options including onStatusChange callback
 * @param {Function} [options.onStatusChange] - Called with 'connected' | 'reconnecting' | 'error'
 * @returns {Function} Unsubscribe/cleanup function
 */
export function subscribeStaff(callback, options = {}) {
  const docRef = doc(db, COLLECTION, 'schedule');
  const { cleanup } = createFirestoreSubscription(
    docRef,
    {
      onData: (docSnap) => {
        if (docSnap.exists()) {
          callback({ staff: docSnap.data(), error: null });
        } else {
          callback({ staff: null, error: null });
        }
      },
      onError: (error) => {
        console.error('Error in staff listener:', error);
        callback({ staff: null, error: error.message });
      },
    },
    { onStatusChange: options.onStatusChange }
  );
  return cleanup;
}

/**
 * Initialize staff data with default values (if they don't exist)
 * @param {Object} mockStaff - Mock staff data
 * @param {string} userId - ID of the user
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function initializeStaffData(mockStaff, userId) {
  try {
    const docRef = doc(db, COLLECTION, 'schedule');
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      await setDoc(docRef, {
        ...mockStaff,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error initializing staff data:', error);
    return { success: false, error: error.message };
  }
}
