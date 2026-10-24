import { Check, Gamepad2, LoaderCircle, Lock, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../lib/app'
import { gameArt, houseCode, houseColor, STATUS_LABEL } from '../lib/format'
import type { Game, TournamentStatus } from '../lib/types'
import { OTP_LENGTH } from '../lib/api/types'

/** Poker-chip mark: notched ring, star in the middle. */
export function ChipGlyph({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="15" fill="var(--magenta)" />
      <circle cx="16" cy="16" r="15" fill="none" stroke="#fff6e8" strokeWidth="4" strokeDasharray="5.9 5.9" />
      <circle cx="16" cy="16" r="9.5" fill="var(--bg)" stroke="var(--accent)" strokeWidth="1.6" />
      <path d="M16 10.4l1.6 3.4 3.7.4-2.8 2.5.8 3.6L16 18.5l-3.3 1.8.8-3.6-2.8-2.5 3.7-.4z" fill="var(--accent)" />
    </svg>
  )
}

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Gaming Arena home">
      <ChipGlyph />
      <span className="brand-word">GAMING ARENA</span>
      <span className="brand-sub">IITM BS Esports</span>
    </Link>
  )
}

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-fill'
export function Button({
  kind = 'secondary', size, block, busy, children, className = '', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; size?: 'sm'; block?: boolean; busy?: boolean }) {
  const cls = ['btn', `btn-${kind}`, size === 'sm' && 'btn-sm', block && 'btn-block', className].filter(Boolean).join(' ')
  return (
    <button className={cls} disabled={busy || rest.disabled} aria-busy={busy || undefined} {...rest}>
      {busy && <LoaderCircle size={18} className="spin" aria-hidden />}
      {children}
    </button>
  )
}

export function StatusPill({ status }: { status: TournamentStatus }) {
  const dot = status === 'open' || status === 'live'
  return (
    <span className={`pill pill-${status}`}>
      {dot && <span className="dot" aria-hidden />}
      {status === 'completed' && <Check size={12} strokeWidth={2.5} aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  )
}

export function HouseTag({ id, title }: { id: number | null | undefined; title?: string }) {
  return (
    <span className="house-tag" title={title} style={{ '--h': houseColor(id) } as CSSProperties}>
      {houseCode(id)}
    </span>
  )
}

/**
 * Split-flap number: each character flips into place, staggered, whenever the value changes.
 * Screen readers get the plain value; the tiles are decoration.
 */
export function Flap({ value, tiles, className = '' }: { value: string | number; tiles?: boolean; className?: string }) {
  const text = String(value)
  return (
    <span className={`flap${tiles ? ' flap-tiles' : ''} ${className}`}>
      <span className="sr-only">{text}</span>
      {[...text].map((c, i) => (
        <span key={`${i}:${c}`} className={c === ' ' ? 'flap-gap' : 'flap-ch'} style={{ '--i': i } as CSSProperties} aria-hidden>
          {c}
        </span>
      ))}
    </span>
  )
}

export function MetaLine({ parts }: { parts: (string | false | null | undefined)[] }) {
  const items = parts.filter(Boolean) as string[]
  return (
    <span className="meta-line">
      {items.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="sep">//</span>}
          {p}
        </span>
      ))}
    </span>
  )
}

/** Game key art, or a generated monogram cover when none is uploaded. */
export function GameCover({ game, eager }: { game: Pick<Game, 'title' | 'short' | 'cover_path'> & { slug?: string }; eager?: boolean }) {
  const api = useApi()
  const [broken, setBroken] = useState(false)
  const src = game.cover_path && !broken ? api.artUrl(game.cover_path) : ''
  const words = (game.short || game.title).replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2)
  const mono = words.join('\n')
  // Font size scales with the longest word so every name fills the card without breaking.
  const fit = { '--len': Math.max(3, ...words.map((w) => w.length)) } as CSSProperties
  const photo = gameArt(game.slug)
  return (
    <div className="cover">
      {src ? (
        <img
          className="cover-art"
          src={src}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="cover-gen cover-art" style={fit} aria-hidden>
          {photo && (
            <img
              className="cover-photo"
              src={photo.src}
              alt=""
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              style={{ objectPosition: `${photo.focus} 50%` }}
            />
          )}
          <span className="mono">{mono}</span>
          <span className="mono mono-fill">{mono}</span>
          <span className="glyph">
            <Gamepad2 size={20} strokeWidth={1.75} />
          </span>
        </div>
      )}
    </div>
  )
}

export function Field({
  label, hint, error, children, htmlFor,
}: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="error-text" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

/** Shown wherever a player picks a username. */
export function NameWarning() {
  return (
    <div className="caution" role="note">
      <TriangleAlert size={18} strokeWidth={2} aria-hidden />
      <p>
        Keep your username respectful. If we find it offensive in any way, your account will be banned from every
        event for the rest of your time in the programme.
      </p>
    </div>
  )
}

export function Locked({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="locked">
        <Lock size={16} strokeWidth={1.75} aria-hidden />
        <span className="grow ellipsis">{children}</span>
      </div>
    </div>
  )
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p className="t2">{text}</p>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}

export function Skeleton({ h = 60, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skel" style={{ height: h, width: w, borderRadius: r }} aria-hidden />
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const text = error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <Empty
      title="Could not load this"
      text={/fetch|network/i.test(text) ? 'Network problem. Check your connection.' : text}
      action={retry && <Button onClick={retry}>Try again</Button>}
    />
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={id}>
        <h2 id={id} className="h2" style={{ marginBottom: 16 }}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}

/** One real input drawn as boxes: paste, autofill and backspace all work. */
export function OtpInput({
  value, onChange, onComplete, length = OTP_LENGTH, shake, disabled,
}: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; length?: number; shake?: boolean; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <div className={`otp${shake ? ' shake' : ''}`}>
      <input
        ref={ref}
        value={value}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={`${length}-digit code`}
        maxLength={length}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, length)
          onChange(v)
          if (v.length === length) onComplete?.(v)
        }}
      />
      <div className="otp-boxes" aria-hidden>
        {Array.from({ length }, (_, i) => (
          <div
            key={i}
            className={`otp-box${value[i] ? ' filled' : ''}${focused && i === Math.min(value.length, length - 1) ? ' focus' : ''}`}
          >
            {value[i] ?? ''}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Spinner() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: 48 }} aria-label="Loading">
      <LoaderCircle size={24} className="spin t3" />
    </div>
  )
}
