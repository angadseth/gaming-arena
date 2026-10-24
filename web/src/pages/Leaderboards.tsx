import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, ErrorBox, GameCover, MetaLine, Skeleton, StatusPill } from '../components/ui'
import { useCatalog, useCounts } from '../lib/app'
import { fmtShort, teamSizeLabel } from '../lib/format'
import type { TournamentStatus } from '../lib/types'

const ORDER: Partial<Record<TournamentStatus, number>> = { live: 0, closed: 1, open: 2, completed: 3, upcoming: 4 }

export default function Leaderboards() {
  const cat = useCatalog()
  const counts = useCounts()
  const [game, setGame] = useState('all')

  const list = useMemo(
    () =>
      cat.tournaments
        .filter((t) => t.status !== 'draft' && t.status !== 'cancelled' && (game === 'all' || t.game_id === game))
        .sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || a.title.localeCompare(b.title)),
    [cat.tournaments, game],
  )

  return (
    <div className="page stack" style={{ gap: 20 }}>
      <section className="stack" style={{ gap: 6 }}>
        <h1 className="h1">Leaderboards</h1>
        <p className="t2">Standings for every event. Live and recently played events come first.</p>
      </section>

      <select className="select" style={{ maxWidth: 360 }} value={game} onChange={(e) => setGame(e.target.value)} aria-label="Filter by game">
        <option value="all">All games</option>
        {cat.games.filter((g) => g.is_active).map((g) => (
          <option key={g.id} value={g.id}>{g.title}</option>
        ))}
      </select>

      {cat.error ? (
        <ErrorBox error={cat.error} />
      ) : cat.loading ? (
        <div className="stack" style={{ gap: 2 }}>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={72} />)}</div>
      ) : list.length === 0 ? (
        <Empty title="No standings yet" text="Leaderboards appear here once events open." />
      ) : (
        <div className="rows">
          {list.map((t) => {
            const g = cat.gameById.get(t.game_id)
            if (!g) return null
            const c = counts.data?.get(t.id)
            return (
              <Link key={t.id} to={`/e/${t.slug}?tab=standings`} className="link-row">
                <div className="thumb"><GameCover game={g} /></div>
                <div className="grow stack" style={{ gap: 4, minWidth: 0 }}>
                  <span className="ellipsis" style={{ fontWeight: 600 }}>{t.title}</span>
                  <MetaLine parts={[teamSizeLabel(g), c ? `${c.entries} ${g.team_size > 1 ? 'TEAMS' : 'PLAYERS'}` : null, t.starts_at ? fmtShort(t.starts_at) : null]} />
                </div>
                <StatusPill status={t.status} />
                <ChevronRight size={18} className="t3" aria-hidden />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
