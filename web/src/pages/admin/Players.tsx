import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Empty, ErrorBox, Field, HouseTag, Sheet, Skeleton } from '../../components/ui'
import { useAction, useApi, useAuth, useHouses, useRegionName, useRegions, useToast } from '../../lib/app'
import { fmtDate } from '../../lib/format'
import type { Role } from '../../lib/types'
import { AdminHeader, gap } from './shared'

interface AdminUser {
  id: string
  username: string
  full_name: string
  email: string
  whatsapp: string | null
  house_id: number
  region_id: number
  status: 'active' | 'suspended' | 'banned'
  status_note: string | null
  created_at: string
  roles: Role[]
}

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

export default function Players() {
  const api = useApi()
  const regionName = useRegionName()
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim())
  const [open, setOpen] = useState<AdminUser | null>(null)
  const users = useQuery({
    queryKey: ['admin-users', dq],
    queryFn: () => api.rpc<AdminUser[]>('admin_search_users', { p_query: dq }),
    enabled: dq.length >= 2,
  })

  return (
    <>
      <AdminHeader title="Players" sub="Search by username, name or email. Up to 50 results." />
      <p className="panel small t2">
        Roles and bans by email are on <Link to="/admin/access" style={{ textDecoration: 'underline' }}>Team &amp; access</Link>. Search here to edit one player's details.
      </p>
      <div className="row" style={{ position: 'relative' }}>
        <Search size={18} className="t3" style={{ position: 'absolute', left: 14 }} aria-hidden />
        <input className="input" style={{ paddingLeft: 42 }} placeholder="At least 2 characters" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search players" />
      </div>
      {dq.length < 2 ? (
        <p className="t3">Type to search.</p>
      ) : users.isPending ? (
        <Skeleton h={200} />
      ) : users.error ? (
        <ErrorBox error={users.error} retry={() => users.refetch()} />
      ) : !users.data?.length ? (
        <Empty title="No players found" text={`Nobody matches "${dq}".`} />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Player</th>
                <th>Email</th>
                <th>House</th>
                <th>Status</th>
                <th>Roles</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.username}</div>
                    <div className="small t3">{u.full_name}</div>
                  </td>
                  <td className="small num">{u.email}</td>
                  <td>
                    <HouseTag id={u.house_id} />
                    <div className="small t3">{regionName(u.region_id)}</div>
                  </td>
                  <td>
                    <span className={`pill ${u.status === 'active' ? 'pill-open' : 'pill-live'}`}>{u.status}</span>
                  </td>
                  <td className="small">{u.roles.length ? u.roles.join(', ') : <span className="t3">player</span>}</td>
                  <td className="small t3">{fmtDate(u.created_at, false)}</td>
                  <td>
                    <Button size="sm" kind="ghost" onClick={() => setOpen(u)}>
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <ManageSheet user={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function ManageSheet({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { isSuperadmin, profile } = useAuth()
  const houses = useHouses()
  const regions = useRegions()
  const toast = useToast()
  const [status, setStatus] = useState(user.status)
  const [note, setNote] = useState(user.status_note ?? '')
  const [name, setName] = useState(user.full_name)
  const [house, setHouse] = useState(String(user.house_id))
  const [region, setRegion] = useState(String(user.region_id))
  const [roles, setRoles] = useState<Role[]>(user.roles)
  const inv = [['admin-users']]
  const self = profile?.id === user.id

  const setStatusA = useAction((a, args: { p_user_id: string; p_status: string; p_note: string }) => a.rpc('admin_set_user_status', args), inv)
  const correct = useAction(
    (a, args: { p_user_id: string; p_full_name: string; p_house_id: number; p_region_id: number }) => a.rpc('admin_correct_profile', args),
    inv,
  )
  const role = useAction((a, args: { p_user_id: string; p_role: Role; p_grant: boolean }) => a.rpc('superadmin_set_role', args), inv)

  return (
    <Sheet open onClose={onClose} title={user.username}>
      <div className="stack">
        <dl className="kv">
          <dt>Email</dt>
          <dd className="num">{user.email}</dd>
          <dt>WhatsApp</dt>
          <dd className="num">{user.whatsapp ?? 'Not added'}</dd>
        </dl>

        <div className="section-head">
          <h2>Account status</h2>
        </div>
        {self ? (
          <p className="hint">You cannot change your own status.</p>
        ) : (
          <>
            <div className="chips" style={{ margin: 0, padding: 0 }}>
              {(['active', 'suspended', 'banned'] as const).map((s) => (
                <button key={s} className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
                  {s === 'active' ? 'Active' : s === 'suspended' ? 'Suspended' : 'Banned'}
                </button>
              ))}
            </div>
            <Field label="Reason" hint="Kept in the audit log" htmlFor="u-note">
              <input id="u-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Button
              busy={setStatusA.isPending}
              disabled={status === user.status && note === (user.status_note ?? '')}
              onClick={() =>
                setStatusA.mutate(
                  { p_user_id: user.id, p_status: status, p_note: note },
                  { onSuccess: () => toast({ kind: 'success', text: `Status set to ${status}.` }) },
                )
              }
            >
              Save status
            </Button>
          </>
        )}

        <div className="section-head">
          <h2>Correct profile</h2>
        </div>
        <p className="hint">Username and email never change. Fix a name, house or region here when a player made a mistake.</p>
        <Field label="Full name" htmlFor="u-name">
          <input id="u-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="form-grid two">
          <Field label="House" htmlFor="u-house">
            <select id="u-house" className="select" value={house} onChange={(e) => setHouse(e.target.value)}>
              {(houses.data ?? []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Region" htmlFor="u-region">
            <select id="u-region" className="select" value={region} onChange={(e) => setRegion(e.target.value)}>
              {(regions.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.is_active ? '' : ' (hidden)'}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Button
          busy={correct.isPending}
          onClick={() =>
            correct.mutate(
              { p_user_id: user.id, p_full_name: name, p_house_id: Number(house), p_region_id: Number(region) },
              { onSuccess: () => toast({ kind: 'success', text: 'Profile corrected.' }) },
            )
          }
        >
          Save corrections
        </Button>

        {isSuperadmin && (
          <>
            <div className="section-head">
              <h2>Roles (superadmin)</h2>
            </div>
            <p className="hint">Admins manage everything except roles. Organisers run matches: they see registrations and enter or fix results, nothing else.</p>
            <div className="stack" style={gap(8)}>
              {(['admin', 'organizer', 'superadmin'] as Role[]).map((r) => {
                const has = roles.includes(r)
                const lockSelf = self && r === 'superadmin'
                return (
                  <label key={r} className="check">
                    <input
                      type="checkbox"
                      checked={has}
                      disabled={role.isPending || lockSelf}
                      onChange={() =>
                        role.mutate(
                          { p_user_id: user.id, p_role: r, p_grant: !has },
                          {
                            onSuccess: () => {
                              setRoles((rs) => (has ? rs.filter((x) => x !== r) : [...rs, r]))
                              toast({ kind: 'success', text: `${has ? 'Removed' : 'Granted'} ${r}.` })
                            },
                          },
                        )
                      }
                    />
                    <span>
                      {r === 'admin' ? 'Admin' : r === 'organizer' ? 'Organiser' : 'Superadmin'}
                      {lockSelf && ' (you cannot remove your own)'}
                    </span>
                  </label>
                )
              })}
            </div>
          </>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button kind="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
