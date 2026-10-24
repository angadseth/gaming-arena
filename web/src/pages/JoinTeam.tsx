import { useQueryClient } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { celebrate } from '../lib/fireworks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { checkGameFields, GameFields } from '../components/event'
import { Button, Field, HouseTag } from '../components/ui'
import { errorCode, errorText, useApi, useCatalog } from '../lib/app'
import type { TeamPreview } from '../lib/types'
import { EventStrip } from './Register'

const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/

export default function JoinTeam() {
  const api = useApi()
  const qc = useQueryClient()
  const nav = useNavigate()
  const { code: urlCode = '' } = useParams()
  const cat = useCatalog()
  const [code, setCode] = useState(urlCode.toUpperCase())
  const [codeErr, setCodeErr] = useState<string | null>(null)
  const [team, setTeam] = useState<TeamPreview | null>(null)
  const [igId, setIgId] = useState('')
  const [extra, setExtra] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(false)
  useEffect(() => {
    if (joined) celebrate()
  }, [joined])

  async function lookup(value = code) {
    const c = value.trim().toUpperCase()
    if (!CODE_RE.test(c)) {
      setCodeErr('Invite codes are 8 characters, letters and numbers')
      return
    }
    setBusy(true)
    setCodeErr(null)
    try {
      setTeam(await api.rpc<TeamPreview>('team_by_invite', { p_code: c }))
    } catch (e) {
      setCodeErr(errorText(e))
      setTeam(null)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (CODE_RE.test(urlCode.toUpperCase())) lookup(urlCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode])

  const t = team ? cat.tournaments.find((x) => x.id === team.tournament_id) : undefined
  const g = t ? cat.gameById.get(t.game_id) : undefined

  async function join(e: FormEvent) {
    e.preventDefault()
    if (!g || !team) return
    const errs = checkGameFields(g, igId, extra)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const clean = Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
      await api.rpc('join_team', { p_code: code.trim().toUpperCase(), p_ig_id: igId.trim(), p_extra: clean })
      ;[['my-entries'], ['counts'], ['standings'], ['lobby']].forEach((k) => qc.invalidateQueries({ queryKey: k }))
      setJoined(true)
    } catch (err) {
      const c = errorCode(err)
      setErrors({ [c === 'BAD_IG_ID' || c === 'IG_ID_TAKEN' ? '__ig' : '__form']: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  if (joined && team && t) {
    return (
      <div className="page stack" style={{ gap: 20, maxWidth: 560, paddingTop: 40 }}>
        <CircleCheck size={48} strokeWidth={1.5} style={{ color: 'var(--success)' }} aria-hidden />
        <h1 className="h1">You joined {team.team_name}</h1>
        <p className="lead">{t.title} is now on your profile.</p>
        <div className="row wrap">
          <Button kind="primary" onClick={() => nav(`/e/${t.slug}`)}>Done</Button>
          <Link to="/me" className="btn btn-secondary">My events</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page stack" style={{ gap: 20, maxWidth: 640 }}>
      <h1 className="h1">Join a team</h1>
      <p className="t2">Ask your captain for the 8-character invite code from their Gaming Arena profile.</p>
      <form className="row" style={{ alignItems: 'flex-start' }} onSubmit={(e) => { e.preventDefault(); lookup() }}>
        <div className="grow">
          <Field label="Invite code" htmlFor="code" error={codeErr}>
            <input
              id="code"
              className="input num"
              style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={8}
              value={code}
              aria-invalid={!!codeErr}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                setTeam(null)
              }}
            />
          </Field>
        </div>
        <Button busy={busy && !team} type="submit" style={{ marginTop: 24 }}>Find team</Button>
      </form>

      {team && t && g && (
        <form className="stack" style={{ gap: 16 }} onSubmit={join} noValidate>
          <EventStrip t={t} g={g} />
          <div className="panel stack" style={{ gap: 6 }}>
            <p className="tag-type t3">Team</p>
            <p className="h3">{team.team_name}</p>
            <p className="small t2 num row" style={{ gap: 8 }}>
              {Number(team.members)} / {team.team_size} players
              {team.house_id ? <><span>·</span><HouseTag id={team.house_id} /> House Cup</> : null}
            </p>
          </div>
          {!team.open ? (
            <p className="error-text">Registration for this event is closed.</p>
          ) : (
            <>
              <GameFields game={g} igId={igId} setIgId={setIgId} extra={extra} setExtra={setExtra} errors={errors} />
              {errors.__form && <p className="error-text" role="alert">{errors.__form}</p>}
              <Button kind="primary" block busy={busy} type="submit">Join team</Button>
            </>
          )}
        </form>
      )}
    </div>
  )
}
