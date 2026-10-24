import { CircleAlert, CircleCheck, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Empty, ErrorBox, Field, HouseTag, Skeleton, StatusPill } from '../../components/ui'
import { useAction, useCatalog, useMatchResults, useStandings, useToast } from '../../lib/app'
import { fmtDate, fmtPoints } from '../../lib/format'
import type { Tournament } from '../../lib/types'
import { useRegistrations } from './Registrations'
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

export default function Results() {
  const { id } = useParams()
  const cat = useCatalog()
  const regs = useRegistrations(id)
  const matches = useMatchResults(id)
  const standings = useStandings(id)
  const toast = useToast()
  const t = cat.tournaments.find((x) => x.id === id)

  const [mode, setMode] = useState<'form' | 'paste'>('form')
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
  const canCommit = label.trim().length > 0 && (mode === 'form' ? formRows.length > 0 && !formInvalid : !pasteInvalid)

  function commit() {
    const payload =
      mode === 'form'
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
      { p_tournament_id: t!.id, p_label: label.trim(), p_played_at: istInputToIso(playedAt) || null, p_rows: payload, p_replace: replace },
      {
        onSuccess: (res) => {
          if (!res?.ok) {
            setServerErrors(res?.errors ?? [{ row: 0, error: 'The server rejected this match.' }])
            toast({ kind: 'error', text: 'Nothing was saved. Fix the listed rows.' })
            return
          }
          toast({ kind: 'success', text: `${label.trim()} saved: ${res.rows} rows.` })
          setRows([])
          setPaste('')
          setLabel('')
          setReplace(false)
        },
      },
    )
  }

  const used = new Set(rows.map((r) => r.entry_id).filter(Boolean))
  const setRow = (i: number, patch: Partial<RowIn>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <>
      <AdminHeader
        title="Results"
        sub={
          <>
            <Link to={`/admin/events/${t.id}`}>{t.title}</Link> · placement {JSON.stringify(t.placement_points)} · {fmtPoints(Number(t.kill_points))} per kill
          </>
        }
        actions={<StatusPill status={t.status} />}
      />

      <div className="panel stack">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'form'} onClick={() => setMode('form')}>
            Enter a match
          </button>
          <button role="tab" aria-selected={mode === 'paste'} onClick={() => setMode('paste')}>
            Paste JSON
          </button>
        </div>
        <div className="form-grid two">
          <Field label="Match label" hint='Unique in this event, e.g. "Match 1 - Erangel" or "Final"' htmlFor="m-label">
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

        <label className="check">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          <span>Replace the existing match with the same label</span>
        </label>
        {serverErrors.length > 0 && (
          <div className="stack server-errors" style={gap(4)} role="alert">
            {serverErrors.map((e, i) => (
              <span key={i} className="error-text">
                {e.row ? `Row ${e.row}: ` : ''}
                {e.error}
              </span>
            ))}
          </div>
        )}
        <div className="row">
          <Button kind="primary" disabled={!canCommit} busy={record.isPending} onClick={commit}>
            Save match
          </Button>
          {!label.trim() && <span className="hint">Give the match a label first.</span>}
        </div>
      </div>

      <div className="section-head">
        <h2>Recorded matches</h2>
        <span className="small t3">{grouped.length}</span>
      </div>
      {matches.isPending ? (
        <Skeleton h={120} />
      ) : grouped.length === 0 ? (
        <p className="t3">No matches recorded yet.</p>
      ) : (
        <div className="stack" style={gap(12)}>
          {grouped.map((m) => (
            <details key={m.id} className="panel match-block">
              <summary className="spread">
                <span>
                  <strong>{m.label}</strong> <span className="small t3">{fmtDate(m.played_at)} · {m.rows.length} rows</span>
                </span>
                <Button
                  size="sm"
                  kind="danger"
                  onClick={(e) => {
                    e.preventDefault()
                    setDeleting({ id: m.id, label: m.label })
                  }}
                >
                  Delete
                </Button>
              </summary>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Entry</th>
                      <th className="n">Place</th>
                      <th className="n">Kills</th>
                      <th className="n">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.rows.map((r) => (
                      <tr key={r.entry_id}>
                        <td>{entryById.get(r.entry_id)?.name ?? r.entry_id}</td>
                        <td className="n">{r.placement ?? '—'}</td>
                        <td className="n">{r.kills}</td>
                        <td className="n">{fmtPoints(r.points)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}

      <div className="section-head">
        <h2>Standings now</h2>
        <Link to={`/e/${t.slug}?tab=standings`} className="small t2">
          Public view
        </Link>
      </div>
      {standings.isPending ? (
        <Skeleton h={160} />
      ) : !standings.data?.length ? (
        <p className="t3">No entries yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="n">#</th>
                <th>Entry</th>
                <th>House</th>
                <th className="n">M</th>
                <th className="n">Wins</th>
                <th className="n">Kills</th>
                <th className="n">Total</th>
              </tr>
            </thead>
            <tbody>
              {standings.data.map((s) => (
                <tr key={s.entry_id} className={s.status === 'disqualified' ? 'dq-row' : undefined}>
                  <td className="n">{s.rank ?? 'DQ'}</td>
                  <td>{s.name}</td>
                  <td>
                    <HouseTag id={s.house_id} />
                  </td>
                  <td className="n">{s.matches}</td>
                  <td className="n">{s.wins}</td>
                  <td className="n">{s.kills}</td>
                  <td className="n">{fmtPoints(s.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
