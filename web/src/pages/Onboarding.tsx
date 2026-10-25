import { useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field, Locked } from '../components/ui'
import { UsernameField, usernameProblem, useUsernameStatus } from '../components/UsernameField'
import { errorCode, errorText, useApi, useAuth, useHouses, useRegions } from '../lib/app'

const NAME_RE = /^\p{L}[\p{L} .'-]{1,59}$/u

type Errors = Partial<Record<'username' | 'full_name' | 'house' | 'region' | 'rules' | 'form', string>>

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
  const [rules, setRules] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const uname = username.trim().toLowerCase()
  const uStatus = useUsernameStatus(username)

  if (profile) return <Navigate to={next} replace />

  function validate(): Errors {
    const e: Errors = {}
    const uProblem = usernameProblem(uname)
    if (uProblem) e.username = uProblem
    else if (uStatus === 'taken') e.username = 'That username is taken or not allowed'
    if (!NAME_RE.test(fullName.trim().replace(/\s+/g, ' '))) e.full_name = 'Enter your full name as on your IITM records'
    if (!house) e.house = 'Pick your house'
    if (!region) e.region = 'Pick your region'
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
        p_whatsapp: null,
        p_accept_rules: rules,
      })
      await qc.invalidateQueries({ queryKey: ['me'] })
      nav(next, { replace: true })
    } catch (err) {
      const code = errorCode(err)
      const msg = errorText(err)
      const key: keyof Errors =
        code === 'USERNAME_TAKEN' || code === 'BAD_USERNAME' || code === 'USERNAME_BLOCKED' ? 'username'
          : code === 'BAD_NAME' ? 'full_name'
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

        <UsernameField
          id="username"
          value={username}
          onChange={(v) => {
            setUsername(v)
            if (errors.username) setErrors({ ...errors, username: undefined })
          }}
          status={uStatus}
          error={errors.username}
          hint="Lowercase letters, numbers and _. Shown publicly."
        />

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


        <div className="panel row" style={{ alignItems: 'flex-start', padding: 16 }}>
          <TriangleAlert size={20} strokeWidth={1.75} className="t2" style={{ flex: 'none', marginTop: 1 }} aria-hidden />
          <p className="small t2">
            Your <strong style={{ color: 'var(--text-1)' }}>house</strong> is permanent, so check it before you continue. You can change your username (once every 30 days), full name and add a WhatsApp number later from your profile. If your house or region is wrong, the organisers can correct it.
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
