import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Empty, ErrorBox, Skeleton } from '../../components/ui'
import { useApi } from '../../lib/app'
import { fmtDate } from '../../lib/format'
import { AdminHeader } from './shared'

interface AuditRow {
  id: number
  action: string
  target: string | null
  details: Record<string, unknown>
  at: string
  actor: string | null
}

export default function Audit() {
  const api = useApi()
  const [limit, setLimit] = useState(200)
  const [q, setQ] = useState('')
  const log = useQuery({ queryKey: ['admin-audit', limit], queryFn: () => api.rpc<AuditRow[]>('admin_audit', { p_limit: limit }) })

  if (log.error) return <ErrorBox error={log.error} retry={() => log.refetch()} />
  const needle = q.trim().toLowerCase()
  const rows = (log.data ?? []).filter(
    (r) => !needle || r.action.includes(needle) || (r.actor ?? '').toLowerCase().includes(needle) || JSON.stringify(r.details).toLowerCase().includes(needle),
  )

  return (
    <>
      <AdminHeader
        title="Audit log"
        sub="Every write made through the platform, newest first."
        actions={
          <select className="select" style={{ width: 140 }} value={limit} onChange={(e) => setLimit(Number(e.target.value))} aria-label="How many">
            {[200, 500, 1000].map((n) => (
              <option key={n} value={n}>
                Last {n}
              </option>
            ))}
          </select>
        }
      />
      <input className="input" placeholder="Filter by action, user or detail" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter audit log" />
      {log.isPending ? (
        <Skeleton h={300} />
      ) : rows.length === 0 ? (
        <Empty title="Nothing logged" text="Actions appear here as people use the platform." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When (IST)</th>
                <th>Who</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="small num" style={{ whiteSpace: 'nowrap' }}>
                    {fmtDate(r.at)}
                  </td>
                  <td className="small">{r.actor ?? <span className="t3">system</span>}</td>
                  <td className="small num">{r.action}</td>
                  <td className="small num t3 audit-target">{r.target}</td>
                  <td className="small num t2 audit-details">{Object.keys(r.details ?? {}).length ? JSON.stringify(r.details) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
