import { ArrowLeft, Mail } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Turnstile } from '../components/Turnstile'
import { Brand, Button, Field, OtpInput } from '../components/ui'
import { errorCode, errorText, useApi, useAuth } from '../lib/app'
import { OTP_LENGTH } from '../lib/api/types'

const DOMAINS = ['ds.study.iitm.ac.in', 'es.study.iitm.ac.in']
const PENDING_KEY = 'pugmark-pending-email'
const RESEND_SECONDS = 60

/** Accepts a full IITM email or just the roll number (24f2004141). */
export function normalizeEmail(raw: string): { email: string; error: string | null } {
  let email = raw.trim().toLowerCase()
  if (email && !email.includes('@')) email = `${email}@${DOMAINS[0]}`
  const [local, domain, extra] = email.split('@')
  if (!email) return { email, error: 'Enter your IITM BS email' }
  if (extra !== undefined || !local || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(local) || !DOMAINS.includes(domain ?? '')) {
    return { email, error: 'Use your IITM BS student email (…@ds.study.iitm.ac.in or …@es.study.iitm.ac.in)' }
  }
  return { email, error: null }
}

function readPending(): string {
  try {
    return sessionStorage.getItem(PENDING_KEY) ?? ''
  } catch {
    return ''
  }
}
function writePending(v: string | null) {
  try {
    if (v) sessionStorage.setItem(PENDING_KEY, v)
    else sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignore */
  }
}

export default function SignIn() {
  const api = useApi()
  const { session, ready } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/'

  const [step, setStep] = useState<'email' | 'code'>(readPending() ? 'code' : 'email')
  const [raw, setRaw] = useState(readPending())
  const [email, setEmail] = useState(readPending())
  const [emailError, setEmailError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)
  const [wait, setWait] = useState(0)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const captchaReset = useRef<() => void>(() => {})
  const needsCaptcha = !!import.meta.env.VITE_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (wait <= 0) return
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(t)
  }, [wait])

  if (ready && session) return <Navigate to={next} replace />

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const n = normalizeEmail(raw)
    setEmailError(n.error)
    if (n.error) return
    if (needsCaptcha && !captcha) {
      setEmailError('Complete the check below first')
      return
    }
    setBusy(true)
    try {
      await api.sendCode(n.email, captcha ?? undefined)
      setEmail(n.email)
      writePending(n.email)
      setStep('code')
      setCode('')
      setCodeError(null)
      setWait(RESEND_SECONDS)
    } catch (err) {
      setEmailError(errorText(err))
    } finally {
      setBusy(false)
      setCaptcha(null)
      captchaReset.current()
    }
  }

  async function verify(value: string) {
    if (value.length !== OTP_LENGTH) return
    setBusy(true)
    setCodeError(null)
    try {
      await api.verifyCode(email, value)
      writePending(null)
      nav(next, { replace: true })
    } catch (err) {
      setCodeError(errorCode(err) === 'RATE_LIMITED' ? errorText(err) : "That code didn't match or has expired. Check the latest email.")
      setShake(true)
      window.setTimeout(() => setShake(false), 250)
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {api.kind === 'pglite' && <div className="dev-banner">LOCAL PREVIEW DATABASE · sign-in code is 12345678</div>}
      <div className="contour" style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px var(--gutter) 40px' }}>
          <Brand />
          <h1 className="display" style={{ marginTop: 56 }}>
            Leave your
            <br />
            mark.
          </h1>
          <p className="lead" style={{ marginTop: 12 }}>
            The esports league of the IIT Madras BS degree. Every house, every game, one leaderboard.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '28px var(--gutter) 40px', flex: 1 }}>
        {step === 'email' ? (
          <form className="stack" onSubmit={send} noValidate>
            <h2 className="h2">Sign in</h2>
            <p className="t2">We'll email an {OTP_LENGTH}-digit code to your IITM BS student inbox. No passwords.</p>
            <Field label="IITM BS email" htmlFor="email" error={emailError} hint="Your roll number works too, e.g. 24f1001234">
              <input
                id="email"
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="24f1001234@ds.study.iitm.ac.in"
                value={raw}
                aria-invalid={!!emailError}
                onChange={(e) => setRaw(e.target.value)}
              />
            </Field>
            {needsCaptcha && <Turnstile onToken={setCaptcha} resetRef={captchaReset} />}
            <Button kind="primary" block busy={busy} type="submit">
              Send code
            </Button>
            <p className="small t3">
              By signing in you agree to the <Link to="/rules" className="t2" style={{ textDecoration: 'underline' }}>rules</Link> and{' '}
              <Link to="/privacy" className="t2" style={{ textDecoration: 'underline' }}>privacy note</Link>.
            </p>
          </form>
        ) : (
          <div className="stack">
            <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', marginLeft: -12 }} onClick={() => { setStep('email'); writePending(null) }}>
              <ArrowLeft size={18} aria-hidden /> Change email
            </button>
            <h2 className="h2">Enter the code</h2>
            <p className="t2">
              Sent to <strong style={{ color: 'var(--text-1)', overflowWrap: 'anywhere' }}>{email}</strong>. It expires in 10 minutes.
            </p>
            <OtpInput value={code} onChange={setCode} onComplete={verify} shake={shake} disabled={busy} />
            {codeError && <p className="error-text" role="alert">{codeError}</p>}
            <div className="row wrap" style={{ marginTop: 4 }}>
              <a className="btn btn-secondary" href="https://mail.google.com/mail/u/0/#search/Pugmark%20OR%20%22Gaming%20Arena%22" target="_blank" rel="noopener noreferrer">
                <Mail size={18} aria-hidden /> Open Gmail
              </a>
              <Button kind="ghost" disabled={wait > 0 || busy} onClick={() => send()}>
                {wait > 0 ? <span className="num">Resend in {wait}s</span> : 'Resend code'}
              </Button>
            </div>
            <p className="small t3">Not in your inbox? Check Spam and Promotions, and make sure you used your student email.</p>
          </div>
        )}
      </div>
    </div>
  )
}
