/**
 * Biometric Authentication Service
 *
 * Usa WebAuthn (FIDO2) para autenticacao biometrica (Face ID, Touch ID, Windows Hello).
 *
 * Fluxo:
 * 1. Apos login com email/senha, o usuario pode registrar biometria
 * 2. As credenciais ficam salvas no dispositivo + metadata no localStorage
 * 3. Na proxima vez, o usuario pode autenticar via biometria sem digitar senha
 * 4. A biometria desbloqueia as credenciais salvas, que fazem login no Firebase
 */

const STORAGE_KEY = 'anest_biometric';

// ─── Crypto constants ────────────────────────────────────────────────────────

const LEGACY_SALT = new TextEncoder().encode('anest-biometric-salt');
const LEGACY_ITERATIONS = 100000;
const V2_ITERATIONS = 600000;
const SALT_BYTES = 32;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function getSavedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Verifica se o dispositivo suporta autenticacao biometrica (WebAuthn)
 */
export async function isBiometricAvailable() {
  if (!window.PublicKeyCredential) return false;
  try {
    // Checa se autenticador de plataforma (Touch ID, Face ID, etc.) esta disponivel
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Verifica se o usuario ja tem biometria registrada neste dispositivo
 */
export function hasBiometricRegistered() {
  const data = getSavedData();
  return !!(data && data.credentialId && data.email);
}

/**
 * Retorna o email associado a biometria registrada
 */
export function getBiometricEmail() {
  const data = getSavedData();
  return data?.email || null;
}

/**
 * Registra biometria para o usuario apos login bem-sucedido.
 * Salva credencial WebAuthn + email cifrado no localStorage.
 *
 * @param {string} email - Email do usuario (usado como identificador)
 * @param {string} password - Senha (sera cifrada e salva localmente)
 * @returns {{ success: boolean, error?: string }}
 */
export async function registerBiometric(email, password) {
  try {
    const available = await isBiometricAvailable();
    if (!available) {
      return { success: false, error: 'Dispositivo não suporta autenticação biométrica' };
    }

    // Gerar challenge aleatorio (em producao viria do servidor)
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const publicKeyOptions = {
      challenge,
      rp: {
        name: 'ANEST',
        id: window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(email),
        name: email,
        displayName: email.split('@')[0],
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Biometria do dispositivo (nao chave USB)
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyOptions,
    });

    // Cifrar senha com chave derivada do credentialId (v2 — salt aleatorio)
    const encryptedPassword = await encryptPassword(password, credential.rawId);

    // Salvar no localStorage
    saveData({
      credentialId: bufferToBase64(credential.rawId),
      email,
      encryptedPassword,
      registeredAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Autenticação biométrica foi cancelada' };
    }
    console.error('Erro ao registrar biometria:', err);
    return { success: false, error: 'Erro ao registrar biometria' };
  }
}

/**
 * Autentica via biometria e retorna email + senha para login no Firebase.
 *
 * @returns {{ success: boolean, email?: string, password?: string, error?: string }}
 */
export async function authenticateWithBiometric() {
  try {
    const data = getSavedData();
    if (!data || !data.credentialId) {
      return { success: false, error: 'Nenhuma biometria registrada neste dispositivo' };
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertionOptions = {
      challenge,
      allowCredentials: [{
        id: base64ToBuffer(data.credentialId),
        type: 'public-key',
        transports: ['internal'],
      }],
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = await navigator.credentials.get({
      publicKey: assertionOptions,
    });

    // Biometria verificada — decifrar senha
    const password = await decryptPassword(data.encryptedPassword, assertion.rawId);

    // Upgrade transparente: se dados legacy (v1), re-encriptar com v2
    if (!data.encryptedPassword.v || data.encryptedPassword.v < 2) {
      try {
        const upgraded = await encryptPassword(password, assertion.rawId);
        saveData({ ...data, encryptedPassword: upgraded });
      } catch {
        // Falha no upgrade nao bloqueia login
      }
    }

    return { success: true, email: data.email, password };
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Autenticação biométrica foi cancelada' };
    }
    console.error('Erro na autenticação biométrica:', err);
    return { success: false, error: 'Erro na autenticação biométrica' };
  }
}

/**
 * Remove biometria registrada
 */
export function removeBiometric() {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Encryption helpers ──────────────────────────────────────────────────────
// Usa AES-GCM com chave derivada do credentialId via PBKDF2

async function deriveKey(rawId, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(rawId),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptPassword(password, rawId) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(rawId, salt, V2_ITERATIONS);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(password);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    v: 2,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    data: bufferToBase64(ciphertext),
  };
}

async function decryptPassword(encrypted, rawId) {
  // Detectar versao: v1 (legacy) nao tem campo 'v' nem 'salt'
  const isLegacy = !encrypted.v || encrypted.v < 2;
  const salt = isLegacy ? LEGACY_SALT : new Uint8Array(base64ToBuffer(encrypted.salt));
  const iterations = isLegacy ? LEGACY_ITERATIONS : V2_ITERATIONS;

  const key = await deriveKey(rawId, salt, iterations);
  const iv = base64ToBuffer(encrypted.iv);
  const data = base64ToBuffer(encrypted.data);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}
