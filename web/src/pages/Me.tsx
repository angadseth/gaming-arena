import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, LogOut, MessageCircle, Shield } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EntryPanel } from '../components/event'
import { Button, Empty, ErrorBox, Field, Flap, GameCover, HouseTag, Sheet, Skeleton, StatusPill } from '../components/ui'
import { errorText, useApi, useAuth, useHouseName, useMyEntries, useRegionName, useToast } from '../lib/app'
import { fmtDate } from '../lib/format'

export default function Me() {
  const api = useApi()
  const qc = useQueryClient()
  const nav = useNavigate()
  const toast = useToast()
  const { profile, isStaff } = useAuth()
  const entries = useMyEntries()
  const houseName = useHouseName()
  const regionName = useRegionName()
  const [waOpen, setWaOpen] = useState(false)
  const [wa, setWa] = useState('')
  const [waErr, setWaErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!profile) return <div className="page"><Skeleton h={160} /></div>

  const list = entries.data ?? []
  const active = list.filter((e) => !['completed', 'cancelled'].includes(e.tournament.status))
  const past = list.filter((e) => ['completed', 'cancelled'].includes(e.tournament.status))
  const captains = list.filter((e) => e.is_captain && e.game.team_size > 1).length

  async function saveWa() {
    setBusy(true)
    setWaErr(null)
    try {
      await api.rpc('update_my_whatsapp', { p_whatsapp: wa })
      await qc.invalidateQueries({ queryKey: ['me'] })
      setWaOpen(false)
      toast({ kind: 'success', text: 'WhatsApp number updated' })
    } catch (e) {
      setWaErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page stack" style={{ gap: 24 }}>
      <header className="panel stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 14 }}>
          <div className="thumb contour" style={{ width: 64, height: 64, display: 'grid', placeItems: 'center' }}>
            <span className="h2" aria-hidden>{profile.username.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="stack grow" style={{ gap: 4, minWidth: 0 }}>
            <h1 className="h2 ellipsis" style={{ textTransform: 'none' }}>{profile.username}</h1>
            <span className="row wrap" style={{ gap: 8 }}>
              <HouseTag id={profile.house_id} />
              <span className="small t2">{houseName(profile.house_id)} · {regionName(profile.region_id)}</span>
            </span>
          </div>
        </div>
        <dl className="kv">
          <dt>Name</dt><dd>{profile.full_name}</dd>
          <dt>Email</dt><dd>{profile.email}</dd>
          <dt>WhatsApp</dt>
          <dd className="row" style={{ gap: 8 }}>
            <span className="num">{profile.whatsapp}</span>
            <button className="btn btn-ghost btn-sm" style={{ height: 28, padding: '0 8px' }} onClick={() => { setWa(profile.whatsapp); setWaOpen(true) }}>Change</button>
          </dd>
          <dt>Joined</dt><dd>{fmtDate(profile.created_at, false)}</dd>
        </dl>
        {profile.status !== 'active' && <p className="error-text">Your account is {profile.status}. Contact the organisers.</p>}
      </header>

      <div className="stats">
        <div><strong><Flap value={list.length} tiles /></strong><span className="tag-type t3">Events</span></div>
        <div><strong><Flap value={active.length} tiles /></strong><span className="tag-type t3">Active</span></div>
        <div><strong><Flap value={captains} tiles /></strong><span className="tag-type t3">Captain</span></div>
      </div>

      <section className="stack" style={{ gap: 12 }}>
        <div className="section-head"><h2>My events</h2></div>
        {entries.error ? (
          <ErrorBox error={entries.error} retry={() => entries.refetch()} />
        ) : entries.isPending ? (
          <Skeleton h={120} />
        ) : active.length === 0 ? (
          <Empty title="No events yet" text="Your registered events show up here." action={<Link to="/" className="btn btn-secondary">Browse events</Link>} />
        ) : (
          active.map((e) => (
            <div key={e.entry_id} className="panel stack" style={{ gap: 14 }}>
              <Link to={`/e/${e.tournament.slug}`} className="row">
                <div className="thumb"><GameCover game={{ title: e.game.title, short: '', cover_path: e.game.cover_path }} /></div>
                <span className="grow stack" style={{ gap: 4, minWidth: 0 }}>
                  <span className="ellipsis" style={{ fontWeight: 650 }}>{e.tournament.title}</span>
                  <span className="small t3">{e.tournament.starts_at ? `Starts ${fmtDate(e.tournament.starts_at)}` : 'Dates to be announced'}</span>
                </span>
                <StatusPill status={e.tournament.status} />
              </Link>
              <EntryPanel entry={e} />
            </div>
          ))
        )}
      </section>

      {past.length > 0 && (
        <section className="stack" style={{ gap: 12 }}>
          <div className="section-head"><h2>Past events</h2></div>
          <div className="rows">
            {past.map((e) => (
              <Link key={e.entry_id} to={`/e/${e.tournament.slug}?tab=standings`} className="link-row">
                <span className="grow ellipsis">{e.tournament.title}</span>
                <span className="small t3 ellipsis">{e.name}</span>
                <ChevronRight size={18} className="t3" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="rows">
        {isStaff && (
          <Link to="/admin" className="link-row">
            <Shield size={20} strokeWidth={1.75} className="t2" aria-hidden />
            <span className="grow">Admin console</span>
            <ChevronRight size={18} className="t3" aria-hidden />
          </Link>
        )}
        <Link to="/rules" className="link-row">
          <MessageCircle size={20} strokeWidth={1.75} className="t2" aria-hidden />
          <span className="grow">Rules, disputes and contact</span>
          <ChevronRight size={18} className="t3" aria-hidden />
        </Link>
      </div>

      <Button kind="danger" style={{ alignSelf: 'flex-start' }} onClick={async () => { await api.signOut(); qc.clear(); nav('/') }}>
        <LogOut size={18} aria-hidden /> Sign out
      </Button>

      <Sheet open={waOpen} onClose={() => setWaOpen(false)} title="WhatsApp number">
        <div className="stack">
          <Field label="WhatsApp number" htmlFor="wa" error={waErr} hint="Organisers use this to send lobby details. Nobody else sees it.">
            <input id="wa" className="input" type="tel" inputMode="tel" maxLength={18} value={wa} onChange={(e) => setWa(e.target.value)} />
          </Field>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button kind="ghost" onClick={() => setWaOpen(false)}>Cancel</Button>
            <Button kind="primary" busy={busy} onClick={saveWa}>Save</Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
