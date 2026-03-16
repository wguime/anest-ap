import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Wifi, X } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export function NetworkStatusBanner() {
  const { isOnline, isSlow } = useNetworkStatus()
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed when status changes
  useEffect(() => {
    setDismissed(false)
  }, [isOnline, isSlow])

  // Auto-dismiss slow banner after 10s
  useEffect(() => {
    if (isSlow && isOnline) {
      const timer = setTimeout(() => setDismissed(true), 10000)
      return () => clearTimeout(timer)
    }
  }, [isSlow, isOnline])

  const showOffline = !isOnline && !dismissed
  const showSlow = isOnline && isSlow && !dismissed

  if (!showOffline && !showSlow) return null

  return (
    <AnimatePresence>
      {(showOffline || showSlow) && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`fixed top-0 left-0 right-0 z-[10000] px-4 py-2.5 flex items-center justify-between gap-3 text-sm font-medium shadow-lg ${
            showOffline
              ? 'bg-red-600 text-white'
              : 'bg-amber-500 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-2">
            {showOffline ? <WifiOff className="h-4 w-4 shrink-0" /> : <Wifi className="h-4 w-4 shrink-0" />}
            <span>
              {showOffline
                ? 'Sem conexao — dados podem estar desatualizados'
                : 'Conexao lenta — carregamento pode demorar'}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
