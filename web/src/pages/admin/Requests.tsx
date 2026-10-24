import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Button, Empty, ErrorBox, Skeleton } from '../../components/ui'
import { useAction, useApi, useAuth } from '../../lib/app'
import { fmtDate } from '../../lib/format'
import { AdminHeader, gap, ReadOnlyNote } from './shared'

interface GameRequest {
  id: string
  game_name: string
  platform: string
  note: string
  status: 'pending' | 'planned' | 'declined'
  created_at: string
  username: string
}

export default function Requests() {
  const api = useApi()
  const { isAdmin } = useAuth()
  const [filter, setFilter] = useState<'pending' | 'planned' | 'declined' | 'all'>('pending')
  const reqs = useQuery({ queryKey: ['admin-requests'], queryFn: () => api.rpc<GameRequest[]>('admin_game_requests') })
  const setStatus = useAction((a, args: { p_id: string; p_status: string }) => a.rpc('admin_set_request_status', args), [['admin-requests']])

  // How often each game is asked for (case-insensitive), to spot demand.
  const tally = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of reqs.data ?? []) {
      const k = r.game_name.trim().toLowerCase()
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [reqs.data])

  if (reqs.error) return <ErrorBox error={reqs.error} retry={() => reqs.refetch()} />
  const list = (reqs.data ?? []).filter((r) => filter === 'all' || r.status === filter)

  return (
    <>
      <AdminHeader title="Game requests" sub="Games players want added. Latest 300." />
      {!isAdmin && <ReadOnlyNote />}
      <div className="chips">
        {(['pending', 'planned', 'declined', 'all'] as const).map((s) => (
          <button key={s} className="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      {reqs.isPending ? (
        <Skeleton h={200} />
      ) : list.length === 0 ? (
        <Empty title="Nothing here" text="No requests with this status." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Game</th>
                <th className="n">Asks</th>
                <th>Platform</th>
                <th>Note</th>
                <th>From</th>
                <th>When</th>
                <th>Status</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.game_name}</td>
                  <td className="n">{tally.get(r.game_name.trim().toLowerCase())}</td>
                  <td className="small">{r.platform}</td>
                  <td className="small t2" style={{ maxWidth: 280 }}>
                    {r.note}
                  </td>
                  <td className="small">{r.username}</td>
                  <td className="small t3">{fmtDate(r.created_at)}</td>
                  <td className="small">{r.status}</td>
                  {isAdmin && (
                    <td>
                      <div className="row" style={gap(4)}>
                        {(['planned', 'declined', 'pending'] as const)
                          .filter((s) => s !== r.status)
                          .map((s) => (
                            <Button key={s} size="sm" kind="ghost" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ p_id: r.id, p_status: s })}>
                              {s === 'planned' ? 'Plan' : s === 'declined' ? 'Decline' : 'Reset'}
                            </Button>
                          ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
