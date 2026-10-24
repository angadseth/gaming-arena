import { useEffect, useRef, type MutableRefObject } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id: string) => void
      remove: (id: string) => void
    }
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let loading: Promise<void> | null = null
function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!loading) {
    loading = new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = SRC
      s.async = true
      s.onload = () => res()
      s.onerror = () => rej(new Error('Could not load the bot check'))
      document.head.appendChild(s)
    })
  }
  return loading
}

/** Cloudflare Turnstile (free CAPTCHA), only when VITE_TURNSTILE_SITE_KEY is set. */
export function Turnstile({ onToken, resetRef }: { onToken: (t: string | null) => void; resetRef: MutableRefObject<() => void> }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let id = ''
    let alive = true
    load().then(() => {
      if (!alive || !box.current || !window.turnstile) return
      id = window.turnstile.render(box.current, {
        sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
      resetRef.current = () => window.turnstile?.reset(id)
    })
    return () => {
      alive = false
      if (id) window.turnstile?.remove(id)
    }
  }, [onToken, resetRef])
  return <div ref={box} style={{ minHeight: 65 }} />
}
