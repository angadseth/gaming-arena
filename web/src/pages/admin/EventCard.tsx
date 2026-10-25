import { ClipboardList, DoorClosed, DoorOpen, ListOrdered, PencilLine, RadioTower } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { StatusPill } from '../../components/ui'
import { useAction, useAuth, useToast } from '../../lib/app'
import { fmtDate, gameHue } from '../../lib/format'
import type { Game, Tournament } from '../../lib/types'

const INVALIDATE = [['tournaments'], ['counts']]

/**
 * One event as a card for the admin dashboard and events page: status, entries, and every
 * job an admin has for it as a button (open/close, results, registrations, lobby).
 */
export function AdminEventCard({ t, game, entries }: { t: Tournament; game: Game | undefined; entries: number }) {
  const { isAdmin, canManageEvents } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const setStatus = useAction((a, status: 'open' | 'closed') => a.rpc('admin_set_event_status', { p_tournament_id: t.id, p_status: status }), INVALIDATE)

  const canToggle = canManageEvents && ['upcoming', 'open', 'closed'].includes(t.status)
  const isOpen = t.status === 'open'
  const closesPassed = !!t.reg_closes_at && new Date(t.reg_closes_at).getTime() < Date.now()

  // The card flips at once; the server answer (or a failure) settles it a moment later.
  const toggle = () => {
    const next = isOpen ? 'closed' : 'open'
    qc.setQueryData<Tournament[]>(['tournaments'], (list) => list?.map((x) => (x.id === t.id ? { ...x, status: next } : x)))
    setStatus.mutate(next, {
      onSuccess: () => toast({ kind: 'success', text: isOpen ? `${t.title}: registration closed` : `${t.title}: registration open` }),
      onError: () => qc.invalidateQueries({ queryKey: ['tournaments'] }),
    })
  }

  return (
    <article className="aev" style={{ '--hue': gameHue(game) } as CSSProperties}>
      <div className="aev-top">
        <span className="aev-game">{game?.short || game?.title || 'Game'}</span>
        <StatusPill status={t.status} />
      </div>
      <h3 className="aev-title ellipsis">{t.title}</h3>
      <p className="aev-meta small t3">
        <b className="num t1">{entries}</b> registered · closes {fmtDate(t.reg_closes_at)}
      </p>
      {canToggle && (
        <button className={`aev-toggle${isOpen ? ' is-open' : ''}`} disabled={setStatus.isPending} onClick={toggle}>
          {isOpen ? <DoorClosed size={16} aria-hidden /> : <DoorOpen size={16} aria-hidden />}
          {isOpen ? 'Close registration' : 'Open registration'}
        </button>
      )}
      {canToggle && !isOpen && closesPassed && <p className="aev-warn small">Close time has passed: ask Angad to move the date, or players still cannot register.</p>}
      <div className="aev-actions">
        <Link to={`/admin/events/${t.id}/results`}>
          <ListOrdered size={16} aria-hidden /> Results
        </Link>
        <Link to={`/admin/events/${t.id}/registrations`}>
          <ClipboardList size={16} aria-hidden /> Players
        </Link>
        <Link to={`/admin/events/${t.id}/lobby`}>
          <RadioTower size={16} aria-hidden /> Lobby
        </Link>
        {isAdmin && (
          <Link to={`/admin/events/${t.id}`}>
            <PencilLine size={16} aria-hidden /> Edit
          </Link>
        )}
      </div>
    </article>
  )
}
