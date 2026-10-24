import { Check } from 'lucide-react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { EntryPanel } from '../components/event'
import { Leaderboard } from '../components/Leaderboard'
import { ErrorBox, GameCover, MetaLine, Skeleton, StatusPill } from '../components/ui'
import { useAuth, useCatalog, useCounts, useMyEntries } from '../lib/app'
import { fmtDate, fmtPoints, ordinal, platformLabel, regOpen, teamSizeLabel } from '../lib/format'
import NotFound from './NotFound'

type Tab = 'overview' | 'standings' | 'rules'

export default function EventPage() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (['overview', 'standings', 'rules'].includes(params.get('tab') ?? '') ? params.get('tab') : null) as Tab | null
  const cat = useCatalog()
  const counts = useCounts()
  const mine = useMyEntries()
  const { session } = useAuth()

  if (cat.loading) {
    return (
      <div className="page stack">
        <Skeleton h={280} r={10} />
        <Skeleton h={120} r={10} />
      </div>
    )
  }
  if (cat.error) return <div className="page"><ErrorBox error={cat.error} /></div>
  const t = cat.tournamentBySlug.get(slug)
  const g = t && cat.gameById.get(t.game_id)
  if (!t || !g) return <NotFound />

  const active: Tab = tab ?? (['live', 'completed', 'closed'].includes(t.status) ? 'standings' : 'overview')
  const c = counts.data?.get(t.id)
  const myEntry = mine.data?.find((e) => e.tournament.id === t.id)
  const open = regOpen(t)
  const placement = Object.entries(t.placement_points ?? {}).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  const houseTable = Object.entries(t.house_points ?? {}).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  const setTab = (k: Tab) => setParams(k === 'overview' ? {} : { tab: k }, { replace: true })

  return (
    <div className="page stack" style={{ gap: 20, paddingBottom: 'calc(var(--nav-h) + 120px + env(safe-area-inset-bottom))' }}>
      <section className="hero" style={{ minHeight: 300 }}>
        <GameCover game={g} eager />
        <div className="hero-body">
          <div className="row wrap" style={{ gap: 8 }}>
            <StatusPill status={t.status} />
            <span className="tag-type t2">{t.season}</span>
          </div>
          <h1 className="display">{t.title}</h1>
          <MetaLine parts={[g.title, teamSizeLabel(g), g.platforms.map(platformLabel).join(' / ')]} />
        </div>
      </section>

      <div className="meta-grid">
        <Meta label="Format" value={g.mode === 'solo' ? 'Solo' : `${teamSizeLabel(g)}${g.max_subs ? ` + ${g.max_subs} sub` : ''}`} />
        <Meta label="Registration opens" value={fmtDate(t.reg_opens_at)} />
        <Meta label="Registration closes" value={fmtDate(t.reg_closes_at)} />
        <Meta label="Starts" value={fmtDate(t.starts_at)} />
        <Meta label={g.team_size > 1 ? 'Teams' : 'Players'} value={c ? `${c.entries}${t.max_entries ? ` / ${t.max_entries}` : ''}` : '–'} mono />
        <Meta label="Entry fee" value="Free" />
      </div>

      <div className="tabs" role="tablist">
        {(['overview', 'standings', 'rules'] as Tab[]).map((k) => (
          <button key={k} role="tab" aria-selected={active === k} onClick={() => setTab(k)}>
            {k === 'overview' ? 'Overview' : k === 'standings' ? 'Standings' : 'Rules'}
          </button>
        ))}
      </div>

      {active === 'overview' && (
        <div className="stack" style={{ gap: 24 }}>
          {myEntry && (
            <div className="panel">
              <EntryPanel entry={myEntry} />
            </div>
          )}
          <section className="stack" style={{ gap: 10 }}>
            <div className="section-head"><h2>About</h2></div>
            <p className="t2" style={{ whiteSpace: 'pre-line' }}>{t.summary}</p>
            {g.description && <p className="t2" style={{ whiteSpace: 'pre-line' }}>{g.description}</p>}
            {t.contact_note && <p className="t2" style={{ whiteSpace: 'pre-line' }}>{t.contact_note}</p>}
          </section>
          <section className="stack" style={{ gap: 10 }}>
            <div className="section-head"><h2>How it works</h2></div>
            <ol className="prose" style={{ margin: 0 }}>
              <li>Sign in with your IITM BS email and register{g.team_size > 1 ? '. The captain creates the team and shares the invite code; teammates join with it' : ''}.</li>
              <li>Before each match, organisers send lobby details to registered players on WhatsApp.</li>
              <li>{g.verify_note ? `Results are verified by ${g.verify_note}.` : 'Captains share a result screenshot after every match.'} Organisers post results here.</li>
              <li>Standings update on this page. Final placements earn points for your house.</li>
            </ol>
          </section>
          {placement.length > 0 && (
            <section className="stack" style={{ gap: 10 }}>
              <div className="section-head"><h2>Scoring</h2></div>
              <div className="rows">
                {placement.map(([k, v]) => (
                  <div key={k} className="spread link-row" style={{ minHeight: 44, padding: '8px 16px' }}>
                    <span className="t2">{k.includes('-') ? `${k.replace('-', '–')} place` : `${ordinal(Number(k))} place`}</span>
                    <span className="num">{fmtPoints(Number(v))} pts</span>
                  </div>
                ))}
                {Number(t.kill_points) > 0 && (
                  <div className="spread link-row" style={{ minHeight: 44, padding: '8px 16px' }}>
                    <span className="t2">Each finish (kill)</span>
                    <span className="num">{fmtPoints(Number(t.kill_points))} pts</span>
                  </div>
                )}
              </div>
              {g.scoring && <p className="small t3">{g.scoring}</p>}
            </section>
          )}
          {houseTable.length > 0 && (
            <section className="stack" style={{ gap: 10 }}>
              <div className="section-head"><h2>House points</h2></div>
              <p className="small t2">
                Final placements earn house points: {houseTable.map(([k, v]) => `${k.includes('-') ? k.replace('-', '–') : ordinal(Number(k))} ${fmtPoints(Number(v))}`).join(' · ')}.
                {t.same_house_teams ? ' This is a House Cup event: every team member must be from the same house.' : ' Mixed-house teams split the points equally between their players’ houses.'}
              </p>
            </section>
          )}
        </div>
      )}

      {active === 'standings' && <Leaderboard t={t} game={g} />}

      {active === 'rules' && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="section-head"><h2>{g.title} rules</h2></div>
          <ul className="prose" style={{ margin: 0 }}>
            {g.rules.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <p className="small t2">
            The <Link to="/rules" style={{ textDecoration: 'underline' }}>platform rulebook</Link> (eligibility, conduct, disputes, penalties) applies to every event.
          </p>
        </div>
      )}

      <div className="cta-bar">
        <div className="cta-bar-inner">
          <span className="small t2 num">
            {c ? `${c.entries} ${g.team_size > 1 ? 'teams' : 'players'} registered` : ' '}
          </span>
          {myEntry ? (
            <button className="btn btn-secondary" onClick={() => setTab('overview')}>
              <Check size={18} aria-hidden /> Registered
            </button>
          ) : open ? (
            <Link className="btn btn-primary" to={session ? `/e/${t.slug}/register` : `/signin?next=${encodeURIComponent(`/e/${t.slug}/register`)}`}>
              {g.team_size > 1 ? 'Register team' : 'Register'}
            </Link>
          ) : (
            <button className="btn btn-secondary" disabled>
              {t.status === 'upcoming' ? `Opens ${t.reg_opens_at ? fmtDate(t.reg_opens_at, false) : 'soon'}` : 'Registration closed'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="tag-type t3">{label}</span>
      <span className={mono ? 'num' : undefined} style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}
