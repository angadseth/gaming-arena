import { ArrowUpDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStandings } from '../lib/app'
import { fmtPoints, regOpen } from '../lib/format'
import type { Game, StandingRow, Tournament } from '../lib/types'
import { Empty, ErrorBox, Flap, HouseTag, Sheet, Skeleton } from './ui'

type SortKey = 'rank' | 'wins' | 'kills' | 'name'

export function Leaderboard({ t, game }: { t: Tournament; game: Game }) {
  const q = useStandings(t.id)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('rank')
  const [sortOpen, setSortOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [mineVisible, setMineVisible] = useState(true)
  const mineRef = useRef<HTMLDivElement | null>(null)
  const br = Number(t.kill_points) > 0 // battle royale: show WWCD + finishes
  const team = game.team_size > 1

  const rows = useMemo(() => {
    let list = q.data ?? []
    const term = query.trim().toLowerCase()
    if (term) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(term) || r.members?.some((m) => m.username.toLowerCase().includes(term)),
      )
    }
    const by: Record<SortKey, (a: StandingRow, b: StandingRow) => number> = {
      rank: () => 0,
      wins: (a, b) => b.wins - a.wins || b.points - a.points,
      kills: (a, b) => b.kills - a.kills || b.points - a.points,
      name: (a, b) => a.name.localeCompare(b.name),
    }
    return sort === 'rank' ? list : [...list].sort(by[sort])
  }, [q.data, query, sort])

  const mine = q.data?.find((r) => r.is_mine)

  useEffect(() => {
    const el = mineRef.current
    if (!el) {
      setMineVisible(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setMineVisible(e.isIntersecting), { rootMargin: '-56px 0px -80px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [rows, mine?.entry_id])

  if (q.isPending) {
    return (
      <div className="stack" style={{ gap: 2 }}>
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={60} />)}
      </div>
    )
  }
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />
  if (!q.data?.length) {
    return (
      <Empty
        title="Nobody on the board yet"
        text={regOpen(t) ? 'Registrations show up here as they come in.' : 'Entries will appear here once registration opens.'}
        action={regOpen(t) ? <Link className="btn btn-secondary" to={`/e/${t.slug}/register`}>Register</Link> : undefined}
      />
    )
  }

  const scored = q.data.some((r) => r.matches > 0)
  const sortLabel: Record<SortKey, string> = { rank: 'Rank', wins: br ? 'WWCD' : 'Wins', kills: 'Finishes', name: 'Name' }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row">
        <div style={{ position: 'relative' }} className="grow">
          <Search size={18} className="t3" style={{ position: 'absolute', left: 12, top: 15 }} aria-hidden />
          <input
            className="input"
            style={{ paddingLeft: 38 }}
            type="search"
            placeholder={team ? 'Search team or player' : 'Search player'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the leaderboard"
          />
        </div>
        <button className="btn btn-secondary" onClick={() => setSortOpen(true)} aria-label={`Sort by ${sortLabel[sort]}`}>
          <ArrowUpDown size={18} aria-hidden />
          <span className="tag-type">{sortLabel[sort]}</span>
        </button>
      </div>

      {!scored && <p className="small t3">No matches played yet. Entries are listed by registration; ranks appear after the first result.</p>}

      {rows.length === 0 ? (
        <Empty title={`No match for '${query}'`} text="Check the spelling, or search by a teammate's username." />
      ) : (
        <div className="rows" role="table" aria-label="Standings">
          <div className="lrow" role="row" style={{ minHeight: 36, paddingTop: 6, paddingBottom: 6 }}>
            <span className="tag-type t3" style={{ textAlign: 'center' }} role="columnheader">#</span>
            <span className="tag-type t3" role="columnheader">{team ? 'Team' : 'Player'}</span>
            <span className="tag-type t3" style={{ textAlign: 'right' }} role="columnheader">PTS</span>
          </div>
          {rows.map((r) => (
            <Row
              key={r.entry_id}
              r={r}
              br={br}
              team={team}
              open={expanded === r.entry_id}
              toggle={() => setExpanded(expanded === r.entry_id ? null : r.entry_id)}
              innerRef={r.is_mine ? (el) => { mineRef.current = el } : undefined}
              scored={scored}
            />
          ))}
        </div>
      )}

      {mine && !mineVisible && (
        <button
          className="my-pos lrow mine-bar"
          style={{ border: 0, textAlign: 'left', width: 'auto' }}
          onClick={() => {
            mineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            mineRef.current?.classList.add('flash')
            window.setTimeout(() => mineRef.current?.classList.remove('flash'), 1300)
          }}
        >
          <span className="rank num">{scored && mine.rank ? mine.rank : '–'}</span>
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <span className="tag-type t3">You</span>
            <span className="ellipsis" style={{ fontWeight: 600 }}>{mine.name}</span>
          </span>
          <span className="stat num">{fmtPoints(mine.points)}</span>
        </button>
      )}

      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        <div className="rows">
          {(Object.keys(sortLabel) as SortKey[]).map((k) => (
            <label key={k} className="link-row" style={{ cursor: 'pointer' }}>
              <input type="radio" name="sort" checked={sort === k} onChange={() => { setSort(k); setSortOpen(false) }} style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} />
              <span>{k === 'rank' ? 'Rank (points)' : sortLabel[k]}</span>
            </label>
          ))}
        </div>
      </Sheet>
    </div>
  )
}

function Row({
  r, br, team, open, toggle, innerRef, scored,
}: { r: StandingRow; br: boolean; team: boolean; open: boolean; toggle: () => void; innerRef?: (el: HTMLDivElement | null) => void; scored: boolean }) {
  const top = r.rank != null && r.rank <= 3 && scored
  const second = br ? `${r.wins} WWCD · ${r.kills} FIN` : `${r.matches} M · ${r.wins} W`
  return (
    <div ref={innerRef} role="row">
      <button
        className={`lrow${top ? ' top' : ''}${r.is_mine ? ' mine' : ''}${r.status === 'disqualified' ? ' dq' : ''}`}
        style={{ width: '100%', textAlign: 'left' }}
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="rank" role="cell">{r.status === 'disqualified' ? 'DQ' : scored && r.rank ? <Flap value={r.rank} /> : '–'}</span>
        <span className="stack" style={{ gap: 3, minWidth: 0 }} role="cell">
          <span className="ellipsis" style={{ fontWeight: 600 }}>
            {r.name}
            {r.is_mine && <span className="tag-type t3" style={{ marginLeft: 8 }}>YOU</span>}
          </span>
          <span className="row" style={{ gap: 8 }}>
            <HouseTag id={r.house_id} />
            {team && <span className="small t3">{r.members?.length ?? 0} players</span>}
          </span>
        </span>
        <span className="stat" role="cell">
          <Flap value={fmtPoints(r.points)} />
          {scored && <small>{second}</small>}
        </span>
      </button>
      {open && (
        <div className="lrow-detail">
          <span>Matches <strong className="num" style={{ color: 'var(--text-1)' }}>{r.matches}</strong></span>
          <span>{br ? 'WWCD' : 'Wins'} <strong className="num" style={{ color: 'var(--text-1)' }}>{r.wins}</strong></span>
          {br && <span>Finishes <strong className="num" style={{ color: 'var(--text-1)' }}>{r.kills}</strong></span>}
          {r.best_placement != null && <span>Best place <strong className="num" style={{ color: 'var(--text-1)' }}>#{r.best_placement}</strong></span>}
          {team && r.members && (
            <span style={{ flexBasis: '100%' }}>
              Roster: {r.members.map((m) => (m.role === 'captain' ? `${m.username} (C)` : m.role === 'sub' ? `${m.username} (sub)` : m.username)).join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
