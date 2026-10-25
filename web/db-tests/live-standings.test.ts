import { beforeAll, describe, expect, it } from 'vitest'
import { freshDb, type Db } from './harness'

// 0017: houses and Top players move while an event is still running; no-shows score nothing;
// WhatsApp is optional at sign-up.
let db: Db
let su: string, a: string, b: string, c: string
let eventId: string

async function onboard(id: string, username: string, house: number, wa: string | null) {
  await db.as(id)
  await db.rpc('complete_profile', {
    p_username: username, p_full_name: `${username} Kumar`, p_house_id: house, p_region_id: 2,
    p_whatsapp: wa, p_accept_rules: true,
  })
}
async function houses() {
  await db.as('anon')
  const r = await db.query<{ house_id: number; points: string }>('select * from public.house_standings(null)')
  return new Map(r.rows.map((x) => [Number(x.house_id), Number(x.points)]))
}

beforeAll(async () => {
  db = await freshDb()
  su = await db.newUser('24f2004141@ds.study.iitm.ac.in')
  a = await db.newUser('23f1000011@ds.study.iitm.ac.in')
  b = await db.newUser('23f1000012@ds.study.iitm.ac.in')
  c = await db.newUser('23f1000013@ds.study.iitm.ac.in')
  await onboard(su, 'angad', 1, null)
  await onboard(a, 'alpha', 2, null)
  await onboard(b, 'bravo', 3, '98765 43210')
  await onboard(c, 'charlie', 4, '')
  await db.as('postgres')
  eventId = (await db.query<{ id: string }>(`select id from public.tournaments where slug = 'stumble-guys-s1'`)).rows[0].id
  await db.query(`update public.tournaments set status = 'open', reg_opens_at = null, reg_closes_at = null where id = $1`, [eventId])
  for (const [id, ig] of [[a, 'AlphaIG'], [b, 'BravoIG'], [c, 'CharlieIG']] as const) {
    await db.as(id)
    await db.rpc('register_solo', { p_tournament_id: eventId, p_ig_id: ig, p_extra: {} })
  }
  await db.as('postgres')
  await db.query(`update public.tournaments set status = 'closed' where id = $1`, [eventId])
}, 60_000)

describe('live standings', () => {
  it('sign-up works without a WhatsApp number (null or blank)', async () => {
    await db.as('postgres')
    const r = await db.query<{ username: string; whatsapp: string | null }>(`select username, whatsapp from public.profiles order by username`)
    const wa = Object.fromEntries(r.rows.map((x) => [x.username, x.whatsapp]))
    expect(wa.alpha).toBeNull()
    expect(wa.charlie).toBeNull()
    expect(wa.bravo).toBe('+919876543210')
  })

  it('a closed event with no results gives every house 0', async () => {
    const h = await houses()
    expect([...h.values()].every((p) => p === 0)).toBe(true)
  })

  it('results in a closed (not completed) event move the houses at once; no-shows earn nothing', async () => {
    await db.as(su)
    const res = await db.rpc<{ ok: boolean }>('admin_record_match', {
      p_tournament_id: eventId, p_label: 'Game 1', p_played_at: null,
      p_rows: [{ username: 'bravo', placement: 1 }, { username: 'alpha', placement: 2 }], p_replace: false,
    })
    expect(res.ok).toBe(true)
    const h = await houses()
    expect(h.get(3)).toBe(1000) // bravo 1st
    expect(h.get(2)).toBe(700) // alpha 2nd
    expect(h.get(4)).toBe(0) // charlie never played
  })

  it('a ± points change re-orders the houses', async () => {
    await db.as('postgres')
    const alphaEntry = (await db.query<{ id: string }>(
      `select e.id from public.entries e join public.entry_members m on m.entry_id = e.id
       join public.profiles p on p.id = m.user_id where p.username = 'alpha'`)).rows[0].id
    await db.as(su)
    await db.rpc('admin_adjust_points', { p_entry_id: alphaEntry, p_points_adjust: 5000, p_note: 'test' })
    const h = await houses()
    expect(h.get(2)).toBe(1000)
    expect(h.get(3)).toBe(700)
  })

  it('Top players shows the same live order', async () => {
    await db.as(su)
    const r = await db.query<{ username: string; total: string }>(`select username, total from public.player_rankings('all', null)`)
    expect(r.rows.map((x) => x.username)).toEqual(['alpha', 'bravo'])
    expect(Number(r.rows[0].total)).toBe(2)
  })
})
