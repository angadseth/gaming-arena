import { useQueryClient } from '@tanstack/react-query'
import {
  Bell, BellRing, CalendarPlus, Check, Copy, Gamepad2, Globe, KeyRound, Laptop, Lock, MessageCircle, Monitor,
  ShieldCheck, Smartphone, UserCheck, Video,
} from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useAction, useAuth, useLobby, useToast } from '../lib/app'
import { relative } from '../lib/format'
import type { Game, Notice, NoticeKind, PlayKind, Tournament } from '../lib/types'
import { Button, Field, Skeleton } from './ui'

const PLAY_ICON: Record<PlayKind, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  web: Globe, android: Smartphone, ios: Smartphone, pc: Monitor, mac: Laptop, console: Gamepad2,
}
const PLAY_SUB: Record<PlayKind, string> = {
  web: 'No install', android: 'Android', ios: 'iPhone / iPad', pc: 'Windows', mac: 'Mac', console: 'Console',
}

export const NOTICE_LABEL: Record<NoticeKind, string> = {
  info: 'Update', room: 'Room', live: 'Live', reminder: 'Reminder', result: 'Results',
}

/** The code of conduct a player accepts before the Meet link and room code unlock. */
export const LOBBY_RULES = [
  'Play fair: no teaming, hacks or griefing',
  'Use only the in-game name you registered',
  'Keep the room code and Meet link to yourself',
  'In the Meet: mic off unless speaking, stay respectful',
  'Organisers may screenshot the lobby; their call is final',
]

export function LobbyTab({ t, game }: { t: Tournament; game: Game }) {
  const { session } = useAuth()
  const lobby = useLobby(session ? t.id : undefined)
  const steps = game.join_steps ?? []
  const links = game.play_links ?? []

  return (
    <div className="lobby">
      <div className="lobby-main">
        {!session ? (
          <LockedCard t={t} signedIn={false} />
        ) : lobby.isPending ? (
          <Skeleton h={220} r={16} />
        ) : !lobby.data?.registered ? (
          <LockedCard t={t} signedIn />
        ) : !lobby.data.agreed ? (
          <AgreeCard t={t} hasRoom={!!lobby.data.has_room} />
        ) : (
          <>
            {!lobby.data.checked_in && <CheckInCard t={t} game={game} open={!!lobby.data.checkin_open} igId={lobby.data.my_ig_id ?? ''} />}
            <RoomCard t={t} game={game} lobby={lobby.data} />
            <Notices items={lobby.data.notices ?? []} />
          </>
        )}
      </div>

      <aside className="lobby-side">
        {links.length > 0 && (
          <section className="lobby-card">
            <h3 className="lobby-h">Get the game</h3>
            <div className="play-grid">
              {links.map((l) => {
                const Icon = PLAY_ICON[l.kind] ?? Globe
                return (
                  <a key={l.url} className="play-tile" href={l.url} target="_blank" rel="noopener noreferrer">
                    <Icon size={18} strokeWidth={1.75} />
                    <span className="play-tile-text">
                      <b>{l.label}</b>
                      <small>{PLAY_SUB[l.kind]}</small>
                    </span>
                  </a>
                )
              })}
            </div>
          </section>
        )}
        {steps.length > 0 && (
          <section className="lobby-card">
            <h3 className="lobby-h">How to join the room</h3>
            <ol className="steps">
              {steps.map((s, i) => (
                <li key={i}>
                  <span className="step-n">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </aside>
    </div>
  )
}

function LockedCard({ t, signedIn }: { t: Tournament; signedIn: boolean }) {
  const to = signedIn ? `/e/${t.slug}/register` : `/signin?next=${encodeURIComponent(`/e/${t.slug}?tab=lobby`)}`
  return (
    <section className="lobby-card lobby-locked">
      <span className="lobby-badge"><Lock size={18} strokeWidth={2} /></span>
      <div className="grow">
        <h3 className="lobby-h">Meet link and room code</h3>
        <p className="small t2">Unlock for registered players only.</p>
      </div>
      <Link className="btn btn-primary btn-sm" to={to}>{signedIn ? 'Register' : 'Sign in'}</Link>
    </section>
  )
}

function AgreeCard({ t, hasRoom }: { t: Tournament; hasRoom: boolean }) {
  const qc = useQueryClient()
  const [ok, setOk] = useState(false)
  const accept = useAction((a, id: string) => a.rpc('accept_lobby_rules', { p_tournament_id: id }))
  return (
    <section className="lobby-card">
      <div className="row" style={{ gap: 10 }}>
        <span className="lobby-badge"><ShieldCheck size={18} strokeWidth={2} /></span>
        <div className="grow">
          <h3 className="lobby-h">Lobby rules</h3>
          <p className="small t3">{hasRoom ? 'The room is ready. Agree to unlock it.' : 'Agree once to unlock the lobby.'}</p>
        </div>
      </div>
      <ul className="rule-list">
        {LOBBY_RULES.map((r) => (
          <li key={r}><Check size={14} strokeWidth={2.5} aria-hidden />{r}</li>
        ))}
      </ul>
      <label className="check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>I agree to these and the <Link to="/rules" style={{ textDecoration: 'underline' }}>rulebook</Link>.</span>
      </label>
      <Button
        kind="primary"
        disabled={!ok}
        busy={accept.isPending}
        onClick={() => accept.mutate(t.id, { onSuccess: () => qc.invalidateQueries({ queryKey: ['lobby', t.id] }) })}
      >
        Unlock lobby
      </Button>
    </section>
  )
}

/** The link between this site account and the in-game account: the player confirms the exact in-game name. */
function CheckInCard({ t, game, open, igId }: { t: Tournament; game: Game; open: boolean; igId: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(igId)
  const [sure, setSure] = useState(false)
  const checkIn = useAction((a, v: string) => a.rpc('check_in', { p_tournament_id: t.id, p_ig_id: v }))
  return (
    <section className={`lobby-card checkin${open ? ' is-open' : ''}`}>
      <div className="row" style={{ gap: 10 }}>
        <span className="lobby-badge"><UserCheck size={18} strokeWidth={2} /></span>
        <div className="grow">
          <h3 className="lobby-h">Check in</h3>
          <p className="small t3">{open ? 'Confirm the name you play with. Room code unlocks after this.' : 'Opens before the match. You get a notice.'}</p>
        </div>
        {!open && <span className="pill pill-upcoming">Not open</span>}
      </div>
      {open ? (
        <>
          <Field label={`${game.ig_id_label} in ${game.short || game.title}`} hint="Exactly as it shows in the game, same capitals" htmlFor="ci-name">
            <input id="ci-name" className="input" maxLength={64} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          <label className="check">
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
            <span>This is my own account. A wrong or borrowed name gets no points.</span>
          </label>
          <Button
            kind="primary"
            disabled={!sure || !name.trim()}
            busy={checkIn.isPending}
            onClick={() => checkIn.mutate(name.trim(), {
              onSuccess: () => {
                toast({ kind: 'success', text: `Checked in as ${name.trim()}` })
                qc.invalidateQueries({ queryKey: ['lobby', t.id] })
              },
            })}
          >
            Check in
          </Button>
        </>
      ) : (
        <div className="ig-now small">
          <span className="t3">Registered as</span> <b>{igId}</b>
        </div>
      )}
    </section>
  )
}

function RoomCard({ t, game, lobby }: { t: Tournament; game: Game; lobby: NonNullable<ReturnType<typeof useLobby>['data']> }) {
  const toast = useToast()
  const copy = (v: string, what: string) =>
    navigator.clipboard.writeText(v).then(
      () => toast({ kind: 'success', text: `${what} copied` }),
      () => toast({ kind: 'error', text: 'Could not copy. Long-press to select it.' }),
    )
  const cal = calendarUrl(t, game, lobby.meet_url)

  return (
    <section className="lobby-card">
      <div className="spread">
        <h3 className="lobby-h">Match lobby</h3>
        {lobby.checked_in ? (
          <span className="pill pill-open"><Check size={12} strokeWidth={2.5} aria-hidden /> In as {lobby.my_ig_id}</span>
        ) : lobby.updated_at ? (
          <span className="small t3">Updated {relative(lobby.updated_at)}</span>
        ) : null}
      </div>

      <div className="room-row">
        <div className={`room-tile${lobby.room_code ? ' is-set' : ''}`}>
          <span className="tag-type t3"><KeyRound size={12} aria-hidden /> Room code</span>
          {lobby.room_code ? (
            <button className="room-code" onClick={() => copy(lobby.room_code!, 'Room code')} title="Copy">
              {lobby.room_code} <Copy size={14} aria-hidden />
            </button>
          ) : lobby.has_room && !lobby.checked_in ? (
            <span className="small t2">Ready. Check in above to see it.</span>
          ) : (
            <span className="small t2">Shows here about 10 min before start</span>
          )}
          {lobby.room_password && (
            <button className="room-pass small" onClick={() => copy(lobby.room_password!, 'Password')}>
              Password <b>{lobby.room_password}</b> <Copy size={12} aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="lobby-actions">
        {lobby.meet_url ? (
          <a className="btn btn-primary btn-sm" href={lobby.meet_url} target="_blank" rel="noopener noreferrer">
            <Video size={16} aria-hidden /> Join Meet
          </a>
        ) : (
          <span className="btn btn-secondary btn-sm" aria-disabled="true"><Video size={16} aria-hidden /> Meet link soon</span>
        )}
        {lobby.chat_url && (
          <a className="btn btn-secondary btn-sm" href={lobby.chat_url} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} aria-hidden /> Group chat
          </a>
        )}
        {cal && (
          <a className="btn btn-secondary btn-sm" href={cal} target="_blank" rel="noopener noreferrer">
            <CalendarPlus size={16} aria-hidden /> Add to calendar
          </a>
        )}
        <AlertsButton />
      </div>

      {lobby.note && <p className="lobby-note small">{lobby.note}</p>}
    </section>
  )
}

function Notices({ items }: { items: Notice[] }) {
  return (
    <section className="lobby-card">
      <h3 className="lobby-h">Notices</h3>
      {items.length === 0 ? (
        <p className="small t3">Nothing yet. Updates from organisers land here and on the bell.</p>
      ) : (
        <ul className="notice-list">
          {items.map((n) => <NoticeItem key={n.id} n={n} />)}
        </ul>
      )}
    </section>
  )
}

export function NoticeItem({ n, event }: { n: Notice; event?: { slug: string; title: string; unread?: boolean } }) {
  return (
    <li className={`notice notice-${n.kind}${event?.unread ? ' is-unread' : ''}`}>
      <div className="spread" style={{ gap: 8 }}>
        <span className="notice-kind">{NOTICE_LABEL[n.kind]}</span>
        <span className="small t3">{relative(n.created_at)}</span>
      </div>
      <b className="notice-title">{n.title}</b>
      {n.body && <p className="small t2">{n.body}</p>}
      {event && <Link className="small notice-event" to={`/e/${event.slug}?tab=lobby`}>{event.title} ›</Link>}
    </li>
  )
}

/** Asks the browser for permission to pop notices while the site is open. */
export function AlertsButton() {
  const toast = useToast()
  const supported = typeof Notification !== 'undefined'
  const [perm, setPerm] = useState(supported ? Notification.permission : 'denied')
  if (!supported) return null
  if (perm === 'granted') {
    return <span className="btn btn-ghost btn-sm" aria-disabled="true"><BellRing size={16} aria-hidden /> Alerts on</span>
  }
  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={() =>
        Notification.requestPermission().then((p) => {
          setPerm(p)
          toast(p === 'granted'
            ? { kind: 'success', text: 'Alerts on. Keep this site open in a tab on match day.' }
            : { kind: 'info', text: 'Alerts are blocked. Allow notifications for this site in browser settings.' })
        })
      }
    >
      <Bell size={16} aria-hidden /> Turn on alerts
    </button>
  )
}

/** Google Calendar "add event" link, so the player's phone reminds them. */
function calendarUrl(t: Tournament, game: Game, meet: string | null | undefined): string | null {
  if (!t.starts_at) return null
  const start = new Date(t.starts_at)
  const end = new Date(start.getTime() + (game.match_minutes ?? 60) * 2 * 60_000)
  const z = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const page = `${window.location.origin}${window.location.pathname}#/e/${t.slug}?tab=lobby`
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${t.title} (Gaming Arena)`,
    dates: `${z(start)}/${z(end)}`,
    details: `Room code and updates: ${page}`,
    location: meet ?? page,
  })
  return `https://calendar.google.com/calendar/render?${q}`
}
