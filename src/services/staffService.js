/**
 * Staff Service
 * Functions to manage staff schedule data in Firestore
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createFirestoreSubscription } from './firestoreSubscriptionHelper';
import {
  collectLegacyMedicalLeaves,
  hasSensitiveStaffFields,
  sanitizeStaffForPublic,
} from '../lib/staffMedicalLeaves';

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
      const rawStaff = docSnap.data();
      return {
        staff: sanitizeStaffForPublic(rawStaff),
        error: null,
      };
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
    if (hasSensitiveStaffFields(staffData)) {
      return {
        success: false,
        error: 'Atestados devem ser salvos pelo fluxo privado de afastamentos.',
      };
    }
    const docRef = doc(db, COLLECTION, 'schedule');
    const publicStaff = sanitizeStaffForPublic(staffData);
    publicStaff.revision = Number.isInteger(publicStaff.revision) ? publicStaff.revision + 1 : 1;
    await setDoc(docRef, {
      ...publicStaff,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    return { success: true, error: null, staff: publicStaff };
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
          const rawStaff = docSnap.data();
          callback({
            staff: sanitizeStaffForPublic(rawStaff),
            error: null,
          });
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
 * Leitura transitória usada somente pelo fluxo privado de migração.
 * Remover após staff/schedule não conter mais a chave legada `atestado`.
 */
export async function getLegacyStaffMedicalLeaves() {
  try {
    const docSnap = await getDoc(doc(db, COLLECTION, 'schedule'));
    return {
      leaves: docSnap.exists() ? collectLegacyMedicalLeaves(docSnap.data()) : [],
      error: null,
    };
  } catch (error) {
    return { leaves: [], error: error.message };
  }
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
      const publicStaff = sanitizeStaffForPublic(mockStaff);
      publicStaff.revision = 1;
      await setDoc(docRef, {
        ...publicStaff,
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
