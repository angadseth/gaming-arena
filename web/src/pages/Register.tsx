import { useQueryClient } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { checkGameFields, GameFields, InviteCode } from '../components/event'
import { Button, ErrorBox, Field, GameCover, HouseTag, Locked, Skeleton, StatusPill } from '../components/ui'
import { errorCode, errorText, useApi, useAuth, useCatalog, useHouseName, useMyEntries } from '../lib/app'
import { regOpen, teamSizeLabel } from '../lib/format'
import type { Game, Tournament } from '../lib/types'
import NotFound from './NotFound'

export default function Register() {
  const { slug = '' } = useParams()
  const cat = useCatalog()
  const mine = useMyEntries()
  const [done, setDone] = useState<null | { invite?: string; teamName?: string }>(null)

  if (cat.loading || mine.isPending) return <div className="page stack"><Skeleton h={80} /><Skeleton h={300} /></div>
  if (cat.error) return <div className="page"><ErrorBox error={cat.error} /></div>
  const t = cat.tournamentBySlug.get(slug)
  const g = t && cat.gameById.get(t.game_id)
  if (!t || !g) return <NotFound />
  if (done) return <Success t={t} g={g} invite={done.invite} teamName={done.teamName} />
  if (mine.data?.some((e) => e.tournament.id === t.id)) return <Navigate to={`/e/${t.slug}`} replace />

  return (
    <div className="page stack" style={{ gap: 20, maxWidth: 640 }}>
      <EventStrip t={t} g={g} />
      {!regOpen(t) ? (
        <div className="panel stack">
          <p className="h3">Registration is not open</p>
          <p className="t2">Check the event page for dates.</p>
          <Link to={`/e/${t.slug}`} className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>Back to event</Link>
        </div>
      ) : (
        <RegisterForm t={t} g={g} onDone={setDone} />
      )}
    </div>
  )
}

export function EventStrip({ t, g }: { t: Tournament; g: Game }) {
  return (
    <Link to={`/e/${t.slug}`} className="row panel" style={{ padding: 10 }}>
      <div className="thumb" style={{ width: 56, height: 56 }}>
        <GameCover game={g} />
      </div>
      <div className="grow stack" style={{ gap: 4 }}>
        <span className="ellipsis" style={{ fontWeight: 650 }}>{t.title}</span>
        <span className="row" style={{ gap: 8 }}>
          <StatusPill status={t.status} />
          <span className="tag-type t3">{teamSizeLabel(g)}</span>
        </span>
      </div>
    </Link>
  )
}

function RegisterForm({ t, g, onDone }: { t: Tournament; g: Game; onDone: (d: { invite?: string; teamName?: string }) => void }) {
  const api = useApi()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const houseName = useHouseName()
  const team = g.team_size > 1
  const [teamName, setTeamName] = useState('')
  const [igId, setIgId] = useState('')
  const [extra, setExtra] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs = checkGameFields(g, igId, extra)
    const name = teamName.trim().replace(/\s+/g, ' ')
    if (team && !/^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,31}$/u.test(name)) errs.__team = 'Team name: 2–32 letters, numbers, spaces, . _ -'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const cleanExtra = Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
    setBusy(true)
    try {
      if (team) {
        const r = await api.rpc<{ invite_code: string }>('create_team', { p_tournament_id: t.id, p_team_name: name, p_ig_id: igId.trim(), p_extra: cleanExtra })
        onDone({ invite: r.invite_code, teamName: name })
      } else {
        await api.rpc('register_solo', { p_tournament_id: t.id, p_ig_id: igId.trim(), p_extra: cleanExtra })
        onDone({})
      }
      ;[['my-entries'], ['counts'], ['standings']].forEach((k) => qc.invalidateQueries({ queryKey: k }))
    } catch (err) {
      const code = errorCode(err)
      const key = code === 'BAD_IG_ID' || code === 'IG_ID_TAKEN' ? '__ig' : code === 'TEAM_NAME_TAKEN' || code === 'BAD_TEAM_NAME' ? '__team' : '__form'
      setErrors({ [key]: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" style={{ gap: 20 }} onSubmit={submit} noValidate>
      <h1 className="h1">{team ? 'Create your team' : 'Register'}</h1>
      {team && (
        <p className="t2">
          You become the captain. You'll get an invite code to share with up to {g.team_size - 1} teammates
          {g.max_subs ? ` and ${g.max_subs} sub` : ''}. Already have a code?{' '}
          <Link to="/join" style={{ textDecoration: 'underline', color: 'var(--text-1)' }}>Join a team instead</Link>.
        </p>
      )}

      <section className="stack" style={{ gap: 12 }}>
        <div className="section-head"><h2>You</h2></div>
        <div className="form-grid two">
          <Locked label="Username">{profile?.username}</Locked>
          <Locked label="House">
            <span className="row" style={{ gap: 8 }}>
              <HouseTag id={profile?.house_id} /> {houseName(profile?.house_id)}
            </span>
          </Locked>
        </div>
      </section>

      {team && (
        <section className="stack" style={{ gap: 12 }}>
          <div className="section-head"><h2>Team</h2></div>
          <Field label="Team name" htmlFor="team" error={errors.__team} hint="Shown on the leaderboard. Keep it clean.">
            <input id="team" className="input" maxLength={32} value={teamName} aria-invalid={!!errors.__team} onChange={(e) => setTeamName(e.target.value)} />
          </Field>
          {t.same_house_teams && <p className="small t2">House Cup event: only players from your house can join this team.</p>}
        </section>
      )}

      <section className="stack" style={{ gap: 12 }}>
        <div className="section-head"><h2>In-game</h2></div>
        <GameFields game={g} igId={igId} setIgId={setIgId} extra={extra} setExtra={setExtra} errors={errors} />
      </section>

      {errors.__form && <p className="error-text" role="alert">{errors.__form}</p>}
      <p className="small t3">
        By registering you confirm the in-game account is yours and you'll follow the event rules. Entry is free; there are no stakes or bets.
      </p>
      <Button kind="primary" block busy={busy} type="submit">
        {team ? 'Create team' : 'Register'}
      </Button>
    </form>
  )
}

function Success({ t, g, invite, teamName }: { t: Tournament; g: Game; invite?: string; teamName?: string }) {
  return (
    <div className="page stack" style={{ gap: 20, maxWidth: 560, paddingTop: 40 }}>
      <CircleCheck size={48} strokeWidth={1.5} style={{ color: 'var(--success)' }} aria-hidden />
      <h1 className="h1">{invite ? 'Team created' : "You're in"}</h1>
      <p className="lead">
        {t.title} is now on your profile.{invite ? ' Share the code below with your teammates.' : ' Lobby details reach you on WhatsApp before each match.'}
      </p>
      {invite && teamName && <InviteCode code={invite} teamName={teamName} eventTitle={t.title} />}
      {g.team_size > 1 && <p className="small t3">Your team needs {g.team_size} players before registration closes.</p>}
      <div className="row wrap">
        <Link to={`/e/${t.slug}`} className="btn btn-primary">Done</Link>
        <Link to={`/e/${t.slug}?tab=standings`} className="btn btn-secondary">View leaderboard</Link>
      </div>
    </div>
  )
}
