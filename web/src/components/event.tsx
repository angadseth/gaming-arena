import { Copy, Crown, LogOut, RefreshCw, Share2, UserMinus } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAction, useToast } from '../lib/app'
import { fmtShort, gameHue, regOpen, teamSizeLabel } from '../lib/format'
import type { ExtraField, Game, MyEntry, Tournament } from '../lib/types'
import { Button, Field, GameCover, HouseTag, MetaLine, Sheet, StatusPill } from './ui'

export function EventCard({ t, game, entrants }: { t: Tournament; game: Game; entrants?: number }) {
  const when =
    t.status === 'open' && t.reg_closes_at ? `CLOSES ${fmtShort(t.reg_closes_at)}`
      : t.status === 'upcoming' && t.reg_opens_at ? `OPENS ${fmtShort(t.reg_opens_at)}`
        : t.starts_at ? fmtShort(t.starts_at) : null
  return (
    <Link
      to={`/e/${t.slug}`}
      viewTransition
      className="game-card holo"
      style={{ '--hue': gameHue(game) } as CSSProperties}
      aria-label={`${t.title}, ${t.status}`}
    >
      <GameCover game={game} />
      <span className="holo-foil" aria-hidden />
      <span className="holo-glare" aria-hidden />
      <StatusPill status={t.status} />
      <div className="game-card-body">
        <span className="game-card-title">{game.short || game.title}</span>
        <MetaLine parts={[teamSizeLabel(game), entrants ? `${entrants} IN` : null, when]} />
      </div>
    </Link>
  )
}

/** Client-side check that mirrors public.validate_game_fields (the server re-checks). */
export function checkGameFields(game: Game, igId: string, extra: Record<string, string>): Record<string, string> {
  const errs: Record<string, string> = {}
  const id = igId.trim()
  let re: RegExp | null = null
  try {
    re = new RegExp(game.ig_id_pattern)
  } catch {
    re = null
  }
  if (!id || id.length > 64 || (re && !re.test(id))) errs.__ig = `That ${game.ig_id_label} does not look right. ${game.ig_id_hint}`.trim()
  for (const f of game.extra_fields ?? []) {
    const v = (extra[f.key] ?? '').trim()
    if (!v) {
      if (f.required !== false) errs[f.key] = `${f.label} is required`
      continue
    }
    let fr: RegExp | null = null
    try {
      fr = f.pattern ? new RegExp(f.pattern) : null
    } catch {
      fr = null
    }
    if (v.length > 80 || (fr && !fr.test(v))) errs[f.key] = `${f.label} does not look right. ${f.hint ?? ''}`.trim()
  }
  return errs
}

export function GameFields({
  game, igId, setIgId, extra, setExtra, errors,
}: {
  game: Game
  igId: string
  setIgId: (v: string) => void
  extra: Record<string, string>
  setExtra: (v: Record<string, string>) => void
  errors: Record<string, string>
}) {
  return (
    <>
      <Field label={game.ig_id_label} htmlFor="igid" error={errors.__ig} hint={game.ig_id_hint}>
        <input id="igid" className="input" autoCapitalize="none" spellCheck={false} maxLength={64} value={igId} aria-invalid={!!errors.__ig} onChange={(e) => setIgId(e.target.value)} />
      </Field>
      {(game.extra_fields ?? []).map((f: ExtraField) => (
        <Field key={f.key} label={f.required === false ? `${f.label} (optional)` : f.label} htmlFor={`x-${f.key}`} error={errors[f.key]} hint={f.hint}>
          <input
            id={`x-${f.key}`}
            className="input"
            maxLength={80}
            value={extra[f.key] ?? ''}
            aria-invalid={!!errors[f.key]}
            onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })}
          />
        </Field>
      ))}
    </>
  )
}

export function shareInvite(code: string, teamName: string, eventTitle: string) {
  const url = `${location.origin}${location.pathname}#/join/${code}`
  const text = `Join my team "${teamName}" for ${eventTitle} on Gaming Arena. Invite code: ${code}`
  return { url, text }
}

export function InviteCode({ code, teamName, eventTitle, onRegenerate }: { code: string; teamName: string; eventTitle: string; onRegenerate?: () => void }) {
  const toast = useToast()
  const { url, text } = shareInvite(code, teamName, eventTitle)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      toast({ kind: 'success', text: 'Invite copied' })
    } catch {
      toast({ kind: 'error', text: 'Could not copy. Long-press the code instead.' })
    }
  }
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Gaming Arena invite', text, url })
      } catch {
        /* user cancelled */
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener')
    }
  }
  return (
    <div className="panel stack" style={{ gap: 12 }}>
      <p className="tag-type t3">Team invite code</p>
      <p className="code" style={{ userSelect: 'all' }}>{code}</p>
      <p className="small t2">Teammates sign in, open Join a team, and enter this code. Share it only with your team.</p>
      <div className="row wrap">
        <Button size="sm" onClick={share}>
          <Share2 size={16} aria-hidden /> Share
        </Button>
        <Button size="sm" kind="ghost" onClick={copy}>
          <Copy size={16} aria-hidden /> Copy
        </Button>
        {onRegenerate && (
          <Button size="sm" kind="ghost" onClick={onRegenerate} title="Make a new code; the old one stops working">
            <RefreshCw size={16} aria-hidden /> New code
          </Button>
        )}
      </div>
    </div>
  )
}

/** One of my registrations: roster, invite code, and the actions allowed now. */
export function EntryPanel({ entry, showEventLink }: { entry: MyEntry; showEventLink?: boolean }) {
  const [confirm, setConfirm] = useState<null | { kind: 'leave' } | { kind: 'kick'; username: string }>(null)
  const inv = [['my-entries'], ['standings'], ['counts']]
  const leave = useAction((api, id: string) => api.rpc('leave_entry', { p_entry_id: id }), inv)
  const kick = useAction((api, a: { id: string; u: string }) => api.rpc('kick_member', { p_entry_id: a.id, p_username: a.u }), inv)
  const regen = useAction((api, id: string) => api.rpc<string>('regenerate_invite', { p_entry_id: id }), [['my-entries']])
  const toast = useToast()
  const team = entry.game.team_size > 1
  const open = entry.tournament.reg_open
  const players = entry.members?.filter((m) => m.role !== 'sub').length ?? 0

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="spread">
        <div className="stack" style={{ gap: 4 }}>
          <p className="tag-type t3">{team ? 'Your team' : 'Your entry'}</p>
          <p className="h3">{entry.name}</p>
        </div>
        {showEventLink && (
          <Link to={`/e/${entry.tournament.slug}`} className="btn btn-secondary btn-sm">Event</Link>
        )}
      </div>
      {entry.status === 'disqualified' && <p className="error-text">This entry was disqualified by the organisers.</p>}
      <p className="small t2">
        Your {entry.game.title} ID: <span className="num" style={{ color: 'var(--text-1)' }}>{entry.my_ig_id}</span>
      </p>
      {team && (
        <>
          <div className="rows">
            {entry.members?.map((m) => (
              <div key={m.username} className="link-row" style={{ minHeight: 52, padding: '10px 14px' }}>
                <span className="grow ellipsis">{m.username}</span>
                {m.role === 'captain' && <Crown size={16} className="t3" aria-label="Captain" />}
                {m.role === 'sub' && <span className="tag-type t3">SUB</span>}
                <HouseTag id={m.house_id} />
                {entry.is_captain && open && m.role !== 'captain' && (
                  <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label={`Remove ${m.username}`} onClick={() => setConfirm({ kind: 'kick', username: m.username })}>
                    <UserMinus size={16} />
                  </button>
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, entry.game.team_size - players) }, (_, i) => (
              <div key={`w${i}`} className="link-row t3" style={{ minHeight: 52, padding: '10px 14px' }}>
                Waiting for a player…
              </div>
            ))}
          </div>
          <p className="small t3 num">
            {players} / {entry.game.team_size} players{entry.game.max_subs ? ` · up to ${entry.game.max_subs} sub` : ''}
          </p>
          {entry.is_captain && entry.invite_code && open && (
            <InviteCode
              code={entry.invite_code}
              teamName={entry.name}
              eventTitle={entry.tournament.title}
              onRegenerate={() => regen.mutate(entry.entry_id, { onSuccess: () => toast({ kind: 'success', text: 'New invite code made. The old one no longer works.' }) })}
            />
          )}
        </>
      )}
      {open && (
        <Button kind="danger" size="sm" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirm({ kind: 'leave' })}>
          <LogOut size={16} aria-hidden /> {entry.is_captain ? (team ? 'Disband team' : 'Withdraw') : 'Leave team'}
        </Button>
      )}

      <Sheet
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'kick' ? `Remove ${confirm.username}?` : entry.is_captain && team ? 'Disband this team?' : entry.is_captain ? 'Withdraw from this event?' : 'Leave this team?'}
      >
        <div className="stack">
          <p className="t2">
            {confirm?.kind === 'kick'
              ? 'They can rejoin with the invite code while registration is open. Make a new code if you do not want that.'
              : entry.is_captain && team
                ? 'Everyone on the team will be removed from the event. You can register again while registration is open.'
                : 'You can register again while registration is open.'}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button kind="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              kind="danger-fill"
              busy={leave.isPending || kick.isPending}
              onClick={() => {
                const done = { onSuccess: () => setConfirm(null) }
                if (confirm?.kind === 'kick') kick.mutate({ id: entry.entry_id, u: confirm.username }, done)
                else leave.mutate(entry.entry_id, done)
              }}
            >
              {confirm?.kind === 'kick' ? 'Remove' : entry.is_captain && team ? 'Disband' : entry.is_captain ? 'Withdraw' : 'Leave'}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

export { regOpen }
