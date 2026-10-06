'use client'

import { useEffect } from 'react'

/** Marks the session as the Android accountant shell (fullscreen chrome). */
export function NativeAppBootstrap() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ua = navigator.userAgent
    const isShell =
      params.get('native') === '1' ||
      params.get('app') === '1' ||
      ua.includes('LipartaAccountantApp') ||
      window.location.pathname.startsWith('/accountant-app')

    if (!isShell) return

    document.documentElement.dataset.nativeApp = 'accountant'
    document.cookie = 'sitepilot_native_app=1; path=/; max-age=31536000; SameSite=Lax'
  }, [])

  return null
}
