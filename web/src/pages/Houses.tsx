import { Empty, ErrorBox, Flap, HouseTag, Skeleton } from '../components/ui'
import { useAuth, useCatalog, useHouseName, useHouseStandings } from '../lib/app'
import { fmtPoints, HOUSE_META } from '../lib/format'

export default function Houses() {
  const q = useHouseStandings(null)
  const houseName = useHouseName()
  const { profile } = useAuth()
  const cat = useCatalog()
  const completed = cat.tournaments.filter((t) => t.status === 'completed').length
  const rows = q.data ?? []
  const top = rows[0]?.points ?? 0
  const leader = top > 0 ? rows[0] : null

  return (
    <div className="page stack" style={{ gap: 24 }}>
      <header className="page-header contour stack" style={{ gap: 8 }}>
        <p className="tag-type t3">House standings · Season 1 · after {completed} {completed === 1 ? 'event' : 'events'}</p>
        <h1 className="display">{leader ? `${houseName(leader.house_id)} leads` : 'Twelve houses. One cup.'}</h1>
        <p className="lead" style={{ maxWidth: 620 }}>
          Every final placement earns points for the players' houses. Mixed-house teams split their points equally between each player's house.
        </p>
      </header>

      {q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : q.isPending ? (
        <div className="stack" style={{ gap: 2 }}>{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} h={64} />)}</div>
      ) : rows.length === 0 ? (
        <Empty title="No houses yet" text="Standings appear after the first completed event." />
      ) : (
        <div className="rows">
          {rows.map((r) => {
            const mine = profile?.house_id === r.house_id
            return (
              <div key={r.house_id} className={`lrow${mine ? ' mine-bar' : ''}`} style={{ minHeight: 72, position: 'relative' }}>
                <span className="rank num">{top > 0 ? <Flap value={r.rank} /> : '–'}</span>
                <span className="stack" style={{ gap: 6, minWidth: 0 }}>
                  <span className="row" style={{ gap: 10 }}>
                    <HouseTag id={r.house_id} />
                    <span className="ellipsis" style={{ fontWeight: 650, fontSize: 17 }}>{houseName(r.house_id)}</span>
                  </span>
                  <span className="small t3 ellipsis">{mine ? 'Your house · ' : ''}{HOUSE_META[r.house_id]?.park}</span>
                  <span className="bar" aria-hidden><span style={{ width: top > 0 ? `${(r.points / top) * 100}%` : '0%' }} /></span>
                </span>
                <span className="stat num">
                  <Flap value={fmtPoints(r.points)} tiles />
                  <small>{r.podiums} PODIUMS</small>
                </span>
              </div>
            )
          })}
        </div>
      )}
      <p className="small t3">Points: 1st 10 · 2nd 7 · 3rd 5 · 4th 4 · 5th–8th 2 · 9th–16th 1 by default; each event lists its own table.</p>
    </div>
  )
}
