import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

const SW_CHECK_INTERVAL = 60 * 60 * 1000 // 60 minutes

export function ReloadPrompt() {
  const [dismissed, setDismissed] = useState(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      if (r) {
        // Check for SW updates periodically
        setInterval(() => r.update(), SW_CHECK_INTERVAL)

        // Check on tab focus
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') r.update()
        })
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error)
    },
  })

  if (!needRefresh || dismissed) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: '0.75rem',
        background: '#006837',
        color: '#fff',
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        fontFamily: 'inherit',
        fontSize: '0.9rem',
        animation: 'toast-slide-up 0.3s ease-out',
        maxWidth: '32rem',
        margin: '0 auto',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <RefreshCw size={18} />
        Nova versão disponível
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <button
          onClick={async () => {
            try { updateServiceWorker(true) } catch {}
            // Clear all SW caches so reload fetches fresh content
            try {
              const keys = await caches.keys()
              await Promise.all(keys.map(k => caches.delete(k)))
            } catch {}
            window.location.reload()
          }}
          style={{
            background: '#2ECC71',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.4rem 0.85rem',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          Atualizar
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Fechar"
          style={{
            background: 'transparent',
            color: '#fff',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '0.2rem',
            lineHeight: 1,
            opacity: 0.8,
          }}
        >
          ✕
        </button>
      </span>

      <style>{`
        @keyframes toast-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
