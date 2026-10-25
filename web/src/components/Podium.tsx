import { Crown } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Avatar } from './Avatar'
import { Flap, HouseTag } from './ui'
import { StaffBadge } from './StaffBadge'

export type PodiumEntry = { key: string; rank: number; name: string; avatar: string; house_id: number | null; points: string; sub?: string; mine?: boolean }

const PLACE = {
  1: { label: 'GOAT', ring: '#ffc23d' },
  2: { label: '2nd place', ring: '#dfe6f2' },
  3: { label: '3rd place', ring: '#e0915a' },
} as Record<number, { label: string; ring: string }>

/** Top three as trading cards: 2nd, 1st (raised, crowned), 3rd. */
export function Podium({ rows }: { rows: PodiumEntry[] }) {
  const top = rows.filter((r) => r.rank >= 1 && r.rank <= 3).slice(0, 3)
  if (top.length === 0) return null
  const order = [top.find((r) => r.rank === 2), top.find((r) => r.rank === 1), top.find((r) => r.rank === 3)]
  return (
    <ol className="podium" aria-label="Top three">
      {order.map((r, i) =>
        r ? (
          <li key={r.key} className={`podium-card p${r.rank}${r.mine ? ' mine' : ''}`} style={{ '--ring': PLACE[r.rank].ring } as CSSProperties}>
            {r.rank === 1 && <Crown className="podium-crown" size={30} strokeWidth={2} aria-hidden />}
            <span className="podium-label">{PLACE[r.rank].label}</span>
            <Avatar value={r.avatar} size={r.rank === 1 ? 76 : 60} ring={PLACE[r.rank].ring} />
            <strong className="podium-name ellipsis">{r.name}</strong>
            <StaffBadge username={r.name} />
            <HouseTag id={r.house_id} />
            <span className="podium-points"><Flap value={r.points} tiles /></span>
            <span className="podium-sub">{r.sub ?? 'points'}</span>
          </li>
        ) : (
          <li key={`empty-${i}`} className="podium-card empty" aria-hidden />
        ),
      )}
    </ol>
  )
}
