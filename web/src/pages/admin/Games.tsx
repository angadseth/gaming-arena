import { ChevronRight, ImageUp, Plus } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Empty, ErrorBox, Field, GameCover, MetaLine, Skeleton } from '../../components/ui'
import { errorText, useAction, useApi, useAuth, useGames, useToast } from '../../lib/app'
import { gameHue, platformLabel, teamSizeLabel } from '../../lib/format'
import type { Game, GameMode } from '../../lib/types'
import { AdminHeader, gap, parseJson, ReadOnlyNote, resizeToWebp } from './shared'

export default function Games() {
  const games = useGames()
  const { isAdmin } = useAuth()
  if (games.error) return <ErrorBox error={games.error} retry={() => games.refetch()} />
  return (
    <>
      <AdminHeader
        title="Games"
        sub="The catalog. Each event (tournament) belongs to one game."
        actions={
          isAdmin && (
            <Link to="/admin/games/new" className="btn btn-primary btn-sm">
              <Plus size={16} aria-hidden /> New game
            </Link>
          )
        }
      />
      {games.isPending ? (
        <Skeleton h={300} />
      ) : games.data.length === 0 ? (
        <Empty title="No games yet" text="Add the first game to start creating events." />
      ) : (
        <div className="rows">
          {games.data.map((g) => (
            <Link key={g.id} to={`/admin/games/${g.id}`} className="link-row">
              <div className="thumb">
                <GameCover game={g} />
              </div>
              <div className="grow stack" style={gap(4)}>
                <span className="ellipsis" style={{ fontWeight: 600 }}>
                  {g.title} {!g.is_active && <span className="pill pill-draft">Hidden</span>}
                </span>
                <MetaLine parts={[teamSizeLabel(g), g.platforms.map(platformLabel).join(' · '), g.slug]} />
              </div>
              <ChevronRight size={18} className="t3" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

interface Form {
  slug: string
  title: string
  short: string
  description: string
  platforms: string
  mode: GameMode
  team_size: string
  max_subs: string
  ig_id_label: string
  ig_id_pattern: string
  ig_id_hint: string
  extra_fields: string
  rules: string
  scoring: string
  placement_points: string
  kill_points: string
  match_minutes: string
  verify_note: string
  cover_path: string
  accent: string
  is_active: boolean
  sort_order: string
}

const EMPTY: Form = {
  slug: '', title: '', short: '', description: '', platforms: 'android, ios', mode: 'solo', team_size: '1', max_subs: '0',
  ig_id_label: 'In-game ID', ig_id_pattern: '^.{2,40}$', ig_id_hint: '', extra_fields: '[]', rules: '', scoring: '',
  placement_points: '{"1": 1000, "2": 700, "3": 500, "4": 400, "5-8": 200, "9-16": 100}', kill_points: '0', match_minutes: '',
  verify_note: '', cover_path: '', accent: '', is_active: true, sort_order: '0',
}

function toForm(g: Game): Form {
  return {
    slug: g.slug, title: g.title, short: g.short, description: g.description, platforms: g.platforms.join(', '),
    mode: g.mode, team_size: String(g.team_size), max_subs: String(g.max_subs), ig_id_label: g.ig_id_label,
    ig_id_pattern: g.ig_id_pattern, ig_id_hint: g.ig_id_hint, extra_fields: JSON.stringify(g.extra_fields, null, 2),
    rules: g.rules.join('\n'), scoring: g.scoring, placement_points: JSON.stringify(g.placement_points),
    kill_points: String(g.kill_points), match_minutes: g.match_minutes == null ? '' : String(g.match_minutes),
    verify_note: g.verify_note, cover_path: g.cover_path ?? '', accent: g.accent ?? '', is_active: g.is_active,
    sort_order: String(g.sort_order),
  }
}

const TEAM_HINT: Record<GameMode, string> = {
  solo: 'Solo is always 1.', duo: 'Duo is always 2.', squad: 'Squad is 3 or 4.', team: 'Team is 2 to 10.',
}

/** Keyed by id so moving between games remounts the form with fresh state. */
export function GameEditor() {
  const { id } = useParams()
  return <GameForm key={id ?? 'new'} id={id} />
}

function GameForm({ id }: { id: string | undefined }) {
  const isNew = !id
  const games = useGames()
  const api = useApi()
  const toast = useToast()
  const nav = useNavigate()
  const { isAdmin } = useAuth()
  const existing = games.data?.find((g) => g.id === id)
  const [f, setF] = useState<Form>(EMPTY)
  const [loaded, setLoaded] = useState(isNew)
  const [uploading, setUploading] = useState(false)
  const [errs, setErrs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (existing && !loaded) {
      setF(toForm(existing))
      setLoaded(true)
    }
  }, [existing, loaded])

  const save = useAction((a, p: Record<string, unknown>) => a.rpc<string>('admin_upsert_game', { p }), [['games'], ['tournaments']])

  if (!isNew && !existing && (games.isPending || games.isFetching)) return <Skeleton h={400} />
  if (!isNew && !existing) return <Empty title="Game not found" text="It may have been removed." />

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }))
  const text = (k: keyof Form, label: string, hint?: string, extra?: { mono?: boolean; placeholder?: string }) => (
    <Field label={label} hint={hint} error={errs[k]} htmlFor={`g-${k}`}>
      <input
        id={`g-${k}`}
        className={`input${extra?.mono ? ' num' : ''}`}
        value={String(f[k])}
        placeholder={extra?.placeholder}
        disabled={!isAdmin}
        onChange={(e) => set(k, e.target.value as never)}
      />
    </Field>
  )

  async function onCover(file: File | undefined) {
    if (!file) return
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(f.slug)) {
      toast({ kind: 'error', text: 'Set a valid slug before uploading art.' })
      return
    }
    setUploading(true)
    try {
      const blob = await resizeToWebp(file)
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
      const path = await api.uploadArt(blob, `games/${f.slug}-${Date.now()}.${ext}`)
      set('cover_path', path)
      toast({ kind: 'success', text: 'Art uploaded. Save the game to use it.' })
    } catch (e) {
      toast({ kind: 'error', text: errorText(e) })
    } finally {
      setUploading(false)
    }
  }

  function submit() {
    const e: Record<string, string> = {}
    const [extra, exErr] = parseJson<unknown[]>(f.extra_fields, 'array')
    if (exErr) e.extra_fields = exErr
    const [pp, ppErr] = parseJson<Record<string, number>>(f.placement_points, 'object')
    if (ppErr) e.placement_points = ppErr
    try {
      new RegExp(f.ig_id_pattern)
    } catch {
      e.ig_id_pattern = 'Not a valid regular expression'
    }
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(f.slug)) e.slug = '2-40 characters: a-z, 0-9 and -'
    if (f.title.trim().length < 2) e.title = 'Required'
    if (f.accent && !/^#[0-9A-Fa-f]{6}$/.test(f.accent)) e.accent = 'Hex like #F4B740, or empty'
    setErrs(e)
    if (Object.keys(e).length) {
      toast({ kind: 'error', text: 'Fix the highlighted fields.' })
      return
    }
    const p = {
      id: id ?? '',
      slug: f.slug.trim(),
      title: f.title.trim(),
      short: f.short.trim(),
      description: f.description.trim(),
      platforms: f.platforms.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      mode: f.mode,
      team_size: Number(f.team_size),
      max_subs: Number(f.max_subs),
      ig_id_label: f.ig_id_label.trim(),
      ig_id_pattern: f.ig_id_pattern,
      ig_id_hint: f.ig_id_hint.trim(),
      extra_fields: extra,
      rules: f.rules.split('\n').map((s) => s.trim()).filter(Boolean),
      scoring: f.scoring.trim(),
      placement_points: pp,
      kill_points: Number(f.kill_points || 0),
      match_minutes: f.match_minutes,
      verify_note: f.verify_note.trim(),
      cover_path: f.cover_path,
      accent: f.accent,
      is_active: f.is_active,
      sort_order: Number(f.sort_order || 0),
    }
    save.mutate(p, {
      onSuccess: (newId) => {
        toast({ kind: 'success', text: isNew ? 'Game created.' : 'Game saved.' })
        if (isNew && newId) nav(`/admin/games/${newId}`, { replace: true })
      },
    })
  }

  return (
    <>
      <AdminHeader title={isNew ? 'New game' : f.title || 'Game'} sub={<Link to="/admin/games">Back to games</Link>} />
      {!isAdmin && <ReadOnlyNote />}

      <div className="admin-two">
        <div className="stack">
          <div className="section-head">
            <h2>Identity</h2>
          </div>
          <div className="form-grid two">
            {text('title', 'Title', undefined, { placeholder: 'Battlegrounds Mobile India' })}
            {text('short', 'Short name', 'Shown on cards, e.g. BGMI')}
            {text('slug', 'Slug', 'Used in links; lowercase, numbers and -', { mono: true })}
            {text('platforms', 'Platforms', 'Comma separated: android, ios, pc, web, console')}
          </div>
          <Field label="Description / format" htmlFor="g-description">
            <textarea id="g-description" className="textarea" value={f.description} disabled={!isAdmin} onChange={(e) => set('description', e.target.value)} />
          </Field>

          <div className="section-head">
            <h2>Teams</h2>
          </div>
          <div className="form-grid two">
            <Field label="Mode" hint={TEAM_HINT[f.mode]} htmlFor="g-mode">
              <select
                id="g-mode"
                className="select"
                value={f.mode}
                disabled={!isAdmin}
                onChange={(e) => {
                  const m = e.target.value as GameMode
                  setF((s) => ({ ...s, mode: m, team_size: m === 'solo' ? '1' : m === 'duo' ? '2' : m === 'squad' ? '4' : '5', max_subs: m === 'solo' ? '0' : s.max_subs }))
                }}
              >
                <option value="solo">Solo</option>
                <option value="duo">Duo</option>
                <option value="squad">Squad</option>
                <option value="team">Team</option>
              </select>
            </Field>
            {text('team_size', 'Team size', undefined, { mono: true })}
            {text('max_subs', 'Max substitutes', '0 to 3', { mono: true })}
            {text('sort_order', 'Sort order', 'Lower shows first', { mono: true })}
          </div>

          <div className="section-head">
            <h2>Registration fields</h2>
          </div>
          <div className="form-grid two">
            {text('ig_id_label', 'In-game ID label', 'e.g. BGMI Character ID')}
            {text('ig_id_pattern', 'In-game ID pattern (regex)', 'Checked in the browser and again on the server', { mono: true })}
          </div>
          {text('ig_id_hint', 'In-game ID hint', 'Where players find their ID')}
          <Field
            label="Extra fields (JSON)"
            error={errs.extra_fields}
            hint='[{"key": "ign", "label": "In-game name", "pattern": "^.{2,20}$", "hint": "...", "required": true}]'
            htmlFor="g-extra"
          >
            <textarea id="g-extra" className="textarea mono" value={f.extra_fields} disabled={!isAdmin} onChange={(e) => set('extra_fields', e.target.value)} />
          </Field>

          <div className="section-head">
            <h2>Rules and scoring</h2>
          </div>
          <Field label="Rules" hint="One rule per line" htmlFor="g-rules">
            <textarea id="g-rules" className="textarea" value={f.rules} disabled={!isAdmin} onChange={(e) => set('rules', e.target.value)} />
          </Field>
          {text('scoring', 'Scoring summary')}
          <div className="form-grid two">
            <Field label="Default placement points (JSON)" error={errs.placement_points} hint='Ranges allowed: {"1": 1000, "5-8": 200}' htmlFor="g-pp">
              <input id="g-pp" className="input num" value={f.placement_points} disabled={!isAdmin} onChange={(e) => set('placement_points', e.target.value)} />
            </Field>
            {text('kill_points', 'Points per kill', 'Copied to new events', { mono: true })}
            {text('match_minutes', 'Match length (minutes)', undefined, { mono: true })}
            {text('verify_note', 'How results are verified')}
          </div>
        </div>

        <aside className="stack">
          <div className="section-head">
            <h2>Card art</h2>
          </div>
          <div className="game-card" style={{ maxWidth: 280, '--hue': gameHue({ slug: f.slug, accent: f.accent || null }) } as CSSProperties}>
            <GameCover game={{ title: f.title || 'Game', short: f.short, cover_path: f.cover_path || null, slug: f.slug }} />
            <div className="game-card-body">
              <span className="game-card-title">{f.short || f.title || 'Game'}</span>
            </div>
          </div>
          {isAdmin && (
            <label className="btn btn-secondary btn-sm" style={{ width: 'max-content' }}>
              <ImageUp size={16} aria-hidden />
              {uploading ? 'Uploading…' : 'Upload art'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  void onCover(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          )}
          <p className="hint">4:5 crop on cards, 16:9 on the event page. Resized to 1200px WebP, 500 KB max. No SVG.</p>
          {f.cover_path && isAdmin && (
            <Button kind="ghost" size="sm" onClick={() => set('cover_path', '')}>
              Remove art
            </Button>
          )}
          {text('accent', 'Accent (optional)', 'Hex for the card frame and foil; empty uses the game default', { mono: true })}
          <label className="check">
            <input type="checkbox" checked={f.is_active} disabled={!isAdmin} onChange={(e) => set('is_active', e.target.checked)} />
            <span>Visible to players</span>
          </label>
          {existing && isAdmin && <PlayEditor game={existing} />}
        </aside>
      </div>

      {isAdmin && (
        <div className="row admin-save" style={gap(12)}>
          <Button kind="primary" busy={save.isPending} onClick={submit}>
            {isNew ? 'Create game' : 'Save game'}
          </Button>
          <Link to="/admin/games" className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      )}
    </>
  )
}

const NL = '\n'

/** Play links ("kind | label | url" per line) and room-join steps shown in every event's Lobby tab. */
function PlayEditor({ game }: { game: Game }) {
  const toast = useToast()
  const [links, setLinks] = useState(() => (game.play_links ?? []).map((l) => `${l.kind} | ${l.label} | ${l.url}`).join(NL))
  const [steps, setSteps] = useState(() => (game.join_steps ?? []).join(NL))
  const [err, setErr] = useState<string | null>(null)
  const save = useAction((a, args: Record<string, unknown>) => a.rpc('admin_set_game_play', args), [['games']])

  function submit() {
    const parsed = links.split(NL).map((l) => l.trim()).filter(Boolean).map((l) => {
      const [kind, label, ...url] = l.split('|').map((x) => x.trim())
      return { kind, label, url: url.join('|') }
    })
    const bad = parsed.find((p) => !['web', 'android', 'ios', 'pc', 'mac', 'console'].includes(p.kind) || !p.label || !p.url.startsWith('https://'))
    if (bad) return setErr('Each line: kind | label | https://link (kind = web, android, ios, pc, mac, console)')
    setErr(null)
    save.mutate(
      { p_game_id: game.id, p_play_links: parsed, p_join_steps: steps.split(NL).map((s) => s.trim()).filter(Boolean) },
      { onSuccess: () => toast({ kind: 'success', text: 'Play links saved' }) },
    )
  }

  return (
    <>
      <div className="section-head">
        <h2>Lobby: play links</h2>
      </div>
      <Field label="Links" error={err} hint="One per line: android | Google Play | https://..." htmlFor="g-play">
        <textarea id="g-play" className="textarea mono" rows={4} value={links} onChange={(e) => setLinks(e.target.value)} />
      </Field>
      <Field label="How to join the room" hint="One short step per line (max 12)" htmlFor="g-steps">
        <textarea id="g-steps" className="textarea" rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} />
      </Field>
      <Button size="sm" busy={save.isPending} onClick={submit}>Save play links</Button>
    </>
  )
}
