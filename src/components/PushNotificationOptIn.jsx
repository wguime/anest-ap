/**
 * PushNotificationOptIn — Banner LGPD-compliant para ativar push notifications.
 *
 * Sprint 21 Wave 2.2.
 *
 * Regras de exibição:
 *   1. Browser tem que suportar push (isSupported())
 *   2. Notification.permission === 'default' (não pede 2x se já denied)
 *   3. Usuário logado (this is the caller's responsibility — banner is mounted
 *      somewhere protegido, ex. App.jsx pós-auth)
 *   4. Banner não foi dispensado nos últimos 7 dias (localStorage)
 *
 * UX:
 *   - Auto-show 5s após mount (não-bloqueante; user pode ignorar)
 *   - Botão "Ativar notificações" chama requestAndRegister
 *   - X para dispensar (persiste timestamp em localStorage)
 *   - aria-live="polite" para anunciar para screen readers
 *   - Respeita prefers-reduced-motion (Framer Motion)
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, X } from 'lucide-react'
import { Button } from '@/design-system/components/ui'
import { useTheme } from '@/design-system/hooks'
import { cn } from '@/design-system/utils/tokens'
import { usePushPermission } from '@/hooks/usePushPermission'

const DISMISS_KEY = 'anest-push-banner-dismissed'
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias
const AUTO_SHOW_DELAY_MS = 5000

function isDismissedRecently() {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return false
    return Date.now() - ts < DISMISS_TTL_MS
  } catch {
    return false
  }
}

function markDismissed() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* localStorage pode falhar em modo private — silencia */
  }
}

export function PushNotificationOptIn({ className }) {
  const { isDark } = useTheme()
  const { permission, isSupported, requestAndRegister, isLoading } = usePushPermission()
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState(null)

  const eligible = isSupported && permission === 'default' && !isDismissedRecently()

  useEffect(() => {
    if (!eligible) return undefined
    const timer = setTimeout(() => setVisible(true), AUTO_SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [eligible])

  const handleEnable = async () => {
    setError(null)
    const token = await requestAndRegister()
    if (token) {
      setVisible(false)
      // Não persiste dismiss — o user aceitou; banner desaparece via permission flip.
      return
    }
    if (permission === 'denied' || Notification.permission === 'denied') {
      setError('Permissão recusada. Você pode ativar manualmente nas configurações do site.')
      markDismissed()
      setVisible(false)
    } else {
      setError('Não foi possível ativar agora. Tente novamente em instantes.')
    }
  }

  const handleDismiss = () => {
    markDismissed()
    setVisible(false)
  }

  if (!eligible) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-live="polite"
          aria-label="Convite para ativar notificações push"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={cn(
            'fixed bottom-20 left-4 right-4 z-modal sm:left-auto sm:right-6 sm:max-w-sm',
            'rounded-xl border border-border-strong bg-card text-foreground shadow-lg',
            'p-4',
            isDark && 'shadow-black/40',
            className,
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'shrink-0 rounded-lg p-2',
                'bg-category-teal-bg text-category-teal-fg',
              )}
              aria-hidden="true"
            >
              <Bell className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold leading-tight">
                Receber alertas importantes?
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Plantões, prazos de revisão, aprovações e comunicados urgentes
                chegam direto pelo seu dispositivo. Opcional, opt-in pela LGPD.
              </p>

              {error && (
                <p
                  role="alert"
                  className="mt-2 text-xs text-destructive"
                >
                  {error}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleEnable}
                  disabled={isLoading}
                  aria-label="Ativar notificações push"
                >
                  <Bell className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {isLoading ? 'Ativando…' : 'Ativar notificações'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  disabled={isLoading}
                  aria-label="Agora não"
                >
                  <BellOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Agora não
                </Button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              disabled={isLoading}
              className={cn(
                'shrink-0 rounded-full p-1.5 transition-colors',
                'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring',
                'disabled:opacity-50',
              )}
              aria-label="Fechar banner de notificações"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default PushNotificationOptIn
