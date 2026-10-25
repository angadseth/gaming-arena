import { beforeAll, describe, expect, it } from 'vitest'
import { freshDb, type Db } from './harness'

// 0019: a board per game night (IST date, day turns at 06:00) and an Overall board per game.
let db: Db
let su: string, a: string, b: string, c: string
let eventId: string, gameId: string

async function onboard(id: string, username: string, house: number) {
  await db.as(id)
  await db.rpc('complete_profile', {
    p_username: username, p_full_name: `${username} Kumar`, p_house_id: house, p_region_id: 2,
    p_whatsapp: null, p_accept_rules: true,
  })
}
async function game(label: string, at: string, rows: { username: string; placement: number }[]) {
  await db.as(su)
  const r = await db.rpc<{ ok: boolean }>('admin_record_match', {
    p_tournament_id: eventId, p_label: label, p_played_at: at, p_rows: rows, p_replace: false,
  })
  expect(r.ok).toBe(true)
}
async function board(as: string, night: string | null) {
  await db.as(as)
  return db.rpc<{ total: number; rows: { rank: number; username: string; points: number; games: number; is_me: boolean }[] }>(
    'game_board', { p_game_id: gameId, p_night: night })
}

beforeAll(async () => {
  db = await freshDb()
  su = await db.newUser('24f2004141@ds.study.iitm.ac.in')
  a = await db.newUser('23f1000021@ds.study.iitm.ac.in')
  b = await db.newUser('23f1000022@ds.study.iitm.ac.in')
  c = await db.newUser('23f1000023@ds.study.iitm.ac.in')
  await onboard(su, 'angad', 1)
  await onboard(a, 'alpha', 2)
  await onboard(b, 'bravo', 3)
  await onboard(c, 'charlie', 4)
  await db.as('postgres')
  const t = (await db.query<{ id: string; game_id: string }>(`select id, game_id from public.tournaments where slug = 'stumble-guys-s1'`)).rows[0]
  eventId = t.id
  gameId = t.game_id
  await db.query(`update public.tournaments set status = 'open', reg_opens_at = null, reg_closes_at = null where id = $1`, [eventId])
  for (const [id, ig] of [[a, 'AlphaIG'], [b, 'BravoIG'], [c, 'CharlieIG']] as const) {
    await db.as(id)
    await db.rpc('register_solo', { p_tournament_id: eventId, p_ig_id: ig, p_extra: {} })
  }
  // Night 1 = 25 Oct IST: 21:00 and 00:30 (after midnight still counts for the 25th).
  await game('Night 1 Game 1', '2026-10-25T15:30:00Z', [{ username: 'alpha', placement: 1 }, { username: 'bravo', placement: 2 }])
  await game('Night 1 Game 2', '2026-10-25T19:00:00Z', [{ username: 'alpha', placement: 1 }, { username: 'bravo', placement: 2 }])
  // Night 2 = 26 Oct IST.
  await game('Night 2 Game 1', '2026-10-26T15:30:00Z', [{ username: 'bravo', placement: 1 }, { username: 'charlie', placement: 2 }])
}, 60_000)

describe('game nights', () => {
  it('lists the game with two nights, newest first, numbered', async () => {
    await db.as('anon')
    const idx = await db.rpc<{ game_id: string; nights: { night: string; n: number; games: number; players: number }[] }[]>('boards_index')
    expect(idx).toHaveLength(1)
    expect(idx[0].game_id).toBe(gameId)
    expect(idx[0].nights.map((n) => [n.night, n.n, n.games, n.players])).toEqual([
      ['2026-10-26', 2, 1, 2],
      ['2026-10-25', 1, 2, 2],
    ])
  })

  it('night 1 board counts only that night (00:30 IST game included)', async () => {
    const r = await board(su, '2026-10-25')
    expect(r.total).toBe(2)
    expect(r.rows.map((x) => [x.rank, x.username, x.games])).toEqual([[1, 'alpha', 2], [2, 'bravo', 2]])
  })

  it('night 2 board is separate', async () => {
    const r = await board(su, '2026-10-26')
    expect(r.rows.map((x) => [x.rank, x.username])).toEqual([[1, 'bravo'], [2, 'charlie']])
  })

  it('overall adds every night and the ± points', async () => {
    await db.as('postgres')
    const ch = (await db.query<{ id: string }>(
      `select e.id from public.entries e join public.entry_members m on m.entry_id = e.id
       join public.profiles p on p.id = m.user_id where p.username = 'charlie'`)).rows[0].id
    await db.as(su)
    await db.rpc('admin_adjust_points', { p_entry_id: ch, p_points_adjust: 5000, p_note: 'bonus' })
    const r = await board(c, null)
    expect(r.total).toBe(3)
    expect(r.rows[0]).toMatchObject({ rank: 1, username: 'charlie', is_me: true })
    const night = await board(c, '2026-10-26')
    expect(night.rows.find((x) => x.username === 'charlie')?.rank).toBe(2) // ± points only count overall
  })

  it('sends top 3, my row and the row above me only', async () => {
    const r = await board(su, null)
    expect(r.rows.every((x) => x.rank <= 3)).toBe(true)
  })
})
