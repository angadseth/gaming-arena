import { CircleAlert, CircleCheck, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Empty, ErrorBox, Field, HouseTag, Skeleton, StatusPill } from '../../components/ui'
import { useAction, useAuth, useCatalog, useMatchResults, useStandings, useToast } from '../../lib/app'
import { fmtDate, fmtPoints, igNorm } from '../../lib/format'
import type { Tournament } from '../../lib/types'
import { MentionBox, mentionables } from './MentionBox'
import { AdjustSheet, useRegistrations } from './Registrations'
import { AdminHeader, ConfirmSheet, gap, isoToIstInput, istInputToIso, pointsForRank, type AdminEntry } from './shared'

interface RowIn {
  entry_id: string
  placement: string
  kills: string
  points: string
}
interface ServerResult {
  ok: boolean
  match_id?: string
  rows?: number
  errors?: { row: number; error: string }[]
}
interface Parsed {
  ref: string
  entry: AdminEntry | null
  problem: string | null
  placement: number | null
  kills: number
  points: number | null
}

const INVALIDATE = [['match-results'], ['standings'], ['house-standings']]

function computePoints(t: Tournament, placement: number | null, kills: number, override: number | null) {
  return override ?? pointsForRank(t.placement_points, placement) + kills * Number(t.kill_points)
}

/** Finds the entry a pasted row refers to (team, username, in-game ID or entry id). */
function matchEntry(entries: AdminEntry[], row: Record<string, unknown>): [AdminEntry | null, string] {
  const low = (v: unknown) => String(v ?? '').trim().toLowerCase()
  if (row.entry_id != null) return [entries.find((e) => e.entry_id === String(row.entry_id)) ?? null, `entry ${row.entry_id}`]
  if (row.team != null) return [entries.find((e) => e.name.toLowerCase() === low(row.team)) ?? null, `team "${row.team}"`]
  if (row.username != null)
    return [entries.find((e) => (e.members ?? []).some((m) => m.username.toLowerCase() === low(row.username))) ?? null, `@${row.username}`]
  if (row.ig_id != null)
    return [entries.find((e) => (e.members ?? []).some((m) => m.ig_id.trim().toLowerCase() === low(row.ig_id))) ?? null, `ID ${row.ig_id}`]
  return [null, '(no team, username, ig_id or entry_id)']
}

function parsePaste(text: string, entries: AdminEntry[]): { rows: Parsed[]; error: string | null } {
  if (!text.trim()) return { rows: [], error: null }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { rows: [], error: `Invalid JSON: ${(e as Error).message}` }
  }
  const list = Array.isArray(data) ? data : (data as { results?: unknown })?.results
  if (!Array.isArray(list)) return { rows: [], error: 'Expected a list, or {"results": [...]}' }
  if (list.length > 500) return { rows: [], error: 'At most 500 rows per match' }
  const seen = new Set<string>()
  const rows = list.map((raw): Parsed => {
    const r = (raw ?? {}) as Record<string, unknown>
    const [entry, ref] = matchEntry(entries, r)
    const placement = r.placement == null || r.placement === '' ? null : Number(r.placement)
    const kills = r.kills == null || r.kills === '' ? 0 : Number(r.kills)
    const points = r.points == null || r.points === '' ? null : Number(r.points)
    let problem: string | null = null
    if (!entry) problem = 'Not registered in this event'
    else if (seen.has(entry.entry_id)) problem = 'Appears twice'
    else if ((placement != null && !(Number.isInteger(placement) && placement >= 1 && placement <= 1000)) || !(Number.isInteger(kills) && kills >= 0 && kills <= 500))
      problem = 'Placement or kills out of range'
    else if (points != null && !Number.isFinite(points)) problem = 'Points is not a number'
    if (entry) seen.add(entry.entry_id)
    return { ref, entry, problem, placement, kills, points }
  })
  return { rows, error: null }
}

interface Line {
  idx: number
  said: string
  manual: number | null
  entry: AdminEntry | null
  suggest: string | null
  problem: string | null
}

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return d[b.length]
}

/** What the organiser calls an entry: the in-game name for solo events, the team name otherwise. */
const entryLabel = (e: AdminEntry) => ((e.members ?? []).length === 1 ? e.members![0].ig_id : e.name)
/** The @mention for an entry: the site username for solo events, the team name otherwise. */
const entryTag = (e: AdminEntry) => `@${(e.members ?? []).length === 1 ? e.members![0].username : e.name}`

/**
 * Quick entry: one line per player, best first, "name, points". Points may be left out (then the
 * event's points table decides from the position). Names match like public.ig_key: case, spaces and
 * colour tags are ignored; @username and team names work too.
 */
function parseLines(text: string, entries: AdminEntry[]): Line[] {
  const byName = new Map<string, AdminEntry>()
  for (const e of entries) {
    byName.set(igNorm(e.name), e)
    for (const m of e.members ?? []) {
      byName.set(igNorm(m.username), e)
      byName.set(igNorm(m.ig_id), e)
    }
  }
  const seen = new Set<string>()
  const out: Line[] = []
  text.split('\n').forEach((raw, idx) => {
    const line = raw.replace(/^\s*\d+\s*[.)]\s+/, '').trim()
    if (!line) return
    let m = line.match(/^(.*?)\s*[,\t]\s*([-+]?\d+(?:\.\d+)?)\s*$/)
    // "@name 500" without the comma works too, when "@name" is a registered player.
    if (!m && line.startsWith('@')) {
      const sp = line.match(/^(.*?)\s+([-+]?\d+(?:\.\d+)?)\s*$/)
      if (sp && byName.has(igNorm(sp[1].replace(/^@/, '')))) m = sp
    }
    const said = (m ? m[1] : line).replace(/,\s*$/, '').trim()
    const manual = m ? Number(m[2]) : null
    const key = igNorm(said.replace(/^@/, ''))
    const entry = byName.get(key) ?? null
    let suggest: string | null = null
    let problem: string | null = null
    if (!entry) {
      let best = Infinity
      for (const e of entries) {
        const name = entryLabel(e)
        const dist = editDistance(key, igNorm(name))
        if (dist < best && dist <= Math.max(2, Math.floor(name.length / 4))) {
          best = dist
          suggest = name
        }
      }
      problem = 'Not registered in this event'
    } else if (seen.has(entry.entry_id)) problem = 'Listed twice'
    else if (manual != null && Math.abs(manual) > 100000) problem = 'Points must be within ±100000'
    if (entry) seen.add(entry.entry_id)
    out.push({ idx, said, manual, entry, suggest, problem })
  })
  return out
}

export default function Results() {
  const { id } = useParams()
  const cat = useCatalog()
  const regs = useRegistrations(id)
  const matches = useMatchResults(id)
  const standings = useStandings(id)
  const toast = useToast()
  const { canManageEvents, isAdmin } = useAuth()
  const [fixing, setFixing] = useState<AdminEntry | null>(null)
  const t = cat.tournaments.find((x) => x.id === id)

  const [mode, setMode] = useState<'quick' | 'form' | 'paste'>('quick')
  const [names, setNames] = useState('')
  const [skipUnknown, setSkipUnknown] = useState(false)
  const [label, setLabel] = useState('')
  const [playedAt, setPlayedAt] = useState(() => isoToIstInput(new Date().toISOString()))
  const [replace, setReplace] = useState(false)
  const [rows, setRows] = useState<RowIn[]>([])
  const [paste, setPaste] = useState('')
  const [serverErrors, setServerErrors] = useState<{ row: number; error: string }[]>([])
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null)

  const entries = useMemo(() => (regs.data ?? []).filter((e) => e.status === 'active'), [regs.data])
  const entryById = useMemo(() => new Map((regs.data ?? []).map((e) => [e.entry_id, e])), [regs.data])
  const parsed = useMemo(() => parsePaste(paste, regs.data ?? []), [paste, regs.data])
  const lines = useMemo(() => parseLines(names, entries), [names, entries])
  const unknown = lines.filter((r) => !r.entry)
  const people = useMemo(() => mentionables(entries), [entries])
  const taken = useMemo(() => new Set(lines.flatMap((r) => (r.entry ? [r.entry.entry_id] : []))), [lines])

  const record = useAction(
    (a, args: { p_tournament_id: string; p_label: string; p_played_at: string | null; p_rows: unknown[]; p_replace: boolean }) =>
      a.rpc<ServerResult>('admin_record_match', args),
    INVALIDATE,
  )
  const del = useAction((a, matchId: string) => a.rpc('admin_delete_match', { p_match_id: matchId }), INVALIDATE)

  const grouped = useMemo(() => {
    const m = new Map<string, { id: string; label: string; played_at: string; rows: { entry_id: string; placement: number | null; kills: number; points: number }[] }>()
    for (const r of matches.data ?? []) {
      if (!m.has(r.match_id)) m.set(r.match_id, { id: r.match_id, label: r.label, played_at: r.played_at, rows: [] })
      m.get(r.match_id)!.rows.push({ entry_id: r.entry_id, placement: r.placement, kills: Number(r.kills), points: Number(r.points) })
    }
    return [...m.values()].sort((a, b) => b.played_at.localeCompare(a.played_at))
  }, [matches.data])

  if (cat.loading || regs.isPending) return <Skeleton h={400} />
  if (!t) return <Empty title="Event not found" text="It may have been removed." />
  if (regs.error) return <ErrorBox error={regs.error} retry={() => regs.refetch()} />

  const formRows = rows.filter((r) => r.entry_id)
  const formInvalid = formRows.some((r) => {
    const p = r.placement === '' ? null : Number(r.placement)
    const k = r.kills === '' ? 0 : Number(r.kills)
    return (p != null && !(Number.isInteger(p) && p >= 1)) || !(Number.isInteger(k) && k >= 0) || (r.points !== '' && !Number.isFinite(Number(r.points)))
  })
  const pasteInvalid = !!parsed.error || parsed.rows.length === 0 || parsed.rows.some((r) => r.problem)
  const labels = new Set(grouped.map((m) => m.label.toLowerCase()))
  let n = grouped.length + 1
  while (labels.has(`game ${n}`)) n++
  const nextLabel = `Game ${n}`
  const effLabel = mode === 'quick' ? label.trim() || nextLabel : label.trim()
  const exists = labels.has(effLabel.toLowerCase())
  // Position = order among the lines that count (outsiders skipped only after the explicit tick).
  const placed = lines
    .filter((r) => r.entry && !r.problem)
    .map((r, i) => ({ row: r, placement: i + 1, points: r.manual ?? computePoints(t, i + 1, 0, null) }))
  const quickInvalid = placed.length === 0 || lines.some((r) => r.entry && r.problem) || (unknown.length > 0 && !skipUnknown)
  const canCommit =
    effLabel.length > 0 &&
    (!exists || replace) &&
    (mode === 'quick' ? !quickInvalid : mode === 'form' ? formRows.length > 0 && !formInvalid : !pasteInvalid)

  const fixLine = (idx: number, name: string) =>
    setNames((txt) =>
      txt
        .split('\n')
        .map((l, i) => {
          if (i !== idx) return l
          const m = l.match(/[,\t]\s*[-+]?\d+(?:\.\d+)?\s*$/)
          return m ? `${name}${l.slice(m.index)}` : name
        })
        .join('\n'),
    )

  function edit(m: (typeof grouped)[number]) {
    const rowsSorted = [...m.rows].sort((a, b) => (a.placement ?? 1e9) - (b.placement ?? 1e9) || b.points - a.points)
    setMode('quick')
    setLabel(m.label)
    setReplace(true)
    setSkipUnknown(false)
    setNames(rowsSorted.map((r) => `${entryById.get(r.entry_id) ? entryTag(entryById.get(r.entry_id)!) : r.entry_id}, ${Number(r.points)}`).join('\n'))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function commit() {
    const payload =
      mode === 'quick'
        ? placed.map((p) => ({
            entry_id: p.row.entry!.entry_id,
            placement: p.placement,
            kills: 0,
            ...(p.row.manual != null ? { points: p.row.manual } : {}),
          }))
        : mode === 'form'
        ? formRows.map((r) => ({
            entry_id: r.entry_id,
            placement: r.placement === '' ? null : Number(r.placement),
            kills: r.kills === '' ? 0 : Number(r.kills),
            ...(r.points !== '' ? { points: Number(r.points) } : {}),
          }))
        : parsed.rows.map((r) => ({
            entry_id: r.entry!.entry_id,
            placement: r.placement,
            kills: r.kills,
            ...(r.points != null ? { points: r.points } : {}),
          }))
    setServerErrors([])
    record.mutate(
      { p_tournament_id: t!.id, p_label: effLabel, p_played_at: istInputToIso(playedAt) || null, p_rows: payload, p_replace: replace },
      {
        onSuccess: (res) => {
          if (!res?.ok) {
            setServerErrors(res?.errors ?? [{ row: 0, error: 'The server rejected this match.' }])
            toast({ kind: 'error', text: 'Nothing was saved. Fix the listed rows.' })
            return
          }
          toast({ kind: 'success', text: `${effLabel} saved: ${res.rows} ${res.rows === 1 ? 'player' : 'players'}. Leaderboard updated.` })
          setRows([])
          setPaste('')
          setNames('')
          setSkipUnknown(false)
          setLabel('')
          setReplace(false)
        },
      },
    )
  }

  const used = new Set(rows.map((r) => r.entry_id).filter(Boolean))
  const setRow = (i: number, patch: Partial<RowIn>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const top = standings.data ?? []
  // Mirrors public.guard_results: organisers only add; a finished event is the superadmin's alone.
  const finished = ['completed', 'cancelled', 'draft'].includes(t.status)
  const canEdit = isAdmin || (canManageEvents && !finished)
  const errorsBox = serverErrors.length > 0 && (
    <div className="stack server-errors" style={gap(4)} role="alert">
      {serverErrors.map((e, i) => (
        <span key={i} className="error-text">
          {e.row ? `Row ${e.row}: ` : ''}
          {e.error}
        </span>
      ))}
    </div>
  )
  const replaceBox = exists && (
    <label className="check">
      <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
      <span>{effLabel} is already saved. Tick to replace it with this.</span>
    </label>
  )

  return (
    <>
      <AdminHeader
        title="Results"
        sub={
          <>
            <Link to={`/admin/events/${t.id}`}>{t.title}</Link> · {grouped.length} {grouped.length === 1 ? 'game' : 'games'} saved · {entries.length} {entries.length === 1 ? 'player' : 'players'}
          </>
        }
        actions={<StatusPill status={t.status} />}
      />

      {mode === 'quick' ? (
        <section className="lobby-card rs-quick">
          <div className="spread wrap" style={gap(10)}>
            <div>
              <h3 className="lobby-h">{exists ? `Edit ${effLabel}` : `Add ${effLabel}`}</h3>
              <p className="small t3">
                Type <b>@</b> and pick the player (only registered players show up), then the points. One line each, winner first: <b>@name, points</b>. No points = from the table ({Object.entries(t.placement_points ?? {}).slice(0, 3).map(([k, v]) => `${k}: ${fmtPoints(Number(v))}`).join(' · ')}…).
              </p>
            </div>
            <input className="input rs-label" aria-label="Game name" maxLength={60} placeholder={nextLabel} value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <MentionBox
            value={names}
            onChange={setNames}
            people={people}
            taken={taken}
            placeholder={'@rahul_07, 1000\n@priya.k, 700\n@aman22, 500\n@sid'}
          />
          {lines.length > 0 && (
            <div className="rs-grid">
              {lines.map((r) => {
                const p = placed.find((x) => x.row === r)
                const who = r.entry?.members?.[0]
                return (
                  <div key={r.idx} className={`rcard${p ? '' : ' is-bad'}${p && p.placement <= 3 ? ` is-top p${p.placement}` : ''}`}>
                    <span className="rcard-pos num">{p ? p.placement : '!'}</span>
                    <span className="rcard-who">
                      <b className="ellipsis">{r.said}</b>
                      {p ? (
                        <small className="row" style={gap(6)}>
                          {who ? (r.said.startsWith('@') ? who.ig_id : `@${who.username}`) : r.entry!.name} <HouseTag id={r.entry!.house_id} />
                        </small>
                      ) : (
                        <small className="rcard-why">
                          {r.problem}
                          {r.suggest && (
                            <>
                              {' · '}
                              <button className="link-btn" onClick={() => fixLine(r.idx, r.suggest!)}>Use {r.suggest}</button>
                            </>
                          )}
                        </small>
                      )}
                    </span>
                    <span className="rcard-pts num">
                      {p ? fmtPoints(p.points) : '—'}
                      {p && r.manual == null && <small>auto</small>}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {unknown.length > 0 && (
            <label className="check">
              <input type="checkbox" checked={skipUnknown} onChange={(e) => setSkipUnknown(e.target.checked)} />
              <span>
                {unknown.length} {unknown.length > 1 ? 'names are' : 'name is'} not registered. Fix typos first; tick only for outsiders. They get nothing.
              </span>
            </label>
          )}
          {replaceBox}
          {errorsBox}
          <div className="row wrap" style={gap(12)}>
            <Button kind="primary" disabled={!canCommit} busy={record.isPending} onClick={commit}>
              Save {effLabel}
            </Button>
            {exists && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setNames(''); setLabel(''); setReplace(false); setSkipUnknown(false) }}>
                Cancel
              </button>
            )}
            {placed.length > 0 && <span className="small t3">{placed.length} of {entries.length} listed · not listed = 0 points</span>}
            <button className="link-btn small rs-more" onClick={() => setMode('form')}>More options: kills, teams, JSON</button>
          </div>
        </section>
      ) : (
        <div className="panel stack">
          <div className="spread wrap" style={gap(8)}>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={mode === 'form'} onClick={() => setMode('form')}>
                Detailed form
              </button>
              <button role="tab" aria-selected={mode === 'paste'} onClick={() => setMode('paste')}>
                Paste JSON
              </button>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setMode('quick')}>Back to quick entry</button>
          </div>
          <div className="form-grid two">
            <Field label="Match label" hint='Unique in this event, e.g. "Game 1" or "Final"' htmlFor="m-label">
              <input id="m-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
            </Field>
            <Field label="Played at (IST)" htmlFor="m-at">
              <input id="m-at" type="datetime-local" className="input" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)} />
            </Field>
          </div>
          {mode === 'form' ? (
          entries.length === 0 ? (
            <p className="t3">No active entries in this event yet.</p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Entry</th>
                      <th className="n">Place</th>
                      <th className="n">Kills</th>
                      <th className="n">Points override</th>
                      <th className="n">Points</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const p = r.placement === '' ? null : Number(r.placement)
                      const k = r.kills === '' ? 0 : Number(r.kills)
                      const pts = computePoints(t, p, k, r.points === '' ? null : Number(r.points))
                      return (
                        <tr key={i}>
                          <td style={{ minWidth: 180 }}>
                            <select className="select" value={r.entry_id} aria-label="Entry" onChange={(e) => setRow(i, { entry_id: e.target.value })}>
                              <option value="">Pick entry</option>
                              {entries
                                .filter((e) => e.entry_id === r.entry_id || !used.has(e.entry_id))
                                .map((e) => (
                                  <option key={e.entry_id} value={e.entry_id}>
                                    {e.name} · {(e.members ?? []).map((m) => m.ig_id).join(', ')}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td className="n">
                            <input className="input num" style={{ width: 80 }} inputMode="numeric" aria-label="Placement" value={r.placement} onChange={(e) => setRow(i, { placement: e.target.value.replace(/\D/g, '') })} />
                          </td>
                          <td className="n">
                            <input className="input num" style={{ width: 80 }} inputMode="numeric" aria-label="Kills" value={r.kills} onChange={(e) => setRow(i, { kills: e.target.value.replace(/\D/g, '') })} />
                          </td>
                          <td className="n">
                            <input className="input num" style={{ width: 100 }} inputMode="decimal" aria-label="Points override" placeholder="auto" value={r.points} onChange={(e) => setRow(i, { points: e.target.value })} />
                          </td>
                          <td className="n">{Number.isFinite(pts) ? fmtPoints(pts) : '—'}</td>
                          <td>
                            <button className="icon-btn" aria-label="Remove row" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                              <Trash2 size={16} strokeWidth={1.75} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="row wrap" style={gap(8)}>
                <Button size="sm" onClick={() => setRows((rs) => [...rs, { entry_id: '', placement: '', kills: '', points: '' }])}>
                  <Plus size={16} aria-hidden /> Add row
                </Button>
                <Button
                  size="sm"
                  kind="ghost"
                  onClick={() =>
                    setRows((rs) => [
                      ...rs,
                      ...entries.filter((e) => !used.has(e.entry_id)).map((e) => ({ entry_id: e.entry_id, placement: '', kills: '', points: '' })),
                    ])
                  }
                >
                  Add every entry
                </Button>
              </div>
            </>
          )
        ) : (
          <>
            <Field
              label="Results JSON"
              hint='[{"team": "Night Owls", "placement": 1, "kills": 12}, {"username": "gamer1", "placement": 2, "kills": 3, "points": 20}] — also accepts {"results": [...]}, "ig_id" or "entry_id"'
              error={parsed.error}
              htmlFor="m-json"
            >
              <textarea id="m-json" className="textarea mono" style={{ minHeight: 180 }} value={paste} onChange={(e) => setPaste(e.target.value)} spellCheck={false} />
            </Field>
            {parsed.rows.length > 0 && (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Row says</th>
                      <th>Matched entry</th>
                      <th className="n">Place</th>
                      <th className="n">Kills</th>
                      <th className="n">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="num t3">{i + 1}</td>
                        <td className="small">{r.ref}</td>
                        <td>
                          {r.problem ? (
                            <span className="row match-bad" style={gap(6)}>
                              <CircleAlert size={16} aria-hidden /> {r.problem}
                            </span>
                          ) : (
                            <span className="row match-ok" style={gap(6)}>
                              <CircleCheck size={16} aria-hidden /> {r.entry!.name}
                            </span>
                          )}
                        </td>
                        <td className="n">{r.placement ?? '—'}</td>
                        <td className="n">{r.kills}</td>
                        <td className="n">{fmtPoints(computePoints(t, r.placement, r.kills, r.points))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {parsed.rows.some((r) => r.problem) && (
              <p className="error-text">{parsed.rows.filter((r) => r.problem).length} row(s) need fixing. Nothing is saved until every row matches.</p>
            )}
          </>
        )}
          {replaceBox}
          {errorsBox}
          <div className="row">
            <Button kind="primary" disabled={!canCommit} busy={record.isPending} onClick={commit}>
              Save match
            </Button>
            {!label.trim() && <span className="hint">Give the match a label first.</span>}
          </div>
        </div>
      )}

      <div className="section-head">
        <h2>Games saved</h2>
        <span className="small t3">{grouped.length}</span>
      </div>
      {matches.isPending ? (
        <Skeleton h={120} />
      ) : grouped.length === 0 ? (
        <p className="t3">No games yet. Add the first one above.</p>
      ) : (
        <div className="rs-games">
          {grouped.map((m) => {
            const best = [...m.rows].sort((a, b) => (a.placement ?? 1e9) - (b.placement ?? 1e9) || b.points - a.points).slice(0, 3)
            return (
              <article key={m.id} className="lobby-card rs-game">
                <div className="spread" style={gap(8)}>
                  <b className="rs-game-name">{m.label}</b>
                  <span className="small t3">{fmtDate(m.played_at)}</span>
                </div>
                <ol className="rs-top">
                  {best.map((r, i) => {
                    const e = entryById.get(r.entry_id)
                    return (
                      <li key={r.entry_id}>
                        <span className={`rs-medal m${i + 1}`}>{i + 1}</span>
                        <span className="ellipsis grow">{e ? entryLabel(e) : '—'}</span>
                        <span className="num">{fmtPoints(r.points)}</span>
                      </li>
                    )
                  })}
                </ol>
                <div className="spread" style={gap(8)}>
                  <span className="small t3">{m.rows.length} {m.rows.length === 1 ? 'player' : 'players'}</span>
                  {canEdit && (
                    <span className="row" style={gap(6)}>
                      <Button size="sm" onClick={() => edit(m)}>Edit</Button>
                      <Button size="sm" kind="danger" onClick={() => setDeleting({ id: m.id, label: m.label })}>Delete</Button>
                    </span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="section-head">
        <h2>Leaderboard</h2>
        <Link to={`/e/${t.slug}?tab=standings`} className="small t2">
          Public view
        </Link>
      </div>
      {standings.isPending ? (
        <Skeleton h={160} />
      ) : !top.length ? (
        <p className="t3">No players yet.</p>
      ) : (
        <ol className="rs-board">
          {top.map((s) => (
            <li key={s.entry_id} className={`${s.status === 'disqualified' ? 'is-dq' : ''}${s.rank && s.rank <= 3 ? ` is-top p${s.rank}` : ''}`}>
              <span className="rcard-pos num">{s.rank ?? 'DQ'}</span>
              <span className="grow ellipsis">
                <b>{entryById.get(s.entry_id) ? entryLabel(entryById.get(s.entry_id)!) : s.name}</b>
                <small className="t3"> @{s.name}</small>
              </span>
              <HouseTag id={s.house_id} />
              <span className="small t3 rs-board-m">{s.matches} {s.matches === 1 ? 'game' : 'games'} · {s.wins} {s.wins === 1 ? 'win' : 'wins'}</span>
              <b className="num rs-board-pts">{fmtPoints(s.points)}</b>
              {canEdit && entryById.get(s.entry_id) && (
                <button className="btn btn-ghost btn-sm" title="Move this player's points up or down" onClick={() => setFixing(entryById.get(s.entry_id)!)}>
                  ± Points
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {fixing && <AdjustSheet entry={fixing} onClose={() => setFixing(null)} />}

      {deleting && (
        <ConfirmSheet
          open
          onClose={() => setDeleting(null)}
          title={`Delete ${deleting.label}`}
          body="Every result row of this match is deleted and standings recalculate. This is logged."
          confirmWord={deleting.label}
          confirmLabel="Delete match"
          busy={del.isPending}
          onConfirm={() =>
            del.mutate(deleting.id, {
              onSuccess: () => {
                toast({ kind: 'success', text: `${deleting.label} deleted.` })
                setDeleting(null)
              },
            })
          }
        />
      )}
    </>
  )
}
