import type { Game, GameMode, Tournament, TournamentStatus } from './types'

/** House identity: 3-letter ranger codes and the park each house is named after. */
export const HOUSE_META: Record<number, { code: string; park: string }> = {
  1: { code: 'BAN', park: 'Bandipur National Park, Karnataka' },
  2: { code: 'COR', park: 'Jim Corbett National Park, Uttarakhand' },
  3: { code: 'GIR', park: 'Gir National Park, Gujarat' },
  4: { code: 'KAN', park: 'Kanha National Park, Madhya Pradesh' },
  5: { code: 'KAZ', park: 'Kaziranga National Park, Assam' },
  6: { code: 'NAL', park: 'Nallamala Forest, Andhra Pradesh and Telangana' },
  7: { code: 'NAM', park: 'Namdapha National Park, Arunachal Pradesh' },
  8: { code: 'NIL', park: 'Nilgiri Biosphere Reserve, Tamil Nadu' },
  9: { code: 'PIC', park: 'Pichavaram Mangrove Forest, Tamil Nadu' },
  10: { code: 'SAR', park: 'Saranda Forest, Jharkhand' },
  11: { code: 'SUN', park: 'Sundarbans National Park, West Bengal' },
  12: { code: 'WAY', park: 'Wayanad Wildlife Sanctuary, Kerala' },
}

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
