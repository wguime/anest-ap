/**
 * firestoreSubscriptionHelper - Reliable Firestore onSnapshot subscriptions
 * with automatic retry/reconnection and exponential backoff.
 *
 * Similar pattern to createReliableSubscription (Supabase) but for Firestore.
 */
import { onSnapshot } from 'firebase/firestore';

const DEFAULT_OPTIONS = {
  maxRetries: 20,
  initialDelayMs: 2000,
  maxDelayMs: 30000,
  onStatusChange: null,
};

/**
 * Creates a Firestore onSnapshot subscription with retry/reconnection logic.
 *
 * @param {import('firebase/firestore').DocumentReference|import('firebase/firestore').Query} docRef
 *   Firestore document or query reference to subscribe to
 * @param {Object} callbacks
 * @param {Function} callbacks.onData - Called with the snapshot on each update
 * @param {Function} [callbacks.onError] - Called on snapshot error (before retry)
 * @param {Object} [options] - Override default options
 * @param {number} [options.maxRetries=Infinity] - Maximum number of retry attempts
 * @param {number} [options.initialDelayMs=2000] - Initial backoff delay in ms
 * @param {number} [options.maxDelayMs=30000] - Maximum backoff delay in ms
 * @param {Function} [options.onStatusChange] - Called with 'connected' | 'reconnecting' | 'error'
 * @returns {{ cleanup: Function }} - Call cleanup() to tear down the subscription
 */
export function createFirestoreSubscription(docRef, callbacks, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let unsubscribe = null;
  let retryCount = 0;
  let retryTimer = null;
  let destroyed = false;

  function getBackoffDelay() {
    return Math.min(opts.initialDelayMs * Math.pow(2, retryCount), opts.maxDelayMs);
  }

  function subscribe() {
    if (destroyed) return;

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (destroyed) return;
        if (retryCount > 0) {
          retryCount = 0;
        }
        if (opts.onStatusChange) opts.onStatusChange('connected');
        callbacks.onData(snapshot);
      },
      (error) => {
        if (destroyed) return;
        console.warn('[FirestoreSubscription] Error:', error.message);
        if (opts.onStatusChange) opts.onStatusChange('error');
        if (callbacks.onError) callbacks.onError(error);
        scheduleRetry();
      }
    );
  }

  function scheduleRetry() {
    if (destroyed || retryCount >= opts.maxRetries) return;
    const delay = getBackoffDelay();
    retryCount++;
    if (opts.onStatusChange) opts.onStatusChange('reconnecting');
    retryTimer = setTimeout(() => {
      if (!destroyed) subscribe();
    }, delay);
  }

  function cleanup() {
    destroyed = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  // Start initial subscription
  subscribe();

  return { cleanup };
}

export default createFirestoreSubscription;
