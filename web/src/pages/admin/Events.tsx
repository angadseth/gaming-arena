import { ClipboardList, ListOrdered, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Empty, ErrorBox, Field, Skeleton, StatusPill } from '../../components/ui'
import { useAction, useAuth, useCatalog, useCounts, useToast, useTournaments } from '../../lib/app'
import { fmtDate, STATUS_LABEL } from '../../lib/format'
import type { Tournament, TournamentStatus } from '../../lib/types'
import { AdminHeader, ConfirmSheet, gap, isoToIstInput, istInputToIso, parseJson, ReadOnlyNote } from './shared'

const FILTERS: (TournamentStatus | 'all')[] = ['all', 'draft', 'upcoming', 'open', 'closed', 'live', 'completed', 'cancelled']
const INVALIDATE = [['tournaments'], ['counts'], ['standings'], ['house-standings']]

export default function Events() {
  const cat = useCatalog()
  const counts = useCounts()
  const { isAdmin } = useAuth()
  const [filter, setFilter] = useState<TournamentStatus | 'all'>('all')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return cat.tournaments
      .filter((t) => filter === 'all' || t.status === filter)
      .filter((t) => !needle || t.title.toLowerCase().includes(needle) || t.slug.includes(needle))
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  }, [cat.tournaments, filter, q])

  if (cat.error) return <ErrorBox error={cat.error} />
  return (
    <>
      <AdminHeader
        title="Events"
        sub="Tournaments players register for. Drafts are invisible to players."
        actions={
          isAdmin && (
            <Link to="/admin/events/new" className="btn btn-primary btn-sm">
              <Plus size={16} aria-hidden /> New event
            </Link>
          )
        }
      />
      <input className="input" placeholder="Search events" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
      <div className="chips">
        {FILTERS.map((s) => (
          <button key={s} className="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {cat.loading ? (
        <Skeleton h={300} />
      ) : list.length === 0 ? (
        <Empty title="No events here" text="Change the filter or create an event." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Event</th>
                <th>Game</th>
                <th>Status</th>
                <th>Closes (IST)</th>
                <th className="n">Entries</th>
                <th className="n">Players</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const c = counts.data?.get(t.id)
                return (
                  <tr key={t.id}>
                    <td>
                      <Link to={`/admin/events/${t.id}`} style={{ fontWeight: 600 }}>
                        {t.title}
                      </Link>
                      <div className="small t3 num">{t.slug}</div>
                    </td>
                    <td>{cat.gameById.get(t.game_id)?.short || cat.gameById.get(t.game_id)?.title}</td>
                    <td>
                      <StatusPill status={t.status} />
                    </td>
                    <td className="small">{fmtDate(t.reg_closes_at)}</td>
                    <td className="n">{c?.entries ?? 0}</td>
                    <td className="n">{c?.players ?? 0}</td>
                    <td>
                      <div className="row" style={gap(4)}>
                        <Link className="icon-btn" to={`/admin/events/${t.id}/registrations`} aria-label="Registrations" title="Registrations">
                          <ClipboardList size={18} strokeWidth={1.75} />
                        </Link>
                        <Link className="icon-btn" to={`/admin/events/${t.id}/results`} aria-label="Results" title="Results">
                          <ListOrdered size={18} strokeWidth={1.75} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

interface Form {
  game_id: string
  slug: string
  title: string
  season: string
  summary: string
  status: TournamentStatus
  reg_opens_at: string
  reg_closes_at: string
  starts_at: string
  max_entries: string
  same_house_teams: boolean
  placement_points: string
  kill_points: string
  house_points: string
  contact_note: string
}

const EMPTY: Form = {
  game_id: '', slug: '', title: '', season: 'S1', summary: '', status: 'draft', reg_opens_at: '', reg_closes_at: '',
  starts_at: '', max_entries: '', same_house_teams: false, placement_points: '', kill_points: '',
  house_points: '{"1": 10, "2": 7, "3": 5, "4": 4, "5-8": 2, "9-16": 1}', contact_note: '',
}

function toForm(t: Tournament): Form {
  return {
    game_id: t.game_id, slug: t.slug, title: t.title, season: t.season, summary: t.summary, status: t.status,
    reg_opens_at: isoToIstInput(t.reg_opens_at), reg_closes_at: isoToIstInput(t.reg_closes_at), starts_at: isoToIstInput(t.starts_at),
    max_entries: t.max_entries == null ? '' : String(t.max_entries), same_house_teams: t.same_house_teams,
    placement_points: JSON.stringify(t.placement_points), kill_points: String(t.kill_points),
    house_points: JSON.stringify(t.house_points), contact_note: t.contact_note,
  }
}

/** Status moves offered as one-click buttons; "confirm" ones need the slug typed. */
const MOVES: { to: TournamentStatus; label: string; confirm?: boolean; from: TournamentStatus[] }[] = [
  { to: 'upcoming', label: 'Announce', from: ['draft'] },
  { to: 'open', label: 'Open registration', from: ['draft', 'upcoming', 'closed'] },
  { to: 'closed', label: 'Close registration', from: ['open'] },
  { to: 'live', label: 'Go live', from: ['closed', 'open'] },
  { to: 'completed', label: 'Mark completed', confirm: true, from: ['live', 'closed'] },
  { to: 'cancelled', label: 'Cancel event', confirm: true, from: ['draft', 'upcoming', 'open', 'closed', 'live'] },
  { to: 'live', label: 'Reopen as live', confirm: true, from: ['completed'] },
]

/** Keyed by id so moving between events remounts the form with fresh state. */
export function EventEditor() {
  const { id } = useParams()
  return <EventForm key={id ?? 'new'} id={id} />
}

function EventForm({ id }: { id: string | undefined }) {
  const isNew = !id
  const cat = useCatalog()
  const tq = useTournaments()
  const counts = useCounts()
  const toast = useToast()
  const nav = useNavigate()
  const { isAdmin } = useAuth()
  const existing = cat.tournaments.find((t) => t.id === id)
  const [f, setF] = useState<Form>(EMPTY)
  const [loaded, setLoaded] = useState(isNew)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<TournamentStatus | null>(null)

  useEffect(() => {
    if (existing && !loaded) {
      setF(toForm(existing))
      setLoaded(true)
    }
  }, [existing, loaded])

  const save = useAction((a, p: Record<string, unknown>) => a.rpc<string>('admin_upsert_tournament', { p }), INVALIDATE)

  if (!isNew && !existing && (cat.loading || tq.isFetching)) return <Skeleton h={400} />
  if (!isNew && !existing) return <Empty title="Event not found" text="It may have been removed." />

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }))
  const game = cat.gameById.get(f.game_id)

  function build(statusOverride?: TournamentStatus): Record<string, unknown> | null {
    const e: Record<string, string> = {}
    if (!f.game_id) e.game_id = 'Pick a game'
    if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(f.slug)) e.slug = '2-60 characters: a-z, 0-9 and -'
    if (f.title.trim().length < 2) e.title = 'Required'
    const [pp, ppErr] = f.placement_points.trim() ? parseJson<Record<string, number>>(f.placement_points, 'object') : [null, null]
    if (ppErr) e.placement_points = ppErr
    const [hp, hpErr] = parseJson<Record<string, number>>(f.house_points, 'object')
    if (hpErr) e.house_points = hpErr
    const opens = istInputToIso(f.reg_opens_at)
    const closes = istInputToIso(f.reg_closes_at)
    if (opens && closes && opens >= closes) e.reg_closes_at = 'Must be after registration opens'
    if (f.max_entries && !(Number(f.max_entries) >= 2)) e.max_entries = 'At least 2, or empty for no limit'
    setErrs(e)
    if (Object.keys(e).length) {
      toast({ kind: 'error', text: 'Fix the highlighted fields.' })
      return null
    }
    const p: Record<string, unknown> = {
      id: id ?? '',
      game_id: f.game_id,
      slug: f.slug.trim(),
      title: f.title.trim(),
      season: f.season.trim() || 'S1',
      summary: f.summary.trim(),
      status: statusOverride ?? f.status,
      reg_opens_at: opens,
      reg_closes_at: closes,
      starts_at: istInputToIso(f.starts_at),
      max_entries: f.max_entries,
      same_house_teams: f.same_house_teams,
      house_points: hp,
      contact_note: f.contact_note.trim(),
    }
    // Empty points fields on a new event inherit the game's defaults.
    if (pp) p.placement_points = pp
    if (f.kill_points.trim()) p.kill_points = Number(f.kill_points)
    return p
  }

  function submit(statusOverride?: TournamentStatus) {
    const p = build(statusOverride)
    if (!p) return
    save.mutate(p, {
      onSuccess: (newId) => {
        if (statusOverride) set('status', statusOverride)
        setPending(null)
        toast({ kind: 'success', text: statusOverride ? `Status: ${STATUS_LABEL[statusOverride]}` : isNew ? 'Event created.' : 'Event saved.' })
        if (isNew && newId) nav(`/admin/events/${newId}`, { replace: true })
      },
    })
  }

  const c = id ? counts.data?.get(id) : undefined
  const moves = isNew ? [] : MOVES.filter((m) => m.from.includes(existing!.status))
  const pendingMove = MOVES.find((m) => m.to === pending && existing && m.from.includes(existing.status))

  return (
    <>
      <AdminHeader
        title={isNew ? 'New event' : f.title || 'Event'}
        sub={<Link to="/admin/events">Back to events</Link>}
        actions={
          !isNew && (
            <>
              <StatusPill status={existing!.status} />
              <Link to={`/admin/events/${id}/registrations`} className="btn btn-secondary btn-sm">
                <ClipboardList size={16} aria-hidden /> Registrations ({c?.entries ?? 0})
              </Link>
              <Link to={`/admin/events/${id}/results`} className="btn btn-secondary btn-sm">
                <ListOrdered size={16} aria-hidden /> Results
              </Link>
              <Link to={`/e/${existing!.slug}`} className="btn btn-ghost btn-sm">
                Public page
              </Link>
            </>
          )
        }
      />
      {!isAdmin && <ReadOnlyNote />}

      {isAdmin && moves.length > 0 && (
        <div className="panel stack" style={gap(10)}>
          <span className="tag-type t3">Change status</span>
          <div className="row wrap" style={gap(8)}>
            {moves.map((m) => (
              <Button
                key={m.label}
                size="sm"
                kind={m.to === 'cancelled' ? 'danger' : 'secondary'}
                busy={save.isPending && pending === m.to}
                onClick={() => {
                  setPending(m.to)
                  if (!m.confirm) submit(m.to)
                }}
              >
                {m.label}
              </Button>
            ))}
          </div>
          <p className="hint">
            Registration is accepted only while the status is Open and the time is inside the registration window. Completing an event awards
            house points from its final standings.
          </p>
        </div>
      )}

      <div className="section-head">
        <h2>Basics</h2>
      </div>
      <div className="form-grid two">
        <Field label="Game" error={errs.game_id} htmlFor="t-game">
          <select id="t-game" className="select" value={f.game_id} disabled={!isAdmin} onChange={(e) => set('game_id', e.target.value)}>
            <option value="">Pick a game</option>
            {cat.games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title" error={errs.title} htmlFor="t-title">
          <input id="t-title" className="input" value={f.title} disabled={!isAdmin} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Slug" error={errs.slug} hint="Public link: /e/slug" htmlFor="t-slug">
          <input id="t-slug" className="input num" value={f.slug} disabled={!isAdmin} onChange={(e) => set('slug', e.target.value.toLowerCase())} />
        </Field>
        <Field label="Season" hint="House standings group by season" htmlFor="t-season">
          <input id="t-season" className="input" value={f.season} disabled={!isAdmin} onChange={(e) => set('season', e.target.value)} />
        </Field>
        {isNew && (
          <Field label="Status" htmlFor="t-status">
            <select id="t-status" className="select" value={f.status} disabled={!isAdmin} onChange={(e) => set('status', e.target.value as TournamentStatus)}>
              {(['draft', 'upcoming', 'open'] as TournamentStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <Field label="Summary" hint="Shown on the event page" htmlFor="t-summary">
        <textarea id="t-summary" className="textarea" value={f.summary} disabled={!isAdmin} onChange={(e) => set('summary', e.target.value)} />
      </Field>

      <div className="section-head">
        <h2>Schedule (IST)</h2>
      </div>
      <div className="form-grid two">
        <Field label="Registration opens" hint="Empty = as soon as status is Open" htmlFor="t-opens">
          <input id="t-opens" type="datetime-local" className="input" value={f.reg_opens_at} disabled={!isAdmin} onChange={(e) => set('reg_opens_at', e.target.value)} />
        </Field>
        <Field label="Registration closes" error={errs.reg_closes_at} hint="Empty = until you close it" htmlFor="t-closes">
          <input id="t-closes" type="datetime-local" className="input" value={f.reg_closes_at} disabled={!isAdmin} onChange={(e) => set('reg_closes_at', e.target.value)} />
        </Field>
        <Field label="Starts" htmlFor="t-starts">
          <input id="t-starts" type="datetime-local" className="input" value={f.starts_at} disabled={!isAdmin} onChange={(e) => set('starts_at', e.target.value)} />
        </Field>
        <Field label="Max entries" error={errs.max_entries} hint="Teams or players; empty = no limit" htmlFor="t-max">
          <input id="t-max" className="input num" inputMode="numeric" value={f.max_entries} disabled={!isAdmin} onChange={(e) => set('max_entries', e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>

      <div className="section-head">
        <h2>Scoring</h2>
      </div>
      <div className="form-grid two">
        <Field
          label="Placement points (JSON)"
          error={errs.placement_points}
          hint={isNew ? `Empty = game default ${game ? JSON.stringify(game.placement_points) : ''}` : 'Ranges allowed: {"5-8": 2}'}
          htmlFor="t-pp"
        >
          <input id="t-pp" className="input num" value={f.placement_points} disabled={!isAdmin} onChange={(e) => set('placement_points', e.target.value)} />
        </Field>
        <Field label="Points per kill" hint={isNew && game ? `Empty = game default ${game.kill_points}` : undefined} htmlFor="t-kp">
          <input id="t-kp" className="input num" value={f.kill_points} disabled={!isAdmin} onChange={(e) => set('kill_points', e.target.value)} />
        </Field>
        <Field label="House points by final rank (JSON)" error={errs.house_points} hint="Split equally among a team's non-sub members, by their houses" htmlFor="t-hp">
          <input id="t-hp" className="input num" value={f.house_points} disabled={!isAdmin} onChange={(e) => set('house_points', e.target.value)} />
        </Field>
        <Field label="Contact note" hint="e.g. the WhatsApp group or organiser contact" htmlFor="t-contact">
          <input id="t-contact" className="input" value={f.contact_note} disabled={!isAdmin} onChange={(e) => set('contact_note', e.target.value)} />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={f.same_house_teams} disabled={!isAdmin} onChange={(e) => set('same_house_teams', e.target.checked)} />
        <span>House Cup: every team member must be from the captain's house</span>
      </label>

      {isAdmin && (
        <div className="row admin-save" style={gap(12)}>
          <Button kind="primary" busy={save.isPending && !pending} onClick={() => submit()}>
            {isNew ? 'Create event' : 'Save event'}
          </Button>
          <Link to="/admin/events" className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      )}

      {pendingMove && existing && (
        <ConfirmSheet
          open
          onClose={() => setPending(null)}
          title={pendingMove.label}
          body={
            pendingMove.to === 'completed'
              ? 'Standings become final and house points are awarded from them. Players will see this event as completed.'
              : pendingMove.to === 'cancelled'
                ? 'Registration stops and the event is shown as cancelled. No points are awarded.'
                : 'The event goes back to live, and its house points are withdrawn until it is completed again.'
          }
          confirmWord={existing.slug}
          confirmLabel={pendingMove.label}
          danger={pendingMove.to === 'cancelled'}
          busy={save.isPending}
          onConfirm={() => submit(pendingMove.to)}
        />
      )}
    </>
  )
}
