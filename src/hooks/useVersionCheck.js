import { useState, useEffect, useCallback } from 'react'

const CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  const check = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const { v } = await res.json()
      if (v && v !== __APP_VERSION__) {
        setUpdateAvailable(true)
      }
    } catch {
      // network error — skip silently
    }
  }, [])

  useEffect(() => {
    // Check on mount
    check()

    // Check every 5 minutes
    const id = setInterval(check, CHECK_INTERVAL)

    // Check when tab regains focus
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [check])

  return { updateAvailable }
}
