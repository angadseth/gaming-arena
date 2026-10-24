import { ChevronRight, MessageSquarePlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EventCard } from '../components/event'
import { Empty, ErrorBox, GameCover, MetaLine, Skeleton, StatusPill } from '../components/ui'
import { useAuth, useCatalog, useCounts, useMyEntries } from '../lib/app'
import { fmtShort, regOpen, relative, teamSizeLabel, urgency } from '../lib/format'
import type { Tournament, TournamentStatus } from '../lib/types'

const FILTERS: { key: 'all' | TournamentStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
]

export default function Events() {
  const cat = useCatalog()
  const counts = useCounts()
  const mine = useMyEntries()
  const { session } = useAuth()
  const [filter, setFilter] = useState<'all' | TournamentStatus>('all')

  const visible = useMemo(
    () =>
      cat.tournaments
        .filter((t) => t.status !== 'draft' && cat.gameById.get(t.game_id)?.is_active !== false)
        .sort((a, b) => urgency(a) - urgency(b) || (cat.gameById.get(a.game_id)?.sort_order ?? 0) - (cat.gameById.get(b.game_id)?.sort_order ?? 0)),
    [cat.tournaments, cat.gameById],
  )

  // Hero: my next event, else the open event that closes soonest, else live, else next upcoming.
  const hero = useMemo<{ t: Tournament; mine: boolean } | null>(() => {
    const myIds = new Set((mine.data ?? []).filter((e) => ['open', 'live', 'closed', 'upcoming'].includes(e.tournament.status)).map((e) => e.tournament.id))
    const myNext = visible.find((t) => myIds.has(t.id) && t.status !== 'completed')
    if (myNext) return { t: myNext, mine: true }
    const open = visible.filter((t) => regOpen(t)).sort((a, b) => (a.reg_closes_at ?? '9').localeCompare(b.reg_closes_at ?? '9'))[0]
    const pick = open ?? visible.find((t) => t.status === 'live') ?? visible.find((t) => t.status === 'upcoming')
    return pick ? { t: pick, mine: false } : null
  }, [visible, mine.data])

  const shown = filter === 'all' ? visible : visible.filter((t) => t.status === filter)
  const openCount = visible.filter((t) => regOpen(t)).length

  return (
    <div className="page stack" style={{ gap: 24 }}>
      <section className="stack" style={{ gap: 6 }}>
        <p className="tag-type t3">IIT Madras BS · Season 1</p>
        <h1 className="h1">Events</h1>
        <p className="t2">
          {cat.loading ? 'Loading events…' : `${visible.length} events across ${cat.games.filter((g) => g.is_active).length} games${openCount ? ` · ${openCount} open now` : ''}. Entry is always free.`}
        </p>
      </section>

      {cat.error ? (
        <ErrorBox error={cat.error} />
      ) : cat.loading ? (
        <Skeleton h={300} r={10} />
      ) : (
        hero && <Hero t={hero.t} mine={hero.mine} entrants={counts.data?.get(hero.t.id)?.entries} signedIn={!!session} />
      )}

      <div className="chips" role="group" aria-label="Filter events">
        {FILTERS.map((f) => (
          <button key={f.key} className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {cat.loading ? (
        <div className="game-grid">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="skel" style={{ aspectRatio: '4 / 5', borderRadius: 10 }} />)}
        </div>
      ) : shown.length ? (
        <div className="game-grid">
          {shown.map((t) => {
            const g = cat.gameById.get(t.game_id)
            return g ? <EventCard key={t.id} t={t} game={g} entrants={counts.data?.get(t.id)?.entries} /> : null
          })}
        </div>
      ) : (
        <Empty title="Nothing here yet" text="No events with this status right now. Check the other filters." />
      )}

      <div className="rows">
        <Link to="/join" className="link-row">
          <Users size={20} strokeWidth={1.75} className="t2" aria-hidden />
          <span className="grow">
            <strong style={{ display: 'block', fontWeight: 600 }}>Join a team</strong>
            <span className="small t3">Got an invite code from your captain? Enter it here.</span>
          </span>
          <ChevronRight size={18} className="t3" aria-hidden />
        </Link>
        <Link to="/request" className="link-row">
          <MessageSquarePlus size={20} strokeWidth={1.75} className="t2" aria-hidden />
          <span className="grow">
            <strong style={{ display: 'block', fontWeight: 600 }}>Request a game</strong>
            <span className="small t3">Want a tournament for a game that is not listed? Tell the organisers.</span>
          </span>
          <ChevronRight size={18} className="t3" aria-hidden />
        </Link>
      </div>
    </div>
  )
}

function Hero({ t, mine, entrants, signedIn }: { t: Tournament; mine: boolean; entrants?: number; signedIn: boolean }) {
  const cat = useCatalog()
  const g = cat.gameById.get(t.game_id)
  if (!g) return null
  const open = regOpen(t)
  const when = t.status === 'open' && t.reg_closes_at ? `CLOSES ${fmtShort(t.reg_closes_at)}` : t.starts_at ? `STARTS ${fmtShort(t.starts_at)}` : null
  return (
    <section className="hero" style={{ aspectRatio: '16 / 9', maxHeight: 460 }} aria-label="Featured event">
      <GameCover game={g} eager />
      <div className="hero-body">
        <div className="row wrap" style={{ gap: 8 }}>
          <StatusPill status={t.status} />
          {mine && <span className="pill pill-upcoming">You're in</span>}
          {t.starts_at && new Date(t.starts_at).getTime() > Date.now() && (
            <span className="tag-type t2 num">STARTS {relative(t.starts_at).toUpperCase()}</span>
          )}
        </div>
        <h2 className="display" style={{ maxWidth: 760 }}>{t.title}</h2>
        <MetaLine parts={[g.short || g.title, teamSizeLabel(g), entrants ? `${entrants} REGISTERED` : null, when]} />
        <div className="row wrap" style={{ marginTop: 6 }}>
          {open && !mine ? (
            <Link className="btn btn-primary" to={signedIn ? `/e/${t.slug}/register` : `/signin?next=${encodeURIComponent(`/e/${t.slug}/register`)}`}>
              Register
            </Link>
          ) : (
            <Link className="btn btn-primary" to={`/e/${t.slug}`}>
              {mine ? 'View my event' : 'View event'}
            </Link>
          )}
          {open && !mine && (
            <Link className="btn btn-ghost" to={`/e/${t.slug}`}>
              Details
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
