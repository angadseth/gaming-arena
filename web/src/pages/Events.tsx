import { ChevronRight, MessageSquarePlus, Users } from 'lucide-react'
import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { EventCard } from '../components/event'
import { DiwaliBanner } from '../components/Festive'
import { ErrorBox, GameCover, MetaLine, Skeleton, StatusPill } from '../components/ui'
import { useAuth, useCatalog, useCounts, useMyEntries } from '../lib/app'
import { fmtShort, gameHue, regOpen, relative, teamSizeLabel, urgency } from '../lib/format'
import type { Tournament, TournamentStatus } from '../lib/types'

/**
 * "Open Games" = registration open or game on now. A closed event moves down to "Upcoming"
 * (Angad, 25 Oct: closing it must visibly take it out of Open Games at once).
 */
const OPEN_NOW: TournamentStatus[] = ['live', 'open']
const LATER: TournamentStatus[] = ['upcoming', 'closed']

export default function Events() {
  const cat = useCatalog()
  const counts = useCounts()
  const mine = useMyEntries()
  const { session } = useAuth()

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

  const byGame = (a: Tournament, b: Tournament) =>
    (cat.gameById.get(a.game_id)?.sort_order ?? 99) - (cat.gameById.get(b.game_id)?.sort_order ?? 99)
  const openNow = visible.filter((t) => OPEN_NOW.includes(t.status)).sort(byGame)
  const upcoming = visible.filter((t) => LATER.includes(t.status)).sort(byGame)
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

      <DiwaliBanner />

      {cat.error ? (
        <ErrorBox error={cat.error} />
      ) : cat.loading ? (
        <Skeleton h={300} r={16} />
      ) : (
        hero && <Hero t={hero.t} mine={hero.mine} entrants={counts.data?.get(hero.t.id)?.entries} signedIn={!!session} />
      )}

      {cat.loading ? (
        <div className="game-grid">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="skel" style={{ aspectRatio: '4 / 5', borderRadius: 16 }} />)}
        </div>
      ) : (
        <>
          <EventSection
            id="open-games"
            title="Open Games"
            sub="Registration open or game on now"
            list={openNow}
            empty="Nothing is open right now. The next ones are just below."
          />
          <EventSection id="upcoming" title="Upcoming" sub="Announced, or registration closed" list={upcoming} empty="No upcoming events right now." />
        </>
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

function EventSection({ id, title, sub, list, empty }: { id: string; title: string; sub: string; list: Tournament[]; empty: string }) {
  const cat = useCatalog()
  const counts = useCounts()
  return (
    <section className="ev-section" aria-labelledby={`${id}-h`}>
      <div className="ev-section-head">
        <h2 id={`${id}-h`} className="h2">
          {title}
        </h2>
        <span className="ev-count num">{list.length}</span>
        <span className="small t3 ev-section-sub">{sub}</span>
      </div>
      {list.length ? (
        <div className="game-grid">
          {list.map((t) => {
            const g = cat.gameById.get(t.game_id)
            return g ? <EventCard key={t.id} t={t} game={g} entrants={counts.data?.get(t.id)?.entries} /> : null
          })}
        </div>
      ) : (
        <p className="t3 small">{empty}</p>
      )}
    </section>
  )
}

function Hero({ t, mine, entrants, signedIn }: { t: Tournament; mine: boolean; entrants?: number; signedIn: boolean }) {
  const cat = useCatalog()
  const g = cat.gameById.get(t.game_id)
  if (!g) return null
  const open = regOpen(t)
  const when = t.status === 'open' && t.reg_closes_at ? `CLOSES ${fmtShort(t.reg_closes_at)}` : t.starts_at ? `STARTS ${fmtShort(t.starts_at)}` : null
  return (
    <section className="hero holo" style={{ '--hue': gameHue(g) } as CSSProperties} aria-label="Featured event">
      <GameCover game={g} eager />
      <span className="holo-foil" aria-hidden />
      <span className="holo-glare" aria-hidden />
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
