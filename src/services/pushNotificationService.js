/**
 * Push Notification Service — Web Push via Firebase Cloud Messaging (FCM)
 *
 * Sprint 21 Wave 2.2.
 *
 * Mantém em par com o notificationService.js (in-app via Supabase `notifications`).
 * Este módulo cuida APENAS do canal push do browser/PWA:
 *   1. requestPermission()         — pede consentimento explícito ao usuário
 *   2. getFcmToken()               — registra o device token no Firestore
 *   3. onForegroundMessage(cb)     — exibe payload com o app aberto
 *   4. unsubscribe()               — revoga token + limpa Firestore
 *   5. isSupported()               — feature detection
 *
 * LGPD: consentimento explícito opt-in, token armazenado em
 * userProfiles/{uid}.fcmToken (apenas o token, sem PII). Usuário pode
 * desativar a qualquer momento via unsubscribe() (direito de oposição).
 *
 * Performance: o SDK `firebase/messaging` é importado dinamicamente para
 * que o chunk só carregue quando o usuário opta por ativar push — não
 * impacta o LCP nem o initial bundle.
 *
 * Service Worker: este service depende de `/firebase-messaging-sw.js`
 * estar registrado no escopo raiz para receber pushes em background.
 * O VitePWA registra o sw.js do Workbox no mesmo escopo, mas o FCM
 * roda em um sw dedicado (Firebase abre/registra automaticamente).
 */
import { auth, db } from '../config/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'

const FIRESTORE_FIELD = 'fcmToken'
const FIRESTORE_FIELD_UPDATED = 'fcmTokenUpdatedAt'

/**
 * Feature detection — true apenas em browsers que suportam Service Worker +
 * Notification API + Push API. Falsy em Safari < 16.4 iOS PWA fora da home,
 * Firefox Android sem Google services, etc.
 */
export function isSupported() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return (
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window
  )
}

/**
 * Solicita permissão de notificação ao usuário.
 *
 * Retorna o estado final de `Notification.permission`:
 *   - 'granted'   — usuário aceitou
 *   - 'denied'    — usuário recusou
 *   - 'default'   — usuário fechou o prompt sem decidir
 *
 * Idempotente: se já está granted/denied, retorna o estado atual sem
 * disparar prompt novamente (browsers nem permitem repetir o prompt
 * após denied).
 */
export async function requestPermission() {
  if (!isSupported()) return 'denied'
  if (Notification.permission !== 'default') {
    return Notification.permission
  }
  try {
    const result = await Notification.requestPermission()
    return result
  } catch (err) {
    console.warn('[pushNotificationService] requestPermission falhou:', err?.message || err)
    return 'denied'
  }
}

/**
 * Obtém (ou refresca) o FCM device token e persiste em userProfiles/{uid}.
 *
 * Requer:
 *   - User autenticado (auth.currentUser)
 *   - Permissão de notificação granted
 *   - VITE_FIREBASE_VAPID_KEY configurada
 *
 * Retorna o token (string) em sucesso, null em qualquer falha.
 * Falhas são logadas mas não lançam — push é opt-in best-effort.
 */
export async function getFcmToken() {
  if (!isSupported()) return null
  if (Notification.permission !== 'granted') return null

  const user = auth.currentUser
  if (!user) {
    console.warn('[pushNotificationService] getFcmToken: sem usuário autenticado')
    return null
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    console.warn(
      '[pushNotificationService] VITE_FIREBASE_VAPID_KEY ausente — push desabilitado. ' +
      'Configure em .env.local (Firebase Console > Cloud Messaging > Web Push certificates).'
    )
    return null
  }

  try {
    const { getMessaging, getToken } = await import('firebase/messaging')
    const messaging = getMessaging()
    const token = await getToken(messaging, { vapidKey })
    if (!token) {
      console.warn('[pushNotificationService] getToken retornou vazio')
      return null
    }

    // Persiste no Firestore para que edge functions possam endereçar pushes
    // a este user. Apenas o token + timestamp (sem PII adicional).
    try {
      await updateDoc(doc(db, 'userProfiles', user.uid), {
        [FIRESTORE_FIELD]: token,
        [FIRESTORE_FIELD_UPDATED]: serverTimestamp(),
      })
    } catch (writeErr) {
      // Falha ao persistir não invalida o token em si — caller decide se quer
      // tentar novamente. Apenas loga.
      console.warn(
        '[pushNotificationService] falha ao persistir fcmToken:',
        writeErr?.message || writeErr,
      )
    }

    return token
  } catch (err) {
    console.error('[pushNotificationService] getFcmToken falhou:', err?.message || err)
    return null
  }
}

/**
 * Registra callback para mensagens recebidas com o app em foreground.
 *
 * Em background, o `firebase-messaging-sw.js` lida diretamente e exibe a
 * notificação nativa do SO. Em foreground, o browser NÃO mostra o banner
 * — cabe ao app decidir (toast, badge, modal, ignorar).
 *
 * Retorna função de unsubscribe. Se push não é suportado, retorna noop.
 */
export async function onForegroundMessage(callback) {
  if (!isSupported() || typeof callback !== 'function') {
    return () => {}
  }
  try {
    const { getMessaging, onMessage } = await import('firebase/messaging')
    const messaging = getMessaging()
    return onMessage(messaging, callback)
  } catch (err) {
    console.warn('[pushNotificationService] onForegroundMessage falhou:', err?.message || err)
    return () => {}
  }
}

/**
 * Revoga o token FCM (deleteToken) e limpa o campo no Firestore.
 *
 * LGPD: este é o caminho do direito de oposição. Após chamar, o user
 * deixa de receber pushes mesmo se a permissão do browser continuar
 * granted (precisa chamar getFcmToken() de novo para reativar).
 */
export async function unsubscribe() {
  if (!isSupported()) return false
  const user = auth.currentUser
  try {
    const { getMessaging, deleteToken } = await import('firebase/messaging')
    const messaging = getMessaging()
    await deleteToken(messaging)
    if (user) {
      try {
        await updateDoc(doc(db, 'userProfiles', user.uid), {
          [FIRESTORE_FIELD]: null,
          [FIRESTORE_FIELD_UPDATED]: serverTimestamp(),
        })
      } catch (writeErr) {
        console.warn(
          '[pushNotificationService] falha ao limpar fcmToken Firestore:',
          writeErr?.message || writeErr,
        )
      }
    }
    return true
  } catch (err) {
    console.error('[pushNotificationService] unsubscribe falhou:', err?.message || err)
    return false
  }
}

export default {
  isSupported,
  requestPermission,
  getFcmToken,
  onForegroundMessage,
  unsubscribe,
}
