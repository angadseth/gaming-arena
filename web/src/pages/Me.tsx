import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Lock, LogOut, MessageCircle, PencilLine, Shield, Shuffle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, AVATAR_GROUPS, avatarKey } from '../components/Avatar'
import { EntryPanel } from '../components/event'
import { PlayerCard } from '../components/PlayerCard'
import { Button, Empty, ErrorBox, Field, Flap, GameCover, HouseTag, Sheet, Skeleton, StatusPill } from '../components/ui'
import { errorText, useApi, useAuth, useHouseName, useMyEntries, useRegionName, useToast } from '../lib/app'
import { fmtDate } from '../lib/format'
import { StaffBadge } from '../components/StaffBadge'

export default function Me() {
  const api = useApi()
  const qc = useQueryClient()
  const nav = useNavigate()
  const toast = useToast()
  const { profile, isStaff } = useAuth()
  const entries = useMyEntries()
  const houseName = useHouseName()
  const regionName = useRegionName()
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ full_name: '', whatsapp: '' })
  const [editErr, setEditErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [picOpen, setPicOpen] = useState(false)
  const [picSeed, setPicSeed] = useState(() => Math.random().toString(36).slice(2, 6))
  const [picBusy, setPicBusy] = useState<string | null>(null)

  if (!profile) return <div className="page"><Skeleton h={160} /></div>

  const list = entries.data ?? []
  const active = list.filter((e) => !['completed', 'cancelled'].includes(e.tournament.status))
  const past = list.filter((e) => ['completed', 'cancelled'].includes(e.tournament.status))
  const captains = list.filter((e) => e.is_captain && e.game.team_size > 1).length

  function openEdit() {
    setForm({ full_name: profile!.full_name, whatsapp: profile!.whatsapp ?? '' })
    setEditErr(null)
    setEditOpen(true)
  }

  async function pickAvatar(key: string) {
    setPicBusy(key)
    try {
      await api.rpc('set_my_avatar', { p_avatar: key })
      await qc.invalidateQueries({ queryKey: ['me'] })
      await qc.invalidateQueries({ queryKey: ['player-rankings'] })
      await qc.invalidateQueries({ queryKey: ['standings'] })
      setPicOpen(false)
      toast({ kind: 'success', text: 'Profile picture updated' })
    } catch (e) {
      toast({ kind: 'error', text: errorText(e) })
    } finally {
      setPicBusy(null)
    }
  }

  async function saveProfile() {
    setBusy(true)
    setEditErr(null)
    try {
      await api.rpc('update_my_profile', { p_username: profile!.username, p_full_name: form.full_name, p_whatsapp: form.whatsapp })
      await qc.invalidateQueries({ queryKey: ['me'] })
      await qc.invalidateQueries({ queryKey: ['my-entries'] })
      await qc.invalidateQueries({ queryKey: ['standings'] })
      setEditOpen(false)
      toast({ kind: 'success', text: 'Profile saved' })
    } catch (e) {
      setEditErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page stack" style={{ gap: 24 }}>
      <header className="panel stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 14 }}>
          <button className="avatar-btn" onClick={() => setPicOpen(true)} aria-label="Change profile picture" disabled={profile.status !== 'active'}>
            <Avatar value={avatarKey(profile.avatar, profile.username)} size={72} ring="var(--accent)" />
            <span className="avatar-edit" aria-hidden><PencilLine size={14} /></span>
          </button>
          <div className="stack grow" style={{ gap: 4, minWidth: 0 }}>
            <h1 className="h2 ellipsis" style={{ textTransform: 'none' }}>{profile.username}</h1>
            <StaffBadge username={profile.username} />
            <span className="row wrap" style={{ gap: 8 }}>
              <HouseTag id={profile.house_id} />
              <span className="small t2">{houseName(profile.house_id)} · {regionName(profile.region_id)}</span>
            </span>
          </div>
        </div>
        <Button size="sm" style={{ alignSelf: 'flex-start' }} onClick={openEdit} disabled={profile.status !== 'active'}>
          <PencilLine size={16} aria-hidden /> Edit profile
        </Button>
        <dl className="kv">
          <dt>Name</dt><dd>{profile.full_name}</dd>
          <dt>Email</dt><dd>{profile.email}</dd>
          <dt>WhatsApp</dt>
          <dd className="num">{profile.whatsapp ?? 'Not added (optional)'}</dd>
          <dt>Joined</dt><dd>{fmtDate(profile.created_at, false)}</dd>
        </dl>
        {profile.status !== 'active' && <p className="error-text">Your account is {profile.status}. Contact the organisers.</p>}
      </header>

      <PlayerCard />

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
                <div className="thumb"><GameCover game={{ title: e.game.title, short: '', cover_path: e.game.cover_path, slug: e.game.slug }} /></div>
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

      <Button kind="danger" style={{ alignSelf: 'flex-start' }} onClick={async () => { await api.signOut(); nav('/') }}>
        <LogOut size={18} aria-hidden /> Sign out
      </Button>

      <Sheet open={picOpen} onClose={() => setPicOpen(false)} title="Profile picture">
        <div className="stack">
          <p className="small t2">Pick any avatar. It shows on leaderboards and the top-player cards.</p>
          {AVATAR_GROUPS.map((grp) => (
            <section key={grp.title} className="avatar-group stack" style={{ gap: 10 }}>
              <h3 className="avatar-group-h">{grp.title}</h3>
              {grp.styles.map((st) => (
                <div key={st.key} className="stack" style={{ gap: 8 }}>
                  <span className="tag-type t3">{st.label}</span>
                  <div className="avatar-grid">
                    {Array.from({ length: 6 }, (_, i) => {
                      const key = `${st.key}:${picSeed}${i}`
                      const current = profile.avatar === key
                      return (
                        <button key={key} className="avatar-pick" aria-pressed={current} aria-label={`${grp.title} ${st.label} avatar ${i + 1}`} disabled={!!picBusy} onClick={() => pickAvatar(key)}>
                          <Avatar value={key} size={56} />
                          {(current || picBusy === key) && <span className="avatar-check" aria-hidden><Check size={14} /></span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Button kind="ghost" onClick={() => setPicSeed(Math.random().toString(36).slice(2, 6))}>
              <Shuffle size={16} aria-hidden /> Show more
            </Button>
            {profile.avatar && <Button kind="ghost" onClick={() => pickAvatar('')}>Use default</Button>}
          </div>
          <p className="small t3">Avatars by DiceBear: Adventurer by Lisa Wischofsky (CC BY 4.0), Avataaars and Bottts by Pablo Stanley.</p>
        </div>
      </Sheet>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit profile">
        <form className="stack" onSubmit={(e) => { e.preventDefault(); saveProfile() }} noValidate>
          <Field label="Username" htmlFor="ed-username" hint="Fixed for good once chosen, so every board and result stays yours.">
            <div className="input row" id="ed-username" aria-readonly style={{ gap: 8, opacity: 0.75 }}>
              <Lock size={16} aria-hidden />
              <span className="ellipsis">{profile.username}</span>
            </div>
          </Field>
          <Field label="Full name" htmlFor="ed-name" hint="As on your IITM records. Only organisers see it.">
            <input id="ed-name" className="input" autoComplete="name" maxLength={60} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="WhatsApp number" htmlFor="ed-wa" hint="Optional. Organisers use it to send lobby details. Nobody else sees it.">
            <input id="ed-wa" className="input" type="tel" inputMode="tel" autoComplete="tel" maxLength={18} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </Field>
          {editErr && <p className="error-text" role="alert">{editErr}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button kind="ghost" type="button" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button kind="primary" type="submit" busy={busy}>Save changes</Button>
          </div>
        </form>
      </Sheet>
    </div>
  )
}
