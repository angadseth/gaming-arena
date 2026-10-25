import { Share2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth, useToast } from '../lib/app'
import { fmtPoints } from '../lib/format'
import { Avatar } from './Avatar'

export interface MyRank {
  rank: number | null
  total: number
  points: number
  /** Points of the place just above me, to show the gap; null when I lead. */
  above: { rank: number; points: number } | null
  /** Points of #2 when I lead, for the lead margin. */
  second: number | null
  stats: { label: string; value: string | number }[]
  name: string
  avatar?: string
  dq?: boolean
}

const pct = (rank: number, total: number) => Math.max(1, Math.ceil((rank / Math.max(total, 1)) * 100))

/**
 * Your own result, LinkedIn-games style: big rank, "of N players", top X %, points, the gap to
 * the next place and a share button. The top 3 stay above as podium cards for everyone.
 */
export function MyRankCard({ me, board, empty }: { me: MyRank | null; board: string; empty?: ReactNode }) {
  const { session } = useAuth()
  const loc = useLocation()
  const toast = useToast()

  if (!session) {
    return (
      <section className="myrank is-empty" aria-label="Your rank">
        <span className="myrank-q num">#?</span>
        <span className="stack" style={{ gap: 4 }}>
          <b>Where do you stand?</b>
          <span className="small t2">Sign in to see your own rank and points.</span>
        </span>
        <Link className="btn btn-primary btn-sm" to={`/signin?next=${encodeURIComponent(loc.pathname + loc.search)}`}>
          Sign in
        </Link>
      </section>
    )
  }
  if (!me) return <section className="myrank is-empty" aria-label="Your rank">{empty}</section>

  const ranked = me.rank != null && !me.dq
  const top = ranked ? pct(me.rank!, me.total) : null
  const gap = !ranked
    ? me.dq
      ? 'Disqualified in this event'
      : 'Your rank shows after the first game'
    : me.rank === 1
      ? me.second != null
        ? `Leading by ${fmtPoints(me.points - me.second)} pts`
        : 'You are on top'
      : me.above
        ? `${fmtPoints(me.above.points - me.points)} pts to #${me.above.rank}`
        : ''

  const share = async () => {
    const text = ranked
      ? `I'm #${me.rank} of ${me.total} on ${board} with ${fmtPoints(me.points)} points. Gaming Arena, IITM BS`
      : `I'm playing ${board} on Gaming Arena, IITM BS`
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ text, url })
      else {
        await navigator.clipboard.writeText(`${text} ${url}`)
        toast({ kind: 'success', text: 'Copied. Paste it anywhere.' })
      }
    } catch {
      /* share sheet closed */
    }
  }

  return (
    <section className={`myrank${ranked && me.rank! <= 3 ? ` p${me.rank}` : ''}`} aria-label="Your rank">
      <div className="myrank-head">
        {me.avatar && <Avatar value={me.avatar} size={36} />}
        <span className="stack" style={{ gap: 0, minWidth: 0 }}>
          <span className="tag-type t3">Your rank</span>
          <b className="ellipsis">{me.name}</b>
        </span>
        <button className="icon-btn myrank-share" onClick={share} aria-label="Share my rank" title="Share">
          <Share2 size={18} strokeWidth={1.75} />
        </button>
      </div>
      <div className="myrank-main">
        <span className="myrank-num num">{ranked ? `#${me.rank}` : me.dq ? 'DQ' : '–'}</span>
        <span className="stack" style={{ gap: 4 }}>
          {ranked && <span className="t2">of {me.total.toLocaleString('en-IN')} {me.total === 1 ? 'player' : 'players'}</span>}
          {top != null && <span className="myrank-top">Top {top}%</span>}
        </span>
        <span className="myrank-pts">
          <b className="num">{fmtPoints(me.points)}</b>
          <small>points</small>
        </span>
      </div>
      {me.stats.length > 0 && (
        <div className="myrank-stats">
          {me.stats.map((s) => (
            <span key={s.label}>
              <b className="num">{s.value}</b>
              <small>{s.label}</small>
            </span>
          ))}
        </div>
      )}
      {gap && <p className="myrank-gap small">{gap}</p>}
    </section>
  )
}
