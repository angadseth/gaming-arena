import { Check, LoaderCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApi } from '../lib/app'
import { Field, NameWarning } from './ui'

export const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/
export type UsernameStatus = 'empty' | 'format' | 'checking' | 'free' | 'taken' | 'same'

/** What is wrong with the shape of a username, or null when it is fine. */
export function usernameProblem(u: string): string | null {
  if (!u) return 'Pick a username'
  if (!/^[a-z]/.test(u)) return 'Start with a letter (a–z), not a number or _'
  if (u.length < 3) return 'At least 3 characters'
  if (!USERNAME_RE.test(u)) return 'Only lowercase letters, numbers and _'
  return null
}

/** Live username check: shape first, then availability (taken, reserved or not allowed) from the server. */
export function useUsernameStatus(value: string, current?: string): UsernameStatus {
  const api = useApi()
  const u = value.trim().toLowerCase()
  const [remote, setRemote] = useState<{ u: string; ok: boolean } | null>(null)
  const shapeOk = usernameProblem(u) === null && u !== current

  useEffect(() => {
    if (!shapeOk) return
    const t = window.setTimeout(async () => {
      try {
        setRemote({ u, ok: await api.rpc<boolean>('username_available', { p_username: u }) })
      } catch {
        setRemote(null)
      }
    }, 350)
    return () => window.clearTimeout(t)
  }, [u, shapeOk, api])

  if (!u) return 'empty'
  if (u === current) return 'same'
  if (!shapeOk) return 'format'
  if (!remote || remote.u !== u) return 'checking'
  return remote.ok ? 'free' : 'taken'
}

export function UsernameField({
  id, value, onChange, status, current, disabled, hint, error,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  status: UsernameStatus
  current?: string
  disabled?: boolean
  hint?: string
  error?: string | null
}) {
  const u = value.trim().toLowerCase()
  const live =
    status === 'format' || (status === 'empty' && !current) ? (
      value ? <span className="u-state bad"><X size={14} aria-hidden /> {usernameProblem(u)}</span> : null
    ) : status === 'checking' ? (
      <span className="u-state"><LoaderCircle size={14} className="spin" aria-hidden /> Checking…</span>
    ) : status === 'taken' ? (
      <span className="u-state bad"><X size={14} aria-hidden /> Taken or not allowed. Try another.</span>
    ) : status === 'free' ? (
      <span className="u-state good"><Check size={14} aria-hidden /> Available</span>
    ) : null
  return (
    <div className="stack" style={{ gap: 10 }}>
      <Field label="Username" htmlFor={id} error={error} hint={live ?? hint}>
        <input
          id={id}
          className="input"
          autoCapitalize="none"
          autoComplete="username"
          spellCheck={false}
          maxLength={20}
          disabled={disabled}
          value={value}
          aria-invalid={status === 'format' || status === 'taken' || !!error}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder={current ? undefined : 'e.g. tigerclaw_24'}
        />
      </Field>
      <NameWarning />
    </div>
  )
}

export const usernameBlocksSave = (s: UsernameStatus) => s === 'format' || s === 'checking' || s === 'taken' || s === 'empty'
