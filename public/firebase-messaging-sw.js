/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging — Service Worker dedicado para push notifications.
 *
 * Sprint 21 Wave 2.2.
 *
 * Por que um SW separado do Workbox sw.js do VitePWA?
 *   1. Workbox gera o seu sw.js a partir do build (precache + runtimeCaching);
 *      adicionar imports do firebase/messaging quebraria o tooling.
 *   2. O FCM SW precisa ser servido na raiz com nome canônico
 *      `/firebase-messaging-sw.js` para que `firebase.messaging()` no main
 *      thread o descubra automaticamente.
 *   3. Ambos sw's coexistem — escopos não conflitam (Workbox controla rotas
 *      do app; este aqui é dedicado a `firebase-messaging.googleapis.com`).
 *
 * NOTA SOBRE CHAVES PÚBLICAS:
 * Os valores abaixo são os campos *públicos* do firebaseConfig (apiKey web,
 * projectId, etc) — mesmo padrão que o `src/config/firebase.js` já expõe no
 * bundle do cliente. Não são secrets. Atualizar manualmente se trocar de
 * projeto Firebase (ou adicionar plugin Vite que faça template-replace).
 */

importScripts('https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.7.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyDhFmRaMrLxKAlylqEZqXQtp3737ggJsGw',
  authDomain: 'anest-ap.firebaseapp.com',
  projectId: 'anest-ap',
  storageBucket: 'anest-ap.firebasestorage.app',
  messagingSenderId: '899341881349',
  appId: '1:899341881349:web:33f38263f2c4b29f204c6c',
})

const messaging = firebase.messaging()

// Background handler — chamado quando o app NÃO está em foreground.
// Em foreground, o handler é o `onForegroundMessage` no main thread.
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {}
  if (!title) return

  const options = {
    body: body || '',
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: payload.data || {},
    // Ao tocar, abre uma janela existente do app (ou nova) na URL do payload.
    // Tag agrupa pushes do mesmo tipo (evita spam ao receber em rajada).
    tag: payload.data?.tag || 'anest-default',
    renotify: false,
  }

  self.registration.showNotification(title, options)
})

// Click handler — leva o usuário ao deep-link enviado no payload.data.url
// ou à home se nada veio. Foco em janela existente quando possível, senão
// abre uma nova aba.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        // Se já tem aba do app aberta, foca nela e navega para o destino.
        if ('focus' in client && client.url.includes(self.location.origin)) {
          await client.focus()
          if ('navigate' in client) {
            try { await client.navigate(targetUrl) } catch (_) { /* fallback abaixo */ }
          }
          return
        }
      }
      // Sem janela aberta — abre nova.
      if (clients.openWindow) {
        await clients.openWindow(targetUrl)
      }
    })()
  )
})
