import { useQueryClient } from '@tanstack/react-query'
import { Check, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field, Locked, NameWarning } from '../components/ui'
import { errorCode, errorText, useApi, useAuth, useHouses, useRegions } from '../lib/app'

const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/
const NAME_RE = /^\p{L}[\p{L} .'-]{1,59}$/u

type Errors = Partial<Record<'username' | 'full_name' | 'house' | 'region' | 'whatsapp' | 'rules' | 'form', string>>

export default function Onboarding() {
  const api = useApi()
  const qc = useQueryClient()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') && params.get('next') !== '/welcome' ? params.get('next')! : '/'
  const { session, profile } = useAuth()
  const houses = useHouses()
  const regions = useRegions()

  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [house, setHouse] = useState('')
  const [region, setRegion] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [rules, setRules] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [avail, setAvail] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle')

  const uname = username.trim().toLowerCase()
  useEffect(() => {
    if (!USERNAME_RE.test(uname)) {
      setAvail('idle')
      return
    }
    setAvail('checking')
    const t = window.setTimeout(async () => {
      try {
        const ok = await api.rpc<boolean>('username_available', { p_username: uname })
        setAvail(ok ? 'free' : 'taken')
      } catch {
        setAvail('idle')
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [uname, api])

  if (profile) return <Navigate to={next} replace />

  function validate(): Errors {
    const e: Errors = {}
    if (!USERNAME_RE.test(uname)) e.username = '3–20 characters: lowercase letters, numbers and _, starting with a letter'
    else if (avail === 'taken') e.username = 'That username is taken'
    if (!NAME_RE.test(fullName.trim().replace(/\s+/g, ' '))) e.full_name = 'Enter your full name as on your IITM records'
    if (!house) e.house = 'Pick your house'
    if (!region) e.region = 'Pick your region'
    const digits = whatsapp.replace(/[\s()-]/g, '')
    if (!/^(\+91|91|0)?[6-9]\d{9}$/.test(digits) && !/^\+[1-9]\d{7,14}$/.test(digits)) e.whatsapp = 'Enter a valid WhatsApp number'
    if (!rules) e.rules = 'Please accept the rules to continue'
    return e
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await api.rpc('complete_profile', {
        p_username: uname,
        p_full_name: fullName.trim().replace(/\s+/g, ' '),
        p_house_id: Number(house),
        p_region_id: Number(region),
        p_whatsapp: whatsapp,
        p_accept_rules: rules,
      })
      await qc.invalidateQueries({ queryKey: ['me'] })
      nav(next, { replace: true })
    } catch (err) {
      const code = errorCode(err)
      const msg = errorText(err)
      const key: keyof Errors =
        code === 'USERNAME_TAKEN' || code === 'BAD_USERNAME' ? 'username'
          : code === 'BAD_NAME' ? 'full_name'
            : code === 'BAD_WHATSAPP' ? 'whatsapp'
              : code === 'BAD_HOUSE' ? 'house'
                : code === 'BAD_REGION' ? 'region'
                  : 'form'
      setErrors({ [key]: msg })
      if (code === 'PROFILE_EXISTS') await qc.invalidateQueries({ queryKey: ['me'] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <form className="stack" style={{ gap: 20 }} onSubmit={submit} noValidate>
        <div className="stack" style={{ gap: 8 }}>
          <p className="tag-type t3">Step 2 of 2</p>
          <h1 className="h1">Set up your player profile</h1>
          <p className="lead">This is how you appear on every leaderboard.</p>
        </div>

        <Locked label="IITM email (verified)">{session?.email}</Locked>

        <Field
          label="Username"
          htmlFor="username"
          error={errors.username}
          hint={
            avail === 'free' ? (
              <span className="row" style={{ gap: 6, color: 'var(--success)' }}>
                <Check size={14} aria-hidden /> Available
              </span>
            ) : avail === 'taken' ? (
              <span style={{ color: 'var(--danger)' }}>Taken, try another</span>
            ) : (
              'Lowercase letters, numbers and _. Shown publicly.'
            )
          }
        >
          <input
            id="username"
            className="input"
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            maxLength={20}
            value={username}
            aria-invalid={!!errors.username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="e.g. tigerclaw_24"
          />
        </Field>
        <NameWarning />

        <Field label="Full name" htmlFor="fullname" error={errors.full_name} hint="Only organisers see this.">
          <input id="fullname" className="input" autoComplete="name" maxLength={60} value={fullName} aria-invalid={!!errors.full_name} onChange={(e) => setFullName(e.target.value)} />
        </Field>

        <div className="form-grid two">
          <Field label="House" htmlFor="house" error={errors.house}>
            <select id="house" className="select" value={house} aria-invalid={!!errors.house} onChange={(e) => setHouse(e.target.value)}>
              <option value="">Select your house</option>
              {houses.data?.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Region" htmlFor="region" error={errors.region}>
            <select id="region" className="select" value={region} aria-invalid={!!errors.region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">Select your region</option>
              {regions.data?.filter((r) => r.is_active).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="WhatsApp number" htmlFor="wa" error={errors.whatsapp} hint="Only organisers see this, to send you lobby details.">
          <input id="wa" className="input" type="tel" inputMode="tel" autoComplete="tel" maxLength={18} value={whatsapp} aria-invalid={!!errors.whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="98765 43210" />
        </Field>

        <div className="panel row" style={{ alignItems: 'flex-start', padding: 16 }}>
          <TriangleAlert size={20} strokeWidth={1.75} className="t2" style={{ flex: 'none', marginTop: 1 }} aria-hidden />
          <p className="small t2">
            Your <strong style={{ color: 'var(--text-1)' }}>house</strong> is permanent, so check it before you continue. You can change your username (once every 30 days), full name and WhatsApp number later from your profile. If your house or region is wrong, the organisers can correct it.
          </p>
        </div>

        <label className="check">
          <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)} />
          <span>
            I am a current IIT Madras BS student, this is my own account, and I agree to the{' '}
            <Link to="/rules" target="_blank" style={{ textDecoration: 'underline', color: 'var(--text-1)' }}>rules and code of conduct</Link>.
          </span>
        </label>
        {errors.rules && <p className="error-text">{errors.rules}</p>}
        {errors.form && <p className="error-text" role="alert">{errors.form}</p>}

        <Button kind="primary" block busy={busy} type="submit">
          Create my profile
        </Button>
      </form>
    </div>
  )
}
