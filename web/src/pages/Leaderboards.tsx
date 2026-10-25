import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MyRankCard, type MyRank } from '../components/MyRankCard'
import { Podium } from '../components/Podium'
import { Empty, ErrorBox, GameCover, MetaLine, Skeleton, StatusPill } from '../components/ui'
import { useCatalog, useCounts, usePlayerRankings } from '../lib/app'
import { fmtPoints, fmtShort, teamSizeLabel } from '../lib/format'
import type { RankFormat, TournamentStatus } from '../lib/types'

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
        <p className="t2">The top 3 of every board, and your own rank right under them.</p>
      </section>

      <TopPlayers />

      <div className="section-head"><h2>Event standings</h2></div>

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

const FORMATS: { key: RankFormat; label: string }[] = [
  { key: 'all', label: 'All games' },
  { key: 'solo', label: 'Solo' },
  { key: 'small', label: 'Duo & 3v3' },
  { key: 'squad', label: 'Squads & 5v5' },
]

/** Overall player rankings: the top 3 as cards, then my own rank card (rank of N, top %, points). */
function TopPlayers() {
  const [format, setFormat] = useState<RankFormat>('all')
  const q = usePlayerRankings(format)
  const rows = q.data ?? []
  const mine = rows.find((r) => r.is_me)
  // Before migration 0015 the server sends no total: fall back to the rows it sent.
  const total = rows[0]?.total || rows.length
  const above = mine && mine.rank > 1 ? rows.filter((r) => r.rank < mine.rank).sort((a, b) => b.rank - a.rank)[0] : undefined
  const me: MyRank | null = mine
    ? {
        rank: mine.rank,
        total,
        points: mine.points,
        above: above && above.rank === mine.rank - 1 ? { rank: above.rank, points: above.points } : null,
        second: mine.rank === 1 ? (rows.find((r) => r.rank === 2)?.points ?? null) : null,
        name: mine.username,
        avatar: mine.avatar,
        stats: [
          { label: 'events', value: mine.events },
          { label: 'podiums', value: mine.podiums },
          { label: 'wins', value: mine.firsts },
        ],
      }
    : null
  return (
    <section className="stack" style={{ gap: 14 }}>
      <div className="section-head"><h2>Top players</h2></div>
      <div className="chips" role="group" aria-label="Game format">
        {FORMATS.map((f) => (
          <button key={f.key} className="chip" aria-pressed={format === f.key} onClick={() => setFormat(f.key)}>{f.label}</button>
        ))}
      </div>
      {q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : q.isPending ? (
        <Skeleton h={240} r={16} />
      ) : rows.length === 0 ? (
        <Empty title="No champions yet" text="Rankings fill up as events finish. Win one and your card goes up here." />
      ) : (
        <>
          <Podium
            rows={rows
              .filter((r) => r.rank <= 3)
              .map((r) => ({
                key: r.username, rank: r.rank, name: r.username, avatar: r.avatar, house_id: r.house_id,
                points: fmtPoints(r.points), sub: `${r.firsts} wins · ${r.podiums} podiums`, mine: r.is_me,
              }))}
          />
          <MyRankCard
            me={me}
            board="the IITM BS Top Players"
            empty={
              <span className="stack" style={{ gap: 4 }}>
                <b>No rank yet</b>
                <span className="small t2">Finish an event and your own rank card shows up here.</span>
              </span>
            }
          />
        </>
      )}
    </section>
  )
}
