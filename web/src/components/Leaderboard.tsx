import { Link } from 'react-router-dom'
import { useStandings } from '../lib/app'
import { fmtPoints, regOpen } from '../lib/format'
import type { Game, Tournament } from '../lib/types'
import { MyRankCard, type MyRank } from './MyRankCard'
import { Podium } from './Podium'
import { Empty, ErrorBox, Skeleton } from './ui'

/**
 * Event standings, Angad's way (25 Oct): the top 3 as cards for everyone, and below them my own
 * rank card (rank of N, top %, points, gap to the next place). The full list stays with staff
 * (admin Results page).
 */
export function Leaderboard({ t, game }: { t: Tournament; game: Game }) {
  const q = useStandings(t.id)
  const br = Number(t.kill_points) > 0

  if (q.isPending) return <Skeleton h={320} r={16} />
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />
  const all = q.data ?? []
  if (!all.length) {
    return (
      <Empty
        title="Nobody on the board yet"
        text={regOpen(t) ? 'Register and your card shows up here.' : 'Entries will appear here once registration opens.'}
        action={regOpen(t) ? <Link className="btn btn-secondary" to={`/e/${t.slug}/register`}>Register</Link> : undefined}
      />
    )
  }

  const scored = all.some((r) => r.matches > 0)
  const active = all.filter((r) => r.status === 'active')
  const mine = all.find((r) => r.is_mine)
  const winsLabel = br ? 'WWCD' : 'wins'

  let me: MyRank | null = null
  if (mine) {
    const rank = scored && mine.status === 'active' ? mine.rank : null
    const above =
      rank != null && rank > 1
        ? active.filter((x) => x.rank != null && x.rank < rank).sort((a, b) => b.rank! - a.rank!)[0] ?? null
        : null
    const second = rank === 1 ? (active.find((x) => x.rank === 2)?.points ?? null) : null
    me = {
      rank,
      total: active.length,
      points: mine.points,
      above: above ? { rank: above.rank!, points: above.points } : null,
      second,
      name: mine.name,
      avatar: mine.avatar,
      dq: mine.status === 'disqualified',
      stats: [
        { label: 'games', value: mine.matches },
        { label: winsLabel, value: mine.wins },
        ...(br ? [{ label: 'finishes', value: mine.kills }] : []),
        ...(mine.best_placement != null ? [{ label: 'best place', value: `#${mine.best_placement}` }] : []),
      ],
    }
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {scored ? (
        <Podium
          rows={active
            .filter((r) => r.rank != null && r.rank <= 3)
            .map((r) => ({
              key: r.entry_id, rank: r.rank!, name: r.name, avatar: r.avatar, house_id: r.house_id,
              points: fmtPoints(r.points), sub: `${r.wins} ${r.wins === 1 ? (br ? 'WWCD' : 'win') : winsLabel}${game.team_size > 1 ? ` · ${r.kills} kills` : ''}`, mine: r.is_mine,
            }))}
        />
      ) : (
        <p className="lb-wait small t2">
          <b className="num t1">{active.length}</b> {game.team_size > 1 ? 'teams' : 'players'} registered. The top 3 show up here after the first game.
        </p>
      )}
      <MyRankCard
        me={me}
        board={t.title}
        empty={
          <span className="stack" style={{ gap: 4 }}>
            <b>You are not in this event</b>
            <span className="small t2">
              {regOpen(t) ? (
                <>
                  <Link to={`/e/${t.slug}/register`} style={{ textDecoration: 'underline' }}>Register</Link> to get your own rank card.
                </>
              ) : (
                'Join the next one to get your own rank card.'
              )}
            </span>
          </span>
        }
      />
    </div>
  )
}
