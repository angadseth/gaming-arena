import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorBox, Skeleton, StatusPill } from '../../components/ui'
import { useAuth, useCatalog, useCounts } from '../../lib/app'
import { fmtDate, STATUS_LABEL } from '../../lib/format'
import type { TournamentStatus } from '../../lib/types'
import { AdminHeader, gap } from './shared'

const ORDER: TournamentStatus[] = ['live', 'open', 'upcoming', 'closed', 'draft', 'completed', 'cancelled']

export default function Overview() {
  const { profile } = useAuth()
  const cat = useCatalog()
  const counts = useCounts()

  if (cat.error) return <ErrorBox error={cat.error} />
  if (cat.loading) return <Skeleton h={240} />

  const byStatus = new Map<TournamentStatus, number>()
  for (const t of cat.tournaments) byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1)
  let entries = 0
  let players = 0
  counts.data?.forEach((c) => {
    entries += c.entries
    players += c.players
  })
  const active = cat.tournaments
    .filter((t) => t.status === 'open' || t.status === 'live' || t.status === 'closed')
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))

  return (
    <>
      <AdminHeader title="Admin console" sub={`Signed in as ${profile?.username ?? ''} · ${profile?.roles.join(', ') ?? ''}`} />
      <div className="stats">
        <div>
          <strong>{cat.tournaments.length}</strong>
          <span className="tag-type t3">Events</span>
        </div>
        <div>
          <strong>{counts.isPending ? '…' : entries}</strong>
          <span className="tag-type t3">Entries</span>
        </div>
        <div>
          <strong>{counts.isPending ? '…' : players}</strong>
          <span className="tag-type t3">Players</span>
        </div>
      </div>

      <div className="section-head">
        <h2>Events by status</h2>
      </div>
      <div className="row wrap">
        {ORDER.filter((s) => byStatus.get(s)).map((s) => (
          <span key={s} className="row" style={gap(8)}>
            <StatusPill status={s} />
            <span className="num">{byStatus.get(s)}</span>
            <span className="sr-only">{STATUS_LABEL[s]}</span>
          </span>
        ))}
      </div>

      <div className="section-head">
        <h2>Needs attention</h2>
        <Link to="/admin/events" className="small t2">
          All events
        </Link>
      </div>
      {active.length === 0 ? (
        <p className="t3">No event is open, live or waiting for results.</p>
      ) : (
        <div className="rows">
          {active.map((t) => {
            const g = cat.gameById.get(t.game_id)
            const c = counts.data?.get(t.id)
            return (
              <Link key={t.id} to={`/admin/events/${t.id}/results`} className="link-row">
                <div className="grow stack" style={gap(4)}>
                  <span className="ellipsis" style={{ fontWeight: 600 }}>
                    {t.title}
                  </span>
                  <span className="small t3">
                    {g?.title} · {c?.entries ?? 0} entries · closes {fmtDate(t.reg_closes_at)}
                  </span>
                </div>
                <StatusPill status={t.status} />
                <ChevronRight size={18} className="t3" aria-hidden />
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
