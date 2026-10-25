import { useQuery } from '@tanstack/react-query'
import { Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Empty, ErrorBox, Field, HouseTag, Sheet, Skeleton, StatusPill } from '../../components/ui'
import { useAction, useApi, useAuth, useCatalog, useRegionName, useToast } from '../../lib/app'
import { fmtDate, fmtPoints, houseCode } from '../../lib/format'
import { AdminHeader, ConfirmSheet, downloadCsv, gap, ReadOnlyNote, type AdminEntry } from './shared'

export const useRegistrations = (tournamentId: string | undefined) => {
  const api = useApi()
  return useQuery({
    queryKey: ['admin-registrations', tournamentId],
    queryFn: async () =>
      ((await api.rpc<AdminEntry[]>('admin_registrations', { p_tournament_id: tournamentId })) ?? []).map((e) => ({
        ...e,
        points_adjust: Number(e.points_adjust),
      })),
    enabled: !!tournamentId,
    // Backup for the live pings: a player who registers shows up here within 5 s even if this
    // device's live connection dropped (phone asleep, Wi-Fi switch). Only staff pages poll.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  })
}

const INVALIDATE = [['admin-registrations'], ['standings'], ['counts'], ['house-standings'], ['player-rankings']]

export default function Registrations() {
  const { id } = useParams()
  const cat = useCatalog()
  const regs = useRegistrations(id)
  const regionName = useRegionName()
  const { isAdmin, canManageEvents } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<AdminEntry | null>(null)
  const [removing, setRemoving] = useState<AdminEntry | null>(null)
  const [reason, setReason] = useState('')

  const t = cat.tournaments.find((x) => x.id === id)
  const game = t ? cat.gameById.get(t.game_id) : undefined

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const all = regs.data ?? []
    if (!needle) return all
    return all.filter(
      (e) =>
        e.name.toLowerCase().includes(needle) ||
        (e.members ?? []).some((m) =>
          [m.username, m.full_name, m.email, m.whatsapp, m.ig_id].some((v) => v?.toLowerCase().includes(needle)),
        ),
    )
  }, [regs.data, q])

  const remove = useAction((a, args: { p_entry_id: string; p_reason: string }) => a.rpc('admin_remove_entry', args), INVALIDATE)

  if (cat.loading || regs.isPending) return <Skeleton h={400} />
  if (!t) return <Empty title="Event not found" text="It may have been removed." />
  if (regs.error) return <ErrorBox error={regs.error} retry={() => regs.refetch()} />

  const extraKeys = (game?.extra_fields ?? []).map((f) => f.key)
  const memberCount = (regs.data ?? []).reduce((n, e) => n + (e.members?.length ?? 0), 0)

  function exportCsv() {
    const header = ['entry', 'entry_status', 'points_adjust', 'adjust_note', 'username', 'full_name', 'email', 'whatsapp', 'house', 'region', 'role', 'ig_id', ...extraKeys, 'registered_at']
    const rows: unknown[][] = []
    for (const e of regs.data ?? []) {
      for (const m of e.members ?? []) {
        rows.push([
          e.name, e.status, e.points_adjust, e.adjust_note ?? '', m.username, m.full_name, m.email, m.whatsapp ?? '',
          houseCode(m.house_id), regionName(m.region_id), m.role, m.ig_id, ...extraKeys.map((k) => m.extra?.[k] ?? ''), e.created_at,
        ])
      }
    }
    downloadCsv(`${t!.slug}-registrations.csv`, header, rows)
    toast({ kind: 'info', text: 'CSV contains phone numbers and emails. Share it only with organisers.' })
  }

  return (
    <>
      <AdminHeader
        title="Registrations"
        sub={
          <>
            <Link to={`/admin/events/${t.id}`}>{t.title}</Link> · {(regs.data ?? []).length} entries · {memberCount} players
          </>
        }
        actions={
          <>
            <StatusPill status={t.status} />
            <Button size="sm" onClick={exportCsv} disabled={!regs.data?.length}>
              <Download size={16} aria-hidden /> Export CSV
            </Button>
          </>
        }
      />
      {!canManageEvents && <ReadOnlyNote />}
      <div className="row" style={{ position: 'relative' }}>
        <Search size={18} className="t3" style={{ position: 'absolute', left: 14 }} aria-hidden />
        <input
          className="input"
          style={{ paddingLeft: 42 }}
          placeholder="Search team, username, name, email, phone or in-game ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search registrations"
        />
      </div>

      {list.length === 0 ? (
        <Empty title={q ? 'No match' : 'No registrations yet'} text={q ? `Nothing matches "${q}".` : 'Entries appear here as players register.'} />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Entry</th>
                <th>Player</th>
                <th>Contact</th>
                <th>House</th>
                <th>In-game</th>
                <th className="n">Adj.</th>
                {canManageEvents && <th />}
              </tr>
            </thead>
            <tbody>
              {list.map((e) =>
                (e.members ?? []).map((m, i) => (
                  <tr key={`${e.entry_id}-${m.username}`} className={e.status === 'disqualified' ? 'dq-row' : undefined}>
                    {i === 0 && (
                      <td rowSpan={e.members?.length ?? 1}>
                        <div style={{ fontWeight: 600 }}>{e.name}</div>
                        <div className="small t3">{fmtDate(e.created_at)}</div>
                        {e.status === 'disqualified' && <span className="pill pill-live">Disqualified</span>}
                        {e.adjust_note && <div className="small t2">{e.adjust_note}</div>}
                      </td>
                    )}
                    <td>
                      <div>
                        {m.username} <span className="tag-type t3">{m.role}</span>
                      </div>
                      <div className="small t3">{m.full_name}</div>
                    </td>
                    <td className="small">
                      <div className="num">{m.email}</div>
                      {m.whatsapp && (
                        <a className="num t2" href={`https://wa.me/${m.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                          {m.whatsapp}
                        </a>
                      )}
                    </td>
                    <td>
                      <HouseTag id={m.house_id} />
                      <div className="small t3">{regionName(m.region_id)}</div>
                    </td>
                    <td className="small">
                      <div className="num">{m.ig_id}</div>
                      {Object.entries(m.extra ?? {}).map(([k, v]) => (
                        <div key={k} className="t3">
                          {game?.extra_fields.find((f) => f.key === k)?.label ?? k}: {v}
                        </div>
                      ))}
                    </td>
                    {i === 0 && <td rowSpan={e.members?.length ?? 1} className="n">{e.points_adjust ? fmtPoints(e.points_adjust) : ''}</td>}
                    {canManageEvents && i === 0 && (
                      <td rowSpan={e.members?.length ?? 1}>
                        <div className="stack" style={gap(4)}>
                          <Button size="sm" kind="ghost" onClick={() => setEditing(e)}>
                            {isAdmin ? 'Adjust' : '± Points'}
                          </Button>
                          {isAdmin && (
                            <Button size="sm" kind="danger" onClick={() => setRemoving(e)}>
                              Remove
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && <AdjustSheet entry={editing} onClose={() => setEditing(null)} />}

      {removing && (
        <ConfirmSheet
          open
          onClose={() => {
            setRemoving(null)
            setReason('')
          }}
          title={`Remove ${removing.name}`}
          body="The entry and all its results are deleted. Members can register again while registration is open. A snapshot is kept in the audit log."
          confirmWord={removing.name}
          confirmLabel="Remove entry"
          busy={remove.isPending}
          onConfirm={() =>
            remove.mutate(
              { p_entry_id: removing.entry_id, p_reason: reason.trim() || 'Removed by admin' },
              {
                onSuccess: () => {
                  toast({ kind: 'success', text: `${removing.name} removed.` })
                  setRemoving(null)
                  setReason('')
                },
              },
            )
          }
        >
          <Field label="Reason (kept in the audit log)" htmlFor="rm-reason">
            <input id="rm-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </ConfirmSheet>
      )}
    </>
  )
}

/**
 * Points fix for one entry. The superadmin also sets the status (DQ); an admin only moves the
 * points up or down (admin_adjust_points), as Angad asked on 25 Oct.
 */
export function AdjustSheet({ entry, onClose }: { entry: AdminEntry; onClose: () => void }) {
  const toast = useToast()
  const { isAdmin } = useAuth()
  const [status, setStatus] = useState(entry.status)
  const [adjust, setAdjust] = useState(String(entry.points_adjust ?? 0))
  const [note, setNote] = useState(entry.adjust_note ?? '')
  const save = useAction(
    (a, args: { p_entry_id: string; p_status: string; p_points_adjust: number; p_note: string }) =>
      isAdmin
        ? a.rpc('admin_set_entry', args)
        : a.rpc('admin_adjust_points', { p_entry_id: args.p_entry_id, p_points_adjust: args.p_points_adjust, p_note: args.p_note }),
    INVALIDATE,
  )
  const n = Number(adjust)
  return (
    <Sheet open onClose={onClose} title={entry.name}>
      <div className="stack">
        {isAdmin && (
          <Field label="Status" htmlFor="adj-status">
            <select id="adj-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as AdminEntry['status'])}>
              <option value="active">Active</option>
              <option value="disqualified">Disqualified (kept, unranked)</option>
            </select>
          </Field>
        )}
        <Field label="Points up or down" hint="Added to the total from all games: 200 adds, -150 takes away" error={Number.isFinite(n) ? null : 'Enter a number'} htmlFor="adj-points">
          <input id="adj-points" className="input num" inputMode="decimal" value={adjust} onChange={(e) => setAdjust(e.target.value)} />
        </Field>
        <Field label="Why (optional, e.g. typo in Game 2)" htmlFor="adj-note">
          <input id="adj-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button kind="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            kind="primary"
            busy={save.isPending}
            disabled={!Number.isFinite(n)}
            onClick={() =>
              save.mutate(
                { p_entry_id: entry.entry_id, p_status: status, p_points_adjust: n, p_note: note },
                {
                  onSuccess: () => {
                    toast({ kind: 'success', text: 'Entry updated.' })
                    onClose()
                  },
                },
              )
            }
          >
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
