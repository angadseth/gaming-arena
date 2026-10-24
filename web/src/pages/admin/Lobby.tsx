import { useQuery } from '@tanstack/react-query'
import { Check, Copy, ExternalLink, Mail, Megaphone, Save, Trash2, UserCheck, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { NOTICE_LABEL } from '../../components/Lobby'
import { Button, Empty, ErrorBox, Field, HouseTag, Sheet, Skeleton } from '../../components/ui'
import { useAction, useApi, useAuth, useCatalog, useToast } from '../../lib/app'
import { fmtDate, relative } from '../../lib/format'
import type { AdminLobby, NoticeKind } from '../../lib/types'
import { AdminHeader, ConfirmSheet, gap } from './shared'

/** One-tap starting points; organisers edit before posting. */
const TEMPLATES: { kind: NoticeKind; label: string; title: string; body: string }[] = [
  { kind: 'reminder', label: 'Tomorrow', title: 'Match tomorrow', body: 'Install the game today and set your registered name. Lobby tab has the steps.' },
  { kind: 'reminder', label: '15 min', title: 'Starting in 15 minutes', body: 'Join the Google Meet now. Room code follows shortly.' },
  { kind: 'live', label: 'Room live', title: 'Room is open, join now', body: 'Party > Join > enter the room code from the Lobby tab.' },
  { kind: 'result', label: 'Results', title: 'Results are up', body: 'Check the Standings tab. Raise disputes in the Meet or group within 30 min.' },
  { kind: 'info', label: 'Delay', title: 'Short delay', body: 'We start 10 minutes late. Stay in the Meet.' },
]
const KINDS: NoticeKind[] = ['info', 'room', 'live', 'reminder', 'result']
const BCC_CHUNK = 40

export default function Lobby() {
  const { id } = useParams()
  const api = useApi()
  const cat = useCatalog()
  const toast = useToast()
  const q = useQuery({
    queryKey: ['admin-lobby', id],
    queryFn: () => api.rpc<AdminLobby>('admin_lobby', { p_tournament_id: id }),
    enabled: !!id,
    // A focus refetch would overwrite the room form mid-edit.
    refetchOnWindowFocus: false,
  })
  const t = cat.tournaments.find((x) => x.id === id)

  const [room, setRoom] = useState({ meet_url: '', chat_url: '', room_code: '', room_password: '', note: '' })
  const [notify, setNotify] = useState(true)
  const [msg, setMsg] = useState<{ kind: NoticeKind; title: string; body: string }>({ kind: 'info', title: '', body: '' })
  const [lastPosted, setLastPosted] = useState<{ title: string; body: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [fixedMeet, setFixedMeet] = useState<string | null>(null)
  const [who, setWho] = useState('')
  const [fixing, setFixing] = useState<{ username: string; ig_id: string } | null>(null)
  const { isAdmin } = useAuth()

  useEffect(() => {
    if (!q.data) return
    setRoom({
      meet_url: q.data.event_meet_url ?? '', chat_url: q.data.chat_url ?? '', room_code: q.data.room_code ?? '',
      room_password: q.data.room_password ?? '', note: q.data.note ?? '',
    })
  }, [q.data])

  const inv = [['admin-lobby', id], ['lobby'], ['inbox']]
  const save = useAction((a, n: boolean) => a.rpc('admin_set_lobby', { p_tournament_id: id, p: room, p_notify: n }), inv)
  const post = useAction((a, m: typeof msg) => a.rpc('admin_post_notice', { p_tournament_id: id, p_kind: m.kind, p_title: m.title, p_body: m.body }), inv)
  const del = useAction((a, nid: string) => a.rpc('admin_delete_notice', { p_id: nid }), inv)
  const setDefaultMeet = useAction((a, url: string) => a.rpc('admin_set_default_meet', { p_url: url }), inv)
  const fixName = useAction((a, f: { username: string; ig_id: string }) => a.rpc('admin_set_ig_id', { p_tournament_id: id, p_username: f.username, p_ig_id: f.ig_id }), inv)
  const setCheckin = useAction((a, open: boolean) => a.rpc('admin_set_checkin', { p_tournament_id: id, p_open: open, p_notify: true }), inv)

  if (cat.loading || q.isPending) return <Skeleton h={400} />
  if (!t) return <Empty title="Event not found" text="It may have been removed." />
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />
  const d = q.data

  const page = `${window.location.origin}${window.location.pathname}#/e/${t.slug}?tab=lobby`
  const shareText = (m: { title: string; body: string }) => `*${t.title}*\n${m.title}${m.body ? `\n${m.body}` : ''}\n\nLobby: ${page}`
  const copy = (v: string, what: string) =>
    navigator.clipboard.writeText(v).then(() => toast({ kind: 'success', text: `${what} copied` }), () => toast({ kind: 'error', text: 'Copy failed' }))
  const chunks: string[][] = []
  for (let i = 0; i < d.emails.length; i += BCC_CHUNK) chunks.push(d.emails.slice(i, i + BCC_CHUNK))
  const gmail = (bcc: string[], m: { title: string; body: string }) =>
    `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(bcc.join(','))}&su=${encodeURIComponent(`${t.title}: ${m.title}`)}&body=${encodeURIComponent(`${m.title}\n${m.body}\n\nOpen the lobby: ${page}`)}`
  const needle = who.trim().toLowerCase()
  const roster = d.roster.filter((r) => !needle || [r.ig_id, r.username, r.full_name, r.entry].some((v) => v.toLowerCase().includes(needle)))
  const fixed = fixedMeet ?? d.default_meet_url ?? ''
  const outside = lastPosted ?? (d.notices?.[0] ? { title: d.notices[0].title, body: d.notices[0].body } : { title: 'Lobby details are up', body: '' })

  return (
    <>
      <AdminHeader
        title="Lobby & notices"
        sub={<Link to={`/admin/events/${id}`}>{t.title}</Link>}
        actions={<Link to={`/e/${t.slug}?tab=lobby`} className="btn btn-ghost btn-sm">Player view</Link>}
      />

      <div className="stat-chips">
        <span><b className="num">{d.recipients}</b> registered</span>
        <span><b className="num">{d.agreed_count}</b> accepted lobby rules</span>
        <span><b className="num">{d.checked_in_count}</b> checked in</span>
        <span><b className="num">{d.notices?.length ?? 0}</b> notices</span>
      </div>

      {isAdmin && (
        <section className="lobby-card fixed-meet">
          <div className="grow">
            <h3 className="lobby-h">Fixed Meet link (all events)</h3>
            <p className="small t3">Every lobby uses this unless an event sets its own.</p>
          </div>
          <input className="input" aria-label="Fixed Meet link" placeholder="https://meet.google.com/xxx-xxxx-xxx" value={fixed} onChange={(e) => setFixedMeet(e.target.value)} />
          <Button size="sm" busy={setDefaultMeet.isPending} onClick={() => setDefaultMeet.mutate(fixed, { onSuccess: () => toast({ kind: 'success', text: 'Fixed Meet link saved' }) })}>
            <Save size={14} aria-hidden /> Save
          </Button>
        </section>
      )}

      <section className="lobby-card">
        <div className="spread wrap" style={{ gap: 10 }}>
          <div>
            <h3 className="lobby-h">Check-in &amp; roster</h3>
            <p className="small t3">Let into the game room only names checked in here. Opening check-in starts a new round: everyone checks in again. It also opens by itself 45 min before the start.</p>
          </div>
          <div className="row wrap" style={gap(8)}>
            <span className={`pill ${d.checkin_open ? 'pill-open' : 'pill-closed'}`}>{d.checkin_open ? 'Check-in open' : 'Check-in closed'}</span>
            <Button size="sm" kind={d.checkin_open ? 'secondary' : 'primary'} busy={setCheckin.isPending} onClick={() => setCheckin.mutate(!d.checkin_open, { onSuccess: () => toast({ kind: 'success', text: d.checkin_open ? 'Check-in closed' : 'Check-in open, players pinged' }) })}>
              <UserCheck size={14} aria-hidden /> {d.checkin_open ? 'Close check-in' : 'Open check-in'}
            </Button>
            <Button size="sm" kind="ghost" onClick={() => copy(d.roster.filter((r) => r.checked_in_at).map((r) => r.ig_id).join(', '), 'Checked-in names')}>
              <Copy size={14} aria-hidden /> Names
            </Button>
          </div>
        </div>
        {d.roster.length > 6 && (
          <input className="input" placeholder="Search in-game name, username, team" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Search roster" />
        )}
        {d.roster.length === 0 ? (
          <p className="small t3">Nobody registered yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data roster">
              <thead>
                <tr><th>In-game name</th><th>Player</th><th>House</th><th>Status</th></tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.username} className={r.checked_in_at ? 'is-in' : undefined}>
                    <td>
                      <b>{r.ig_id}</b>
                      {r.ig_changes > 0 && <span className="tag-type changed" title="Name was changed after registering"> edited</span>}
                      {/[^ -~]/.test(r.ig_id) && <span className="tag-type changed" title="Has non-English or invisible characters: check closely"> odd chars</span>}
                      <button className="link-btn small" onClick={() => setFixing({ username: r.username, ig_id: r.ig_id })}>Fix name</button>
                    </td>
                    <td className="small">@{r.username}{r.entry !== r.username ? ` · ${r.entry}` : ''}<br /><span className="t3">{r.full_name}</span></td>
                    <td><HouseTag id={r.house_id} /></td>
                    <td className="small">{r.entry_status === 'disqualified' ? 'DQ' : r.checked_in_at ? <span className="in-tick"><Check size={13} strokeWidth={2.5} aria-hidden /> {relative(r.checked_in_at)}</span> : <span className="t3">Not in</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="admin-two">
        <section className="lobby-card">
          <h3 className="lobby-h">Room details</h3>
          <p className="small t3">Room code shows only to checked-in players.</p>
          <Field label="This event's own Meet (optional)" htmlFor="l-meet" hint={d.default_meet_url ? 'Empty = the fixed Meet link' : <a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer">Create a new Meet <ExternalLink size={11} /></a>}>
            <input id="l-meet" className="input" placeholder="https://meet.google.com/xxx-xxxx-xxx" value={room.meet_url} onChange={(e) => setRoom({ ...room, meet_url: e.target.value })} />
          </Field>
          <Field label="Group chat link (optional)" htmlFor="l-chat">
            <input id="l-chat" className="input" placeholder="https://chat.whatsapp.com/..." value={room.chat_url} onChange={(e) => setRoom({ ...room, chat_url: e.target.value })} />
          </Field>
          <div className="form-grid two">
            <Field label="Room code" htmlFor="l-code">
              <input id="l-code" className="input num" maxLength={40} value={room.room_code} onChange={(e) => setRoom({ ...room, room_code: e.target.value })} />
            </Field>
            <Field label="Password (optional)" htmlFor="l-pass">
              <input id="l-pass" className="input" maxLength={40} value={room.room_password} onChange={(e) => setRoom({ ...room, room_password: e.target.value })} />
            </Field>
          </div>
          <Field label="Short note" hint="e.g. Region: Asia · 5 games · top 8 go to final" htmlFor="l-note">
            <textarea id="l-note" className="textarea" rows={2} maxLength={1000} value={room.note} onChange={(e) => setRoom({ ...room, note: e.target.value })} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            <span>Post a notice so players get pinged</span>
          </label>
          <Button kind="primary" busy={save.isPending} onClick={() => save.mutate(notify, { onSuccess: () => toast({ kind: 'success', text: notify ? 'Saved and players notified' : 'Saved' }) })}>
            <Save size={16} aria-hidden /> Save room
          </Button>
        </section>

        <section className="lobby-card">
          <h3 className="lobby-h">Send a notice</h3>
          <div className="chips chips-wrap">
            {TEMPLATES.map((tp) => (
              <button key={tp.label} className="chip" onClick={() => setMsg({ kind: tp.kind, title: tp.title, body: tp.body })}>{tp.label}</button>
            ))}
          </div>
          <div className="notice-head">
            <Field label="Type" htmlFor="n-kind">
              <select id="n-kind" className="select" value={msg.kind} onChange={(e) => setMsg({ ...msg, kind: e.target.value as NoticeKind })}>
                {KINDS.map((k) => <option key={k} value={k}>{NOTICE_LABEL[k]}</option>)}
              </select>
            </Field>
            <Field label="Title" htmlFor="n-title">
              <input id="n-title" className="input" maxLength={80} value={msg.title} onChange={(e) => setMsg({ ...msg, title: e.target.value })} />
            </Field>
          </div>
          <Field label="Message" htmlFor="n-body">
            <textarea id="n-body" className="textarea" rows={3} maxLength={1500} value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} />
          </Field>
          <Button
            kind="primary"
            disabled={msg.title.trim().length < 2}
            busy={post.isPending}
            onClick={() => post.mutate(msg, {
              onSuccess: () => {
                setLastPosted({ title: msg.title, body: msg.body })
                setMsg({ kind: 'info', title: '', body: '' })
                toast({ kind: 'success', text: `Posted to ${d.recipients} players` })
              },
            })}
          >
            <Megaphone size={16} aria-hidden /> Post notice
          </Button>

          <div className="outside">
            <span className="tag-type t3">Also reach them outside the site</span>
            <p className="small t3 ellipsis">Sends: “{outside.title}”</p>
            <div className="row wrap" style={gap(8)}>
              {chunks.map((c, i) => (
                <a key={i} className="btn btn-secondary btn-sm" href={gmail(c, outside)} target="_blank" rel="noopener noreferrer">
                  <Mail size={14} aria-hidden /> Email {chunks.length > 1 ? `${i * BCC_CHUNK + 1}–${i * BCC_CHUNK + c.length}` : `all ${c.length}`}
                </a>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={() => copy(shareText(outside), 'WhatsApp text')}>
                <Copy size={14} aria-hidden /> WhatsApp text
              </button>
              {d.emails.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => copy(d.emails.join(', '), 'Emails')}>
                  <Copy size={14} aria-hidden /> Emails
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="lobby-card">
        <h3 className="lobby-h">Posted notices</h3>
        {(d.notices ?? []).length === 0 ? (
          <p className="small t3">None yet.</p>
        ) : (
          <ul className="notice-list">
            {d.notices!.map((n) => (
              <li key={n.id} className={`notice notice-${n.kind}`}>
                <div className="spread" style={{ gap: 8 }}>
                  <span className="notice-kind">{NOTICE_LABEL[n.kind]}</span>
                  <span className="row" style={gap(4)}>
                    <span className="small t3" title={fmtDate(n.created_at)}>{relative(n.created_at)}</span>
                    <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Delete notice" onClick={() => setDeleting(n.id)}>
                      <Trash2 size={15} />
                    </button>
                  </span>
                </div>
                <b className="notice-title">{n.title}</b>
                {n.body && <p className="small t2">{n.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={!!fixing} onClose={() => setFixing(null)} title={`Fix @${fixing?.username ?? ''}'s in-game name`}>
        {fixing && (
          <div className="stack" style={gap(14)}>
            <p className="small t3">Use this for typos or after a dispute. Players cannot rename themselves once checked in. The change is logged.</p>
            <Field label="In-game name" htmlFor="fix-ig">
              <input id="fix-ig" className="input" maxLength={64} value={fixing.ig_id} onChange={(e) => setFixing({ ...fixing, ig_id: e.target.value })} />
            </Field>
            <Button kind="primary" busy={fixName.isPending} disabled={!fixing.ig_id.trim()} onClick={() => fixName.mutate(fixing, { onSuccess: () => { setFixing(null); toast({ kind: 'success', text: 'Name updated' }) } })}>
              Save name
            </Button>
          </div>
        )}
      </Sheet>
      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this notice?"
        body="Players stop seeing it. Emails or WhatsApp messages already sent stay sent."
        confirmLabel="Delete"
        busy={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting, { onSuccess: () => setDeleting(null) })}
      />
      {d.meet_url && (
        <a className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} href={d.meet_url} target="_blank" rel="noopener noreferrer">
          <Video size={16} aria-hidden /> Open the Meet as host
        </a>
      )}
    </>
  )
}
