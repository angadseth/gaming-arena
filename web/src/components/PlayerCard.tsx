import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, Crown, Lock, Medal, Sparkles, Zap } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import { useApi, useAuth } from '../lib/app'
import type { PlayerCardData } from '../lib/types'
import { Skeleton } from './ui'

export const BADGES: Record<string, { name: string; how: string; Icon: ComponentType<{ size?: number; strokeWidth?: number }> }> = {
  debut: { name: 'Debut', how: 'Play your first game', Icon: Sparkles },
  regular: { name: 'Regular', how: 'Check in to 3 events', Icon: CalendarCheck },
  game_winner: { name: 'Game winner', how: 'Win any single game', Icon: Zap },
  podium: { name: 'Podium', how: 'Finish top 3 in an event', Icon: Medal },
  champion: { name: 'Champion', how: 'Win an event', Icon: Crown },
}

export const usePlayerCard = (username?: string) => {
  const api = useApi()
  const { session } = useAuth()
  return useQuery({
    queryKey: ['player-card', username ?? session?.userId],
    queryFn: () => api.rpc<PlayerCardData | null>('player_card', username ? { p_username: username } : {}),
    staleTime: 60_000,
  })
}

/** Level, XP bar to the next level, and the badge shelf (locked ones say how to unlock). */
export function PlayerCard({ username }: { username?: string }) {
  const card = usePlayerCard(username)
  if (card.isPending) return <Skeleton h={180} r={16} />
  const c = card.data
  if (!c) return null
  const span = c.next_level_at ? c.next_level_at - c.level_floor : 1
  const pct = c.next_level_at ? Math.min(100, Math.round(((c.xp - c.level_floor) / span) * 100)) : 100
  return (
    <section className="lobby-card pcard">
      <div className="spread" style={{ gap: 12 }}>
        <div>
          <span className="tag-type t3">Arena level</span>
          <div className={`level-chip lv-${c.level.toLowerCase()}`}>{c.level}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="tag-type t3">XP</span>
          <div className="xp num">{c.xp.toLocaleString('en-IN')}</div>
        </div>
      </div>
      <div className="xp-bar" style={{ '--p': `${pct}%` } as CSSProperties} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span />
      </div>
      <p className="small t3">
        {c.next_level_at ? `${(c.next_level_at - c.xp).toLocaleString('en-IN')} XP to the next level` : 'Top level reached'} · every game pays XP, every check-in +100
      </p>
      <div className="badge-grid">
        {c.badges.map((b) => {
          const meta = BADGES[b.key]
          if (!meta) return null
          return (
            <div key={b.key} className={`badge${b.have ? ' is-have' : ''}`} title={b.have ? meta.name : `Locked: ${meta.how}`}>
              <span className="badge-icon">{b.have ? <meta.Icon size={18} strokeWidth={2} /> : <Lock size={14} strokeWidth={2} />}</span>
              <b>{meta.name}</b>
              <small>{b.have ? (b.count > 1 ? `×${b.count}` : 'Unlocked') : meta.how}</small>
            </div>
          )
        })}
      </div>
    </section>
  )
}
