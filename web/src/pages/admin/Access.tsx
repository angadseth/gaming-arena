import { useQuery } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, Empty, ErrorBox, Field, Skeleton } from '../../components/ui'
import { useAction, useApi, useAuth, useToast } from '../../lib/app'
import { fmtDate } from '../../lib/format'
import { AdminHeader, gap } from './shared'

type StaffRole = 'superadmin' | 'admin' | 'organizer'

interface AccessRow {
  email: string
  registered: boolean
  username: string | null
  full_name?: string | null
  role: StaffRole | null
  banned: boolean
  suspended?: boolean
  note: string | null
  by: string | null
  updated_at: string
}

type AccessAction = 'admin' | 'organizer' | 'norole' | 'ban' | 'unban'

const ACTION_LABEL: Record<AccessAction, string> = {
  admin: 'Make Admin',
  organizer: 'Make Organiser',
  norole: 'Remove role',
  ban: 'Ban',
  unban: 'Unban',
}

const ROLE_LABEL: Record<StaffRole, string> = { superadmin: 'Super Admin', admin: 'Admin', organizer: 'Organiser' }

/** What each role can do. Mirrors the database rules in migration 0015; the database is the real gate. */
const PERMS: { label: string; roles: StaffRole[] }[] = [
  { label: 'Open / close events', roles: ['superadmin', 'admin'] },
  { label: 'Add game results', roles: ['superadmin', 'admin', 'organizer'] },
  { label: 'Points up / down', roles: ['superadmin', 'admin'] },
  { label: 'See registrations', roles: ['superadmin', 'admin', 'organizer'] },
  { label: 'Run the lobby', roles: ['superadmin', 'admin', 'organizer'] },
  { label: 'Give roles', roles: ['superadmin'] },
  { label: 'Ban / unban', roles: ['superadmin'] },
  { label: 'Edit player details', roles: ['superadmin'] },
  { label: 'Game requests', roles: ['superadmin'] },
  { label: 'Audit log', roles: ['superadmin'] },
  { label: 'Games & event settings', roles: ['superadmin'] },
]

type Filter = 'all' | 'admin' | 'organizer' | 'banned'

/** Super Admin only: give a role or ban by IITM email, and see what access everyone has. */
export default function Access() {
  const api = useApi()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [action, setAction] = useState<AccessAction>('admin')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const formRef = useRef<HTMLElement>(null)
  // superadmin_access_list (0016) also lists staff who got a role without an email entry;
  // until it runs, fall back to the email list.
  const list = useQuery({
    queryKey: ['email-access', 'full'],
    queryFn: () => api.rpc<AccessRow[]>('superadmin_access_list').catch(() => api.rpc<AccessRow[]>('admin_email_access')),
  })
  const inv = [['email-access'], ['admin-users'], ['staff-badges']]
  const role = useAction((a, args: { p_email: string; p_role: string | null }) => a.rpc('superadmin_set_email_role', args), inv)
  const ban = useAction((a, args: { p_email: string; p_banned: boolean; p_note: string }) => a.rpc('admin_set_email_ban', args), inv)
  const busy = role.isPending || ban.isPending

  const full = (() => {
    const v = email.trim().toLowerCase()
    return v && !v.includes('@') ? `${v}@ds.study.iitm.ac.in` : v
  })()

  function run(target: string, act: AccessAction, reason = '', after?: () => void) {
    const done = () => {
      toast({ kind: 'success', text: `${ACTION_LABEL[act]}: ${target}` })
      after?.()
    }
    if (act === 'ban' || act === 'unban') ban.mutate({ p_email: target, p_banned: act === 'ban', p_note: reason }, { onSuccess: done })
    else role.mutate({ p_email: target, p_role: act === 'norole' ? null : act }, { onSuccess: done })
  }

  function prefill(target: string, act: AccessAction) {
    setEmail(target)
    setAction(act)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (act === 'ban') setTimeout(() => document.getElementById('acc-note')?.focus(), 300)
  }

  const rows = list.data ?? []
  const count = {
    all: rows.length,
    admin: rows.filter((r) => r.role === 'admin').length,
    organizer: rows.filter((r) => r.role === 'organizer').length,
    banned: rows.filter((r) => r.banned).length,
  }
  const shown = rows.filter((r) => (filter === 'all' ? true : filter === 'banned' ? r.banned : r.role === filter))

  return (
    <>
      <AdminHeader title="Team & access" sub="Only you see this page. Admins and organisers cannot give roles or ban anyone." />

      <section ref={formRef} className="panel stack acc-form" style={gap(12)}>
        <h2 className="h3">Give access or ban</h2>
        <Field
          label="IITM email or roll number"
          htmlFor="acc-email"
          hint={full && full !== email.trim().toLowerCase() ? full : 'Works before they sign up too: the role applies when they finish their profile.'}
        >
          <input id="acc-email" className="input num" autoComplete="off" spellCheck={false} placeholder="24f1000001" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="chips chips-wrap" role="group" aria-label="What to do">
          {(Object.keys(ACTION_LABEL) as AccessAction[]).map((a) => (
            <button key={a} className={`chip${a === 'ban' ? ' is-danger' : ''}`} aria-pressed={action === a} onClick={() => setAction(a)}>
              {ACTION_LABEL[a]}
            </button>
          ))}
        </div>
        {action === 'ban' && (
          <Field label="Reason" hint="Kept in the audit log" htmlFor="acc-note">
            <input id="acc-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
        <div className="row">
          <Button
            kind={action === 'ban' ? 'danger-fill' : 'primary'}
            busy={busy}
            disabled={!full}
            onClick={() => run(full, action, note, () => { setEmail(''); setNote('') })}
          >
            {ACTION_LABEL[action]}
          </Button>
        </div>
      </section>

      <div className="spread wrap" style={{ gap: 10 }}>
        <h2 className="h3">Who has what</h2>
        <div className="chips chips-wrap" role="group" aria-label="Show">
          {(['all', 'admin', 'organizer', 'banned'] as Filter[]).map((f) => (
            <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Everyone' : f === 'admin' ? 'Admins' : f === 'organizer' ? 'Organisers' : 'Banned'} <span className="num t3">{count[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {list.error ? (
        <ErrorBox error={list.error} retry={() => list.refetch()} />
      ) : list.isPending ? (
        <Skeleton h={220} r={16} />
      ) : !shown.length ? (
        <Empty title="Nobody here yet" text={filter === 'all' ? 'Give someone a role above and their card shows up here.' : 'No one in this group.'} />
      ) : (
        <div className="acc-grid">
          {shown.map((r) => (
            <AccessCard key={r.email} r={r} busy={busy} run={run} prefill={prefill} />
          ))}
        </div>
      )}
    </>
  )
}

function AccessCard({
  r, busy, run, prefill,
}: {
  r: AccessRow
  busy: boolean
  run: (email: string, act: AccessAction) => void
  prefill: (email: string, act: AccessAction) => void
}) {
  const { profile } = useAuth()
  const me = !!profile && r.username === profile.username
  const role = r.banned ? null : r.role
  const tone = r.banned ? 'is-banned' : role === 'superadmin' ? 'is-super' : role === 'admin' ? 'is-admin' : role === 'organizer' ? 'is-org' : ''

  return (
    <article className={`acc ${tone}`}>
      <header className="acc-head">
        <span className="stack" style={{ gap: 2, minWidth: 0 }}>
          <b className="ellipsis">{r.username ?? r.email.split('@')[0]}{me && <span className="t3"> (you)</span>}</b>
          <span className="small t3 num ellipsis">{r.email}</span>
        </span>
        {r.banned ? (
          <span className="acc-tag is-banned">Banned</span>
        ) : role ? (
          <span className={`staff-badge${role === 'superadmin' ? ' is-super' : role === 'organizer' ? ' is-org' : ''}`}>{ROLE_LABEL[role]}</span>
        ) : (
          <span className="acc-tag">Player</span>
        )}
      </header>

      <p className="small t3">
        {r.registered ? 'Signed up' : 'Not signed up yet'}
        {r.suspended && ' · suspended'}
        {r.by && ` · set by ${r.by}`}
        {r.updated_at && ` · ${fmtDate(r.updated_at, false)}`}
      </p>

      {r.banned ? (
        <p className="acc-ban small">Cannot sign in or join any event.{r.note ? ` Reason: ${r.note}` : ''}</p>
      ) : role ? (
        <ul className="acc-perms" aria-label="Access">
          {PERMS.map((p) => {
            const yes = p.roles.includes(role)
            return (
              <li key={p.label} className={yes ? 'yes' : 'no'}>
                {yes ? <Check size={14} strokeWidth={2.5} aria-label="Yes" /> : <X size={14} strokeWidth={2} aria-label="No" />}
                {p.label}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="small t2">No staff access. Plays and registers like everyone else.</p>
      )}

      {role !== 'superadmin' && (
        <footer className="acc-actions">
          {!r.banned && role !== 'admin' && <Button size="sm" disabled={busy} onClick={() => run(r.email, 'admin')}>Make Admin</Button>}
          {!r.banned && role !== 'organizer' && <Button size="sm" disabled={busy} onClick={() => run(r.email, 'organizer')}>Make Organiser</Button>}
          {!r.banned && role && <Button size="sm" kind="ghost" disabled={busy} onClick={() => run(r.email, 'norole')}>Remove role</Button>}
          {r.banned ? (
            <Button size="sm" disabled={busy} onClick={() => run(r.email, 'unban')}>Unban</Button>
          ) : (
            <Button size="sm" kind="danger" disabled={busy} onClick={() => prefill(r.email, 'ban')}>Ban…</Button>
          )}
        </footer>
      )}
    </article>
  )
}
