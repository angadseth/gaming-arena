import { beforeAll, describe, expect, it } from 'vitest'
import { expectHint, freshDb, type Db } from './harness'

let db: Db
let admin: string, ravi: string, meera: string, event: string

type Lobby = {
  registered: boolean
  meet_url?: string | null
  room_code?: string | null
  notices?: { title: string }[]
}
type Inbox = { unread: number; items: { title: string; event_slug: string; unread: boolean }[] }

beforeAll(async () => {
  db = await freshDb()
  admin = await db.newUser('24f2004141@ds.study.iitm.ac.in')
  ravi = await db.newUser('23f1000021@ds.study.iitm.ac.in')
  meera = await db.newUser('23f1000022@ds.study.iitm.ac.in')
  for (const [id, u] of [[admin, 'angad'], [ravi, 'ravi'], [meera, 'meera']]) {
    await db.as(id)
    await db.rpc('complete_profile', {
      p_username: u, p_full_name: `${u} Sharma`, p_house_id: 9, p_region_id: 2,
      p_whatsapp: '98765 43210', p_accept_rules: true,
    })
  }
  await db.as(admin)
  const g = await db.query<{ id: string }>(`select id from public.games where slug = 'stumble-guys'`)
  event = await db.rpc<string>('admin_upsert_tournament', { p: {
    game_id: g.rows[0].id, slug: 'stumble-cup', title: 'Stumble Cup', status: 'open' } })
  await db.as(ravi)
  await db.rpc('register_solo', { p_tournament_id: event, p_ig_id: 'RaviStumbles' })
}, 60_000)

describe('play links', () => {
  it('Stumble Guys ships with browser, Play Store, App Store and Steam links and join steps', async () => {
    await db.as(ravi)
    const r = await db.query<{ play_links: { kind: string; url: string }[]; join_steps: string[] }>(
      `select play_links, join_steps from public.games where slug = 'stumble-guys'`)
    expect(r.rows[0].play_links.map((l) => l.kind)).toEqual(['web', 'android', 'ios', 'pc'])
    expect(r.rows[0].play_links[0].url).toBe('https://www.stumbleguys.com/play')
    expect(r.rows[0].join_steps.length).toBeGreaterThan(3)
  })
  it('only admins edit them, and only https links pass', async () => {
    const g = (await db.query<{ id: string }>(`select id from public.games where slug = 'skribbl'`)).rows[0].id
    await db.as(ravi)
    await expectHint(db.rpc('admin_set_game_play', { p_game_id: g, p_play_links: [], p_join_steps: [] }), 'FORBIDDEN')
    await db.as(admin)
    await expectHint(db.rpc('admin_set_game_play', { p_game_id: g,
      p_play_links: [{ kind: 'web', label: 'Play', url: 'javascript:alert(1)' }], p_join_steps: [] }), 'BAD_INPUT')
    await db.rpc('admin_set_game_play', { p_game_id: g,
      p_play_links: [{ kind: 'web', label: 'Open skribbl', url: 'https://skribbl.io' }], p_join_steps: ['Open the link', ' '] })
    const r = await db.query<{ join_steps: string[] }>(`select join_steps from public.games where id = $1`, [g])
    expect(r.rows[0].join_steps).toEqual(['Open the link'])
  })
})

describe('event lobby', () => {
  it('stays hidden from players who are not registered, even at the table', async () => {
    await db.as(admin)
    await db.rpc('admin_set_lobby', { p_tournament_id: event, p: {
      meet_url: 'https://meet.google.com/abc-defg-hij', room_code: 'SG4821', note: 'Region: Asia' }, p_notify: false })
    await db.as(meera)
    expect(await db.rpc<Lobby>('event_lobby', { p_tournament_id: event })).toEqual({ registered: false })
    await expect(db.query('select * from public.event_lobby')).rejects.toThrow(/permission denied/)
    await expect(db.query('select * from public.event_notices')).rejects.toThrow(/permission denied/)
  })
  it('registered players must accept the lobby rules before seeing anything private', async () => {
    await db.as(ravi)
    expect(await db.rpc<Lobby>('event_lobby', { p_tournament_id: event })).toEqual({ registered: true, agreed: false, has_room: true })
    await db.as(meera)
    await expectHint(db.rpc('accept_lobby_rules', { p_tournament_id: event }), 'NOT_REGISTERED')
  })
  it('shows the Meet link and room code once accepted', async () => {
    await db.as(ravi)
    await db.rpc('accept_lobby_rules', { p_tournament_id: event })
    const l = await db.rpc<Lobby>('event_lobby', { p_tournament_id: event })
    expect(l.registered).toBe(true)
    expect(l.meet_url).toBe('https://meet.google.com/abc-defg-hij')
    // The room code itself waits for check-in (next block).
    expect(l.room_code).toBeNull()
  })
  it('players cannot set the lobby; bad links are refused', async () => {
    await db.as(ravi)
    await expectHint(db.rpc('admin_set_lobby', { p_tournament_id: event, p: {}, p_notify: false }), 'FORBIDDEN')
    await db.as(admin)
    await expectHint(db.rpc('admin_set_lobby', { p_tournament_id: event, p: { meet_url: 'meet.google.com/x' }, p_notify: false }), 'BAD_INPUT')
  })
})

describe('notices', () => {
  it('saving the room with notify posts a notice; inbox counts it as unread', async () => {
    await db.as(admin)
    await db.rpc('admin_set_lobby', { p_tournament_id: event, p: {
      meet_url: 'https://meet.google.com/abc-defg-hij', room_code: 'SG9999' }, p_notify: true })
    await db.rpc('admin_post_notice', { p_tournament_id: event, p_kind: 'reminder', p_title: 'Starts in 15 minutes', p_body: 'Join the Meet now.' })
    await db.as(ravi)
    const inbox = await db.rpc<Inbox>('my_notices', { p_limit: 50 })
    expect(inbox.unread).toBe(2)
    expect(inbox.items.map((i) => i.title)).toEqual(['Starts in 15 minutes', 'Room code is up'])
    expect(inbox.items[0].event_slug).toBe('stumble-cup')
  })
  it('marking seen clears the badge', async () => {
    await db.as(ravi)
    await db.rpc('mark_notices_seen')
    expect((await db.rpc<Inbox>('my_notices', { p_limit: 50 })).unread).toBe(0)
  })
  it('players outside the event get nothing', async () => {
    await db.as(meera)
    expect(await db.rpc<Inbox>('my_notices', { p_limit: 50 })).toEqual({ unread: 0, items: [] })
  })
  it('only staff post or delete notices, with sane lengths', async () => {
    await db.as(ravi)
    await expectHint(db.rpc('admin_post_notice', { p_tournament_id: event, p_kind: 'info', p_title: 'Hi all', p_body: '' }), 'FORBIDDEN')
    await db.as(admin)
    await expectHint(db.rpc('admin_post_notice', { p_tournament_id: event, p_kind: 'info', p_title: 'x', p_body: '' }), 'BAD_INPUT')
    const admin_view = await db.rpc<{ recipients: number; emails: string[] }>('admin_lobby', { p_tournament_id: event })
    expect(admin_view.recipients).toBe(1)
    expect(admin_view.emails).toEqual(['23f1000021@ds.study.iitm.ac.in'])
  })
})

describe('check-in and the fixed Meet link', () => {
  type L = Lobby & { checkin_open?: boolean; checked_in?: boolean; my_ig_id?: string; has_room?: boolean }
  it('uses the one fixed Meet link when the event has none', async () => {
    await db.as(admin)
    await db.rpc('admin_set_default_meet', { p_url: 'https://meet.google.com/fix-edli-nkk' })
    await db.rpc('admin_set_lobby', { p_tournament_id: event, p: { room_code: 'SG1111' }, p_notify: false })
    await db.as(ravi)
    expect((await db.rpc<L>('event_lobby', { p_tournament_id: event })).meet_url).toBe('https://meet.google.com/fix-edli-nkk')
  })
  it('hides the room code until the player checks in, and check-in waits for organisers', async () => {
    await db.as(ravi)
    const l = await db.rpc<L>('event_lobby', { p_tournament_id: event })
    expect(l.room_code).toBeNull()
    expect(l.has_room).toBe(true)
    await expectHint(db.rpc('check_in', { p_tournament_id: event, p_ig_id: 'RaviStumbles' }), 'CHECKIN_CLOSED')
  })
  it('check-in can fix the in-game name; changes are audited and must stay unique', async () => {
    await db.as(admin)
    await db.rpc('admin_set_checkin', { p_tournament_id: event, p_open: true, p_notify: true })
    await db.as(ravi)
    await db.rpc('check_in', { p_tournament_id: event, p_ig_id: 'Ravi_SG' })
    const l = await db.rpc<L>('event_lobby', { p_tournament_id: event })
    expect(l.checked_in).toBe(true)
    expect(l.my_ig_id).toBe('Ravi_SG')
    expect(l.room_code).toBe('SG1111')
    await db.as(admin)
    const a = await db.rpc<{ checked_in_count: number; roster: { username: string; ig_id: string; ig_changes: number }[] }>('admin_lobby', { p_tournament_id: event })
    expect(a.checked_in_count).toBe(1)
    expect(a.roster[0]).toMatchObject({ username: 'ravi', ig_id: 'Ravi_SG', ig_changes: 1 })
  })
  it('players outside the event cannot check in', async () => {
    await db.as(meera)
    await expectHint(db.rpc('check_in', { p_tournament_id: event, p_ig_id: 'Meera' }), 'NOT_REGISTERED')
  })
  it('points are x100: Stumble Guys pays 1000 for a win', async () => {
    await db.as(admin)
    await db.rpc('admin_record_match', {
      p_tournament_id: event, p_label: 'Heat 1 Game 1', p_played_at: null,
      p_rows: [{ ig_id: 'ravi_sg', placement: 1 }], p_replace: false })
    const s = await db.query<{ points: string }>('select points from public.tournament_standings($1)', [event])
    expect(Number(s.rows[0].points)).toBe(1000)
  })
})

describe('player card', () => {
  type Card = { xp: number; level: string; next_level_at: number; badges: { key: string; have: boolean }[] }
  it('turns games and check-ins into XP, a level and badges', async () => {
    await db.as(ravi)
    const c = await db.rpc<Card>('player_card', { p_username: 'ravi' })
    expect(c.xp).toBe(1100) // won one game (1000) + one check-in (100)
    expect(c.level).toBe('Bronze')
    expect(c.next_level_at).toBe(3000)
    const have = c.badges.filter((b) => b.have).map((b) => b.key)
    expect(have).toEqual(['debut', 'game_winner'])
  })
  it('signed-in player gets their own card; unknown names get null', async () => {
    await db.as(meera)
    expect((await db.rpc<Card>('player_card', {})).level).toBe('Rookie')
    expect(await db.rpc('player_card', { p_username: 'nobody_here' })).toBeNull()
  })
})

describe('loophole fixes', () => {
  it('a notice never carries the room code', async () => {
    await db.as(admin)
    await db.rpc('admin_set_lobby', { p_tournament_id: event, p: { room_code: 'SECRET42' }, p_notify: true })
    await db.as('postgres')
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.event_notices where title like '%SECRET42%' or body like '%SECRET42%'`)
    expect(r.rows[0].n).toBe(0)
  })
  it('a checked-in player cannot rename to steal a placement', async () => {
    await db.as(ravi)
    await expectHint(db.rpc('check_in', { p_tournament_id: event, p_ig_id: 'SomeoneElse' }), 'IG_LOCKED')
    await db.as(admin)
    await db.rpc('admin_set_ig_id', { p_tournament_id: event, p_username: 'ravi', p_ig_id: 'Ravi_Fixed' })
  })
  it('lookalike names with invisible characters count as the same name', async () => {
    await db.as('postgres')
    const e = (await db.query<{ entry_id: string }>(`select entry_id from public.entry_members where tournament_id = $1`, [event])).rows[0].entry_id
    await expect(db.query(`insert into public.entry_members (entry_id, tournament_id, user_id, role, ig_id) values ($1, $2, $3, 'player', $4)`,
      [e, event, meera, 'Ravi​_Fixed'])).rejects.toThrow(/unique/)
  })
  it('a disqualified player loses the lobby and the inbox', async () => {
    await db.as('postgres')
    await db.exec(`update public.entries set status = 'disqualified' where tournament_id = '${event}'`)
    await db.as(ravi)
    expect(await db.rpc<Lobby>('event_lobby', { p_tournament_id: event })).toEqual({ registered: false })
    expect((await db.rpc<Inbox>('my_notices', { p_limit: 50 })).items).toEqual([])
    await db.as('postgres')
    await db.exec(`update public.entries set status = 'active' where tournament_id = '${event}'`)
  })
  it('penalties at the new scale are accepted', async () => {
    await db.as(admin)
    await db.rpc('admin_record_match', { p_tournament_id: event, p_label: 'Penalty test', p_played_at: null,
      p_rows: [{ ig_id: 'ravi_fixed', placement: null, points: -2000 }], p_replace: false })
  })
})
