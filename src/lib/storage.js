/**
 * Storage helpers — Sprint 21 (v5.0.0).
 *
 * Provider-aware utilities to bridge Firebase Storage (legacy) and Supabase
 * Storage (post-Sprint 21). All NEW uploads go to Supabase. Legacy Firebase
 * URLs remain readable until the data migration script back-fills them.
 */
import { ref as fbRef, getDownloadURL, deleteObject as fbDeleteObject } from 'firebase/storage';
import { storage as firebaseStorage } from '../config/firebase';
import { supabase } from '../config/supabase';

/**
 * Detect which storage owns a URL.
 * @param {string|null|undefined} url
 * @returns {'firebase'|'supabase'|null}
 */
export function detectStorageProvider(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com/v0/')) {
    return 'firebase';
  }
  if (url.includes('/storage/v1/object/') || url.includes('.supabase.co/storage/')) {
    return 'supabase';
  }
  return null;
}

/**
 * Extract the (bucket, path) pair from a Supabase Storage URL.
 *
 * Supports both public and signed forms:
 *   - https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *   - https://<ref>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
 *   - https://<ref>.supabase.co/storage/v1/object/authenticated/<bucket>/<path>
 *
 * @param {string} url
 * @returns {{bucket: string, path: string}|null}
 */
export function parseSupabaseStorageUrl(url) {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

/**
 * Get a short-lived signed URL for a Supabase Storage object.
 * @param {string} bucket
 * @param {string} path
 * @param {number} [expiresIn=3600] - seconds
 * @returns {Promise<string>} signed URL
 */
export async function getSignedUrl(bucket, path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Get a public URL (no expiration) for a Supabase Storage object.
 * Only useful for buckets configured as `public`.
 */
export function getPublicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload a file to a Supabase Storage bucket.
 * @param {string} bucket
 * @param {string} path
 * @param {File|Blob} file
 * @param {object} [options]
 * @param {boolean} [options.upsert=false]
 * @param {string} [options.cacheControl='3600']
 * @param {string} [options.contentType]
 * @returns {Promise<{path: string, bucket: string, url: string}>}
 */
export async function uploadToSupabase(bucket, path, file, options = {}) {
  const { upsert = false, cacheControl = '3600', contentType } = options;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert,
    cacheControl,
    contentType: contentType || file.type || undefined,
  });
  if (error) throw error;
  const url = await getSignedUrl(bucket, path, 3600);
  return { path, bucket, url };
}

/**
 * Provider-aware delete. Detects whether `urlOrPath` is a Firebase URL,
 * Supabase URL, or a raw storage path and dispatches accordingly.
 *
 * @param {string} urlOrPath - URL (preferred) or raw storage path
 * @param {object} [opts]
 * @param {string} [opts.firebasePath] - fallback Firebase storage path if URL not parseable
 * @param {string} [opts.supabaseBucket] - fallback bucket if URL not parseable
 * @param {string} [opts.supabasePath] - fallback path if URL not parseable
 * @returns {Promise<{provider: string|null, deleted: boolean}>}
 */
export async function deleteAnyStorageObject(urlOrPath, opts = {}) {
  if (!urlOrPath && !opts.firebasePath && !opts.supabasePath) {
    return { provider: null, deleted: false };
  }
  const provider = urlOrPath ? detectStorageProvider(urlOrPath) : null;

  if (provider === 'supabase' || opts.supabaseBucket) {
    const parsed = urlOrPath && detectStorageProvider(urlOrPath) === 'supabase'
      ? parseSupabaseStorageUrl(urlOrPath)
      : { bucket: opts.supabaseBucket, path: opts.supabasePath };
    if (!parsed?.bucket || !parsed?.path) {
      return { provider: 'supabase', deleted: false };
    }
    const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
    if (error && error.statusCode !== '404' && error.statusCode !== 404) throw error;
    return { provider: 'supabase', deleted: true };
  }

  if (provider === 'firebase' || opts.firebasePath) {
    try {
      const fbPath = opts.firebasePath || urlOrPath;
      const r = fbRef(firebaseStorage, fbPath);
      await fbDeleteObject(r);
      return { provider: 'firebase', deleted: true };
    } catch (err) {
      if (err?.code === 'storage/object-not-found') {
        return { provider: 'firebase', deleted: false };
      }
      throw err;
    }
  }

  return { provider: null, deleted: false };
}

/**
 * Resolve a URL for an object. If `url` is already a Firebase or Supabase
 * URL, returns it as-is (for Supabase signed URLs, returns a fresh one if
 * `bucket` and `path` are provided — older signed URLs may have expired).
 *
 * @param {string|null} url - existing URL (may be expired)
 * @param {object} [opts]
 * @param {string} [opts.bucket] - Supabase bucket for refresh
 * @param {string} [opts.path] - Supabase path for refresh
 * @param {number} [opts.expiresIn=3600]
 * @returns {Promise<string|null>}
 */
export async function resolveUrl(url, opts = {}) {
  if (!url && (!opts.bucket || !opts.path)) return null;
  const provider = detectStorageProvider(url);

  if (opts.bucket && opts.path) {
    return getSignedUrl(opts.bucket, opts.path, opts.expiresIn);
  }

  if (provider === 'firebase') {
    return url;
  }

  if (provider === 'supabase') {
    const parsed = parseSupabaseStorageUrl(url);
    if (parsed) return getSignedUrl(parsed.bucket, parsed.path, opts.expiresIn ?? 3600);
    return url;
  }

  return url;
}

/**
 * Convenience: fetch a Firebase download URL by storagePath.
 * Used by legacy code that still needs Firebase reads during transition.
 */
export async function getFirebaseDownloadUrl(storagePath) {
  const r = fbRef(firebaseStorage, storagePath);
  return getDownloadURL(r);
}

export const STORAGE_BUCKETS = {
  DOCUMENTOS: 'documentos',
  PROFILE_PHOTOS: 'profile-photos',
  REUNIAO_DOCUMENTOS: 'reuniao-documentos',
  REUNIAO_ATAS: 'reuniao-atas',
};
