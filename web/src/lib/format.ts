import type { Game, GameMode, Tournament, TournamentStatus } from './types'

/** House identity: 3-letter ranger codes and the park each house is named after. */
export const HOUSE_META: Record<number, { code: string; park: string; color: string }> = {
  1: { code: 'BAN', park: 'Bandipur National Park, Karnataka', color: '#ffb547' },
  2: { code: 'COR', park: 'Jim Corbett National Park, Uttarakhand', color: '#ff7a45' },
  3: { code: 'GIR', park: 'Gir National Park, Gujarat', color: '#e9c46a' },
  4: { code: 'KAN', park: 'Kanha National Park, Madhya Pradesh', color: '#a3d65c' },
  5: { code: 'KAZ', park: 'Kaziranga National Park, Assam', color: '#8ec5ff' },
  6: { code: 'NAL', park: 'Nallamala Forest, Andhra Pradesh and Telangana', color: '#cf9cf0' },
  7: { code: 'NAM', park: 'Namdapha National Park, Arunachal Pradesh', color: '#5eead4' },
  8: { code: 'NIL', park: 'Nilgiri Biosphere Reserve, Tamil Nadu', color: '#7dd3fc' },
  9: { code: 'PIC', park: 'Pichavaram Mangrove Forest, Tamil Nadu', color: '#4ade80' },
  10: { code: 'SAR', park: 'Saranda Forest, Jharkhand', color: '#f78fc4' },
  11: { code: 'SUN', park: 'Sundarbans National Park, West Bengal', color: '#ff8a8a' },
  12: { code: 'WAY', park: 'Wayanad Wildlife Sanctuary, Kerala', color: '#fde047' },
}

export const houseColor = (id: number | null | undefined) => (id ? (HOUSE_META[id]?.color ?? '#9db3ae') : '#9db3ae')

/** Foil hue for each game's collectible card; admins can override with games.accent. */
const GAME_HUE: Record<string, string> = {
  bgmi: '#f4a62a',
  'ff-max': '#ff6b3d',
  codm: '#9be15d',
  'clash-royale': '#5aa9ff',
  'brawl-stars': '#ffd23f',
  'pokemon-unite': '#b99cff',
  efootball: '#3dd6c6',
  'real-cricket': '#7fd36b',
  'asphalt-legends': '#ff4f8b',
  'stumble-guys': '#ff9edb',
  'ludo-king': '#ffdf4f',
  valorant: '#ff4655',
  cs2: '#f2b544',
  chess: '#e8e1cf',
  skribbl: '#6fc8ff',
  'smash-karts': '#ff7a2e',
  'clash-of-clans': '#f6c343',
  'among-us': '#ff3d4f',
  extra: '#b99cff',
}
/**
 * Background photo for each game's card (web/public/art, sources in CREDITS.md) and the
 * horizontal focus point used when a wide image is cropped into a tall card.
 */
const GAME_ART: Record<string, string> = {
  bgmi: '75%', 'ff-max': '35%', codm: '55%', 'clash-royale': '72%', 'brawl-stars': '78%',
  'pokemon-unite': '60%', efootball: '62%', 'real-cricket': '28%', 'asphalt-legends': '50%',
  'stumble-guys': '50%', 'ludo-king': '50%', valorant: '50%', cs2: '80%', chess: '50%', skribbl: '50%',
  'smash-karts': '50%', 'clash-of-clans': '62%', 'among-us': '50%',
}
export const gameArt = (slug: string | undefined) =>
  slug && slug in GAME_ART ? { src: `${import.meta.env.BASE_URL}art/${slug}.webp`, focus: GAME_ART[slug] } : null

export const gameHue = (g: { slug?: string; accent?: string | null } | null | undefined) =>
  (g?.accent && /^#[0-9a-f]{6}$/i.test(g.accent) ? g.accent : g?.slug ? GAME_HUE[g.slug] : undefined) ?? '#ffc23d'

export const houseCode = (id: number | null | undefined) => (id ? (HOUSE_META[id]?.code ?? '—') : 'MIX')

const IST: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata' }

export function fmtDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return 'TBA'
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short' })
  if (!withTime) return date
  const time = d.toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date}, ${time.toUpperCase()} IST`
}

export function fmtShort(iso: string | null | undefined): string {
  if (!iso) return 'TBA'
  return new Date(iso).toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short' }).toUpperCase()
}

export function relative(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(ms)
  const units: [number, string][] = [
    [86_400_000, 'd'],
    [3_600_000, 'h'],
    [60_000, 'm'],
  ]
  for (const [size, u] of units) {
    if (abs >= size) {
      const n = Math.floor(abs / size)
      return ms > 0 ? `in ${n}${u}` : `${n}${u} ago`
    }
  }
  return 'now'
}

export function teamSizeLabel(g: Pick<Game, 'mode' | 'team_size'>): string {
  const labels: Record<GameMode, string> = { solo: 'SOLO', duo: 'DUO', squad: `SQUAD ${g.team_size}`, team: `${g.team_size}V${g.team_size}` }
  return labels[g.mode]
}

const PLATFORM_LABEL: Record<string, string> = {
  android: 'Android', ios: 'iOS', pc: 'PC', web: 'Web', console: 'Console', windows: 'PC', mac: 'Mac',
}
export const platformLabel = (p: string) => PLATFORM_LABEL[p.toLowerCase()] ?? p

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: 'Draft', upcoming: 'Upcoming', open: 'Open', closed: 'Closed', live: 'Live', completed: 'Completed', cancelled: 'Cancelled',
}

/** Registration open right now (mirrors public.registration_open). */
export function regOpen(t: Tournament, now = Date.now()): boolean {
  return (
    t.status === 'open' &&
    (!t.reg_opens_at || now >= new Date(t.reg_opens_at).getTime()) &&
    (!t.reg_closes_at || now < new Date(t.reg_closes_at).getTime())
  )
}

/** Sort weight for "most urgent first" on the events page. */
export function urgency(t: Tournament): number {
  const order: Record<TournamentStatus, number> = { live: 0, open: 1, upcoming: 2, closed: 3, completed: 4, cancelled: 5, draft: 6 }
  return order[t.status]
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export const fmtPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))

/** Drops colour tags some games allow in names ("[color=red]Rahul[/color]"); the name itself stays. */
export const cleanIgName = (s: string) => s.replace(/\[\/?colou?r[^\]]*\]|<\/?colou?r[^>]*>/gi, '').trim()

/** Same folding as public.ig_key: NFKC, no spaces or invisible characters, lower case. */
export const igNorm = (s: string) => cleanIgName(s.normalize('NFKC')).replace(/[\s​-‏⁠﻿­]/g, '').toLowerCase()

/** Clock time in IST, e.g. "8:50 pm". */
export const fmtClock = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
