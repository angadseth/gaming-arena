import { FileClock, Gamepad2, Inbox, MapPinned, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StaffBadge } from '../../components/StaffBadge'
import { ErrorBox, Skeleton } from '../../components/ui'
import { useAuth, useCatalog, useCounts } from '../../lib/app'
import type { Tournament, TournamentStatus } from '../../lib/types'
import { AdminEventCard } from './EventCard'

const NOW: TournamentStatus[] = ['live', 'open', 'closed']

/**
 * Dashboard: who I am and what I can do, then the events as cards with their buttons.
 * Two groups only (open now, upcoming) so it reads at a glance; finished events live on Events.
 */
export default function Overview() {
  const { profile, isAdmin } = useAuth()
  const cat = useCatalog()
  const counts = useCounts()

  if (cat.error) return <ErrorBox error={cat.error} />
  if (cat.loading) return <Skeleton h={240} />

  const roles = profile?.roles ?? []
  const level = isAdmin ? 'Super Admin' : roles.includes('admin') ? 'Admin' : 'Organiser'
  const can = isAdmin
    ? ['Everything below', 'Games, players and roles', 'Requests and the log']
    : roles.includes('admin')
      ? ['Open or close events', 'Add results with @names', 'Fix points up or down', 'See registrations', 'Run the lobby']
      : ['Add results with @names', 'See registrations', 'Run the lobby']

  const byGame = (a: Tournament, b: Tournament) =>
    (cat.gameById.get(a.game_id)?.sort_order ?? 99) - (cat.gameById.get(b.game_id)?.sort_order ?? 99) || a.title.localeCompare(b.title)
  const live = cat.tournaments.filter((t) => NOW.includes(t.status)).sort((a, b) => NOW.indexOf(a.status) - NOW.indexOf(b.status) || byGame(a, b))
  const upcoming = cat.tournaments.filter((t) => t.status === 'upcoming').sort(byGame)
  const entries = (id: string) => counts.data?.get(id)?.entries ?? 0
  const total = [...(counts.data?.values() ?? [])].reduce((n, c) => n + c.entries, 0)

  const grid = (list: Tournament[], empty: string) =>
    list.length === 0 ? (
      <p className="t3 small">{empty}</p>
    ) : (
      <div className="aev-grid">
        {list.map((t) => (
          <AdminEventCard key={t.id} t={t} game={cat.gameById.get(t.game_id)} entries={entries(t.id)} />
        ))}
      </div>
    )

  return (
    <>
      <section className="dash-hello">
        <div className="stack" style={{ gap: 6, minWidth: 0 }}>
          <span className="tag-type t3">Control room</span>
          <h1 className="h2 ellipsis" style={{ textTransform: 'none' }}>
            Namaste, {profile?.username}
          </h1>
          <span className="row wrap" style={{ gap: 8 }}>
            <StaffBadge username={profile?.username} />
            {level === 'Organiser' && <span className="staff-badge is-org">Organiser</span>}
          </span>
        </div>
        <div className="dash-stats">
          <span>
            <b className="num">{live.length}</b>
            <small>open now</small>
          </span>
          <span>
            <b className="num">{upcoming.length}</b>
            <small>upcoming</small>
          </span>
          <span>
            <b className="num">{counts.isPending ? '…' : total}</b>
            <small>registered</small>
          </span>
        </div>
        <ul className="dash-can" aria-label={`What a ${level} can do`}>
          {can.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <div className="section-head">
        <h2>Open now</h2>
        <span className="small t3">{live.length}</span>
      </div>
      {grid(live, 'Nothing is open right now. Open an upcoming event below.')}

      <div className="section-head">
        <h2>Upcoming</h2>
        <span className="small t3">{upcoming.length}</span>
      </div>
      {grid(upcoming, 'No upcoming events.')}

      {isAdmin && (
        <>
          <div className="section-head">
            <h2>Only you</h2>
            <span className="small t3">Super Admin tools</span>
          </div>
          <div className="dash-tools">
            {[
              { to: '/admin/access', label: 'Team & access', Icon: ShieldCheck },
              { to: '/admin/games', label: 'Games', Icon: Gamepad2 },
              { to: '/admin/players', label: 'Players', Icon: Users },
              { to: '/admin/requests', label: 'Game requests', Icon: Inbox },
              { to: '/admin/regions', label: 'Regions', Icon: MapPinned },
              { to: '/admin/audit', label: 'Audit log', Icon: FileClock },
            ].map(({ to, label, Icon }) => (
              <Link key={to} to={to} className="dash-tool">
                <Icon size={20} strokeWidth={1.75} aria-hidden />
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
