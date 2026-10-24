import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertsButton, NoticeItem } from '../components/Lobby'
import { Empty, ErrorBox, Skeleton } from '../components/ui'
import { useApi, useAuth, useInbox } from '../lib/app'

export default function Inbox() {
  const api = useApi()
  const qc = useQueryClient()
  const { session } = useAuth()
  const inbox = useInbox()
  const unread = inbox.data?.unread ?? 0

  // Opening the inbox counts as reading it; the list keeps its highlights until the next refresh.
  useEffect(() => {
    if (unread === 0) return
    const id = window.setTimeout(() => {
      api.rpc('mark_notices_seen').then(() => {
        qc.setQueryData(['inbox', session?.userId], (d: typeof inbox.data) => (d ? { ...d, unread: 0 } : d))
      }, () => {})
    }, 1200)
    return () => window.clearTimeout(id)
  }, [unread, api, qc, session?.userId])

  return (
    <div className="page stack" style={{ gap: 16 }}>
      <header className="page-header contour spread wrap" style={{ gap: 12 }}>
        <div className="stack" style={{ gap: 6 }}>
          <p className="tag-type t3">From your events</p>
          <h1 className="h1">Notices</h1>
        </div>
        <AlertsButton />
      </header>
      {inbox.isPending ? (
        <Skeleton h={240} r={16} />
      ) : inbox.error ? (
        <ErrorBox error={inbox.error} retry={() => inbox.refetch()} />
      ) : inbox.data.items.length === 0 ? (
        <Empty
          title="No notices yet"
          text="Room codes, reminders and results from your events show up here."
          action={<Link className="btn btn-secondary btn-sm" to="/">Browse events</Link>}
        />
      ) : (
        <ul className="notice-list" style={{ maxWidth: 720 }}>
          {inbox.data.items.map((n) => (
            <NoticeItem key={n.id} n={n} event={{ slug: n.event_slug, title: n.event_title, unread: n.unread }} />
          ))}
        </ul>
      )}
    </div>
  )
}
