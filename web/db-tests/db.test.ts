import { beforeAll, describe, expect, it } from 'vitest'
import { expectHint, freshDb, type Db } from './harness'

let db: Db
let admin: string, alice: string, bob: string, carol: string, dave: string
let soloGame: string, squadGame: string, soloEvent: string, squadEvent: string

async function onboard(id: string, username: string, house = 9) {
  await db.as(id)
  await db.rpc('complete_profile', {
    p_username: username, p_full_name: `${username} Kumar`, p_house_id: house, p_region_id: 2,
    p_whatsapp: '98765 43210', p_accept_rules: true,
  })
}

beforeAll(async () => {
  db = await freshDb()
  admin = await db.newUser('24f2004141@ds.study.iitm.ac.in')
  alice = await db.newUser('23f1000001@ds.study.iitm.ac.in')
  bob = await db.newUser('23f1000002@ds.study.iitm.ac.in')
  carol = await db.newUser('23f1000003@es.study.iitm.ac.in')
  dave = await db.newUser('23f1000004@ds.study.iitm.ac.in')
  await onboard(admin, 'angad')
  await onboard(alice, 'alice')
  await onboard(bob, 'bob')
  await onboard(carol, 'carol', 2) // Corbett, different house
  await onboard(dave, 'dave')
}, 60_000)

describe('sign-in domain guard', () => {
  it('rejects non-IITM emails at the auth table', async () => {
    await expect(db.newUser('someone@gmail.com')).rejects.toThrow(/IIT Madras/)
    await expect(db.newUser('x@study.iitm.ac.in.evil.com')).rejects.toThrow(/IIT Madras/)
    await expect(db.newUser('x@fakeds.study.iitm.ac.in')).rejects.toThrow(/IIT Madras/)
    await expect(db.newUser('23f1000001+2@ds.study.iitm.ac.in')).rejects.toThrow(/IIT Madras/)
    await expect(db.newUser('a@b@ds.study.iitm.ac.in')).rejects.toThrow(/IIT Madras/)
    await expect(db.query(`update auth.users set email = 'zz@ds.study.iitm.ac.in' where id = $1`, [alice])).rejects.toThrow(/cannot be changed/)
  })
  it('auth hook answers 403 for outsiders and {} for students', async () => {
    await db.as('postgres')
    const bad = await db.rpc<{ error?: { http_code: number } }>('hook_before_user_created', {
      event: { user: { email: 'a@gmail.com' } },
    })
    expect(bad.error?.http_code).toBe(403)
    const ok = await db.rpc('hook_before_user_created', { event: { user: { email: '22f3000001@ds.study.iitm.ac.in' } } })
    expect(ok).toEqual({})
  })
  it('clients cannot call the hook', async () => {
    await db.as(alice)
    await expect(db.rpc('hook_before_user_created', { event: {} })).rejects.toThrow(/permission denied/)
  })
})

describe('onboarding', () => {
  it('bootstraps the superadmin from the email list only', async () => {
    await db.as(admin)
    const me = await db.rpc<{ roles: string[]; whatsapp: string }>('get_my_profile')
    expect(me.roles).toEqual(['superadmin'])
    expect(me.whatsapp).toBe('+919876543210')
    await db.as(alice)
    expect((await db.rpc<{ roles: string[] }>('get_my_profile')).roles).toEqual([])
  })
  it('refuses a second profile, taken and reserved usernames', async () => {
    await db.as(alice)
    await expectHint(db.rpc('complete_profile', { p_username: 'alice2', p_full_name: 'Alice K', p_house_id: 1, p_region_id: 1, p_whatsapp: '9876543210', p_accept_rules: true }), 'PROFILE_EXISTS')
    const eve = await db.newUser('23f1000009@ds.study.iitm.ac.in')
    await db.as(eve)
    const base = { p_full_name: 'Eve K', p_house_id: 1, p_region_id: 1, p_whatsapp: '9876543210', p_accept_rules: true }
    await expectHint(db.rpc('complete_profile', { ...base, p_username: 'ALICE' }), 'USERNAME_TAKEN')
    await expectHint(db.rpc('complete_profile', { ...base, p_username: 'admin' }), 'USERNAME_TAKEN')
    await expectHint(db.rpc('complete_profile', { ...base, p_username: '1abc' }), 'BAD_USERNAME')
    await expectHint(db.rpc('complete_profile', { ...base, p_username: 'eve', p_whatsapp: '12345' }), 'BAD_WHATSAPP')
    await expectHint(db.rpc('complete_profile', { ...base, p_username: 'eve', p_accept_rules: false }), 'RULES_REQUIRED')
    await expectHint(db.rpc('complete_profile', { ...base, p_username: 'eve', p_full_name: '<script>' }), 'BAD_NAME')
    expect(await db.rpc('username_available', { p_username: 'eve' })).toBe(true)
    expect(await db.rpc('username_available', { p_username: 'Bob' })).toBe(false)
  })
})

describe('row level security', () => {
  it('anon sees no profiles and cannot call player RPCs', async () => {
    await db.as(null)
    await expect(db.query('select * from public.profiles')).rejects.toThrow(/permission denied/)
    await expect(db.rpc('my_entries')).rejects.toThrow(/permission denied/)
  })
  it('a player sees only their own profile row', async () => {
    await db.as(alice)
    const r = await db.query<{ username: string }>('select username from public.profiles')
    expect(r.rows.map((x) => x.username)).toEqual(['alice'])
  })
  it('players cannot write any table directly', async () => {
    await db.as(alice)
    await expect(db.query(`update public.profiles set username = 'x' where id = $1`, [alice])).rejects.toThrow(/permission denied/)
    await expect(db.query(`insert into public.user_roles (user_id, role) values ($1, 'superadmin')`, [alice])).rejects.toThrow(/permission denied/)
    await expect(db.query(`insert into public.games (slug, title, mode) values ('x', 'X', 'solo')`)).rejects.toThrow(/permission denied/)
    await expect(db.query('select * from public.entry_members')).rejects.toThrow(/permission denied/)
    await expect(db.query('select * from public.audit_log')).rejects.toThrow(/permission denied/)
  })
  it('players cannot call admin RPCs', async () => {
    await db.as(alice)
    await expectHint(db.rpc('admin_upsert_game', { p: { slug: 'x', title: 'X', mode: 'solo' } }), 'FORBIDDEN')
    await expectHint(db.rpc('admin_search_users', { p_query: 'bob' }), 'FORBIDDEN')
    await expectHint(db.rpc('superadmin_set_role', { p_user_id: alice, p_role: 'admin', p_grant: true }), 'FORBIDDEN')
  })
  it('username (outside update_my_profile) and email are frozen even for the table owner', async () => {
    await db.as('postgres')
    await expect(db.query(`update public.profiles set username = 'alicia' where id = $1`, [alice])).rejects.toThrow(/cannot be changed/)
  })
})

describe('events and registration', () => {
  beforeAll(async () => {
    await db.as(admin)
    soloGame = await db.rpc('admin_upsert_game', { p: {
      slug: 't-chess', title: 'Chess', mode: 'solo', team_size: 1, ig_id_label: 'Lichess username',
      ig_id_pattern: '^[A-Za-z0-9_-]{2,30}$', platforms: ['Web'] } })
    squadGame = await db.rpc('admin_upsert_game', { p: {
      slug: 't-bgmi', title: 'BGMI', mode: 'squad', team_size: 4, max_subs: 1, ig_id_label: 'Character ID',
      ig_id_pattern: '^[0-9]{8,12}$',
      extra_fields: [{ key: 'ign', label: 'In-game name', pattern: '^.{2,20}$' }] } })
    soloEvent = await db.rpc('admin_upsert_tournament', { p: {
      game_id: soloGame, slug: 'chess-blitz-1', title: 'Blitz Cup', status: 'open',
      placement_points: { '1': 10, '2': 6 } } })
    squadEvent = await db.rpc('admin_upsert_tournament', { p: {
      game_id: squadGame, slug: 't-bgmi-s1', title: 'BGMI Season 1', status: 'open', same_house_teams: true,
      placement_points: { '1': 10, '2': 6, '3': 5 }, kill_points: 1 } })
  })

  it('rejects an uncompilable regex from admins', async () => {
    await db.as(admin)
    await expectHint(db.rpc('admin_upsert_game', { p: { slug: 'bad', title: 'Bad', mode: 'solo', ig_id_pattern: '([' } }), 'BAD_PATTERN')
  })

  it('solo: validates ID, blocks duplicates of person and ID', async () => {
    await db.as(alice)
    await expectHint(db.rpc('register_solo', { p_tournament_id: soloEvent, p_ig_id: 'bad id!' }), 'BAD_IG_ID')
    await db.rpc('register_solo', { p_tournament_id: soloEvent, p_ig_id: 'AliceChess' })
    await expectHint(db.rpc('register_solo', { p_tournament_id: soloEvent, p_ig_id: 'Other' }), 'ALREADY_REGISTERED')
    await db.as(bob)
    await expectHint(db.rpc('register_solo', { p_tournament_id: soloEvent, p_ig_id: 'alicechess ' }), 'IG_ID_TAKEN')
    await expectHint(db.rpc('register_solo', { p_tournament_id: squadEvent, p_ig_id: '123456789' }), 'TEAM_EVENT')
    await db.rpc('register_solo', { p_tournament_id: soloEvent, p_ig_id: 'BobChess' })
  })

  it('squad: create, join by code, same-house rule, extra fields, capacity', async () => {
    await db.as(alice)
    await expectHint(db.rpc('create_team', { p_tournament_id: squadEvent, p_team_name: 'Night Owls', p_ig_id: '511111111', p_extra: {} }), 'BAD_EXTRA')
    await expectHint(db.rpc('create_team', { p_tournament_id: squadEvent, p_team_name: 'Night Owls', p_ig_id: '511111111', p_extra: { ign: 'Al', evil: 'x' } }), 'BAD_EXTRA')
    const t = await db.rpc<{ entry_id: string; invite_code: string }>('create_team', {
      p_tournament_id: squadEvent, p_team_name: 'Night Owls', p_ig_id: '511111111', p_extra: { ign: 'AliceOP' } })
    expect(t.invite_code).toMatch(/^[A-Z2-9]{8}$/)

    await db.as(carol)
    await expectHint(db.rpc('join_team', { p_code: t.invite_code, p_ig_id: '522222222', p_extra: { ign: 'Caro' } }), 'WRONG_HOUSE')
    await expectHint(db.rpc('join_team', { p_code: 'ZZZZZZZZ', p_ig_id: '522222222', p_extra: { ign: 'Caro' } }), 'BAD_INVITE')

    await db.as(bob)
    const preview = await db.rpc<Record<string, unknown>>('team_by_invite', { p_code: t.invite_code })
    expect(JSON.stringify(preview)).not.toMatch(/whatsapp|@ds\.study/)
    await db.rpc('join_team', { p_code: t.invite_code.toLowerCase(), p_ig_id: '533333333', p_extra: { ign: 'Bobby' } })
    await db.as(dave)
    await expectHint(db.rpc('join_team', { p_code: t.invite_code, p_ig_id: '533333333', p_extra: { ign: 'D' + 'ave' } }), 'IG_ID_TAKEN')
    await db.rpc('join_team', { p_code: t.invite_code, p_ig_id: '544444444', p_extra: { ign: 'Dave' } })

    await db.as(bob)
    await expectHint(db.rpc('kick_member', { p_entry_id: t.entry_id, p_username: 'dave' }), 'NOT_CAPTAIN')
    await db.as(alice)
    await db.rpc('kick_member', { p_entry_id: t.entry_id, p_username: 'dave' })
    await db.as(dave)
    await db.rpc('join_team', { p_code: t.invite_code, p_ig_id: '544444444', p_extra: { ign: 'Dave' } })
    const mine = await db.rpc<Array<{ members: unknown[]; invite_code: string | null }>>('my_entries')
    expect(mine[0].members).toHaveLength(3)
    expect(mine[0].invite_code).toBeNull() // only the captain sees the code
  })

  it('closed or draft events refuse registrations; drafts are hidden from the public', async () => {
    await db.as(admin)
    const draft = await db.rpc<string>('admin_upsert_tournament', { p: { game_id: soloGame, slug: 'chess-draft', title: 'Secret', status: 'draft' } })
    const closed = await db.rpc<string>('admin_upsert_tournament', { p: {
      game_id: soloGame, slug: 'chess-past', title: 'Past', status: 'open',
      reg_opens_at: '2020-01-01T00:00:00Z', reg_closes_at: '2020-01-02T00:00:00Z' } })
    await db.as(dave)
    await expectHint(db.rpc('register_solo', { p_tournament_id: draft, p_ig_id: 'DaveC' }), 'NOT_FOUND')
    await expectHint(db.rpc('register_solo', { p_tournament_id: closed, p_ig_id: 'DaveC' }), 'REG_CLOSED')
    await db.as(null)
    const r = await db.query<{ slug: string }>('select slug from public.tournaments')
    expect(r.rows.map((x) => x.slug)).not.toContain('chess-draft')
  })

  it('suspended players are blocked', async () => {
    await db.as(admin)
    await db.rpc('admin_set_user_status', { p_user_id: carol, p_status: 'suspended', p_note: 'test' })
    await db.as(carol)
    await expectHint(db.rpc('register_solo', { p_tournament_id: soloEvent, p_ig_id: 'CarolC' }), 'ACCOUNT_BLOCKED')
    await db.as(admin)
    await db.rpc('admin_set_user_status', { p_user_id: carol, p_status: 'active', p_note: null })
  })
})

describe('results and standings', () => {
  it('rejects the whole match when any row does not match, writes nothing', async () => {
    await db.as(admin)
    const res = await db.rpc<{ ok: boolean; errors: Array<{ row: number }> }>('admin_record_match', {
      p_tournament_id: squadEvent, p_label: 'Match 1', p_played_at: null,
      p_rows: [{ team: 'Night Owls', placement: 1, kills: 12 }, { team: 'Ghost Team', placement: 2 }] })
    expect(res.ok).toBe(false)
    expect(res.errors[0].row).toBe(2)
    const s = await db.query('select * from public.tournament_match_results($1)', [squadEvent])
    expect(s.rows).toHaveLength(0)
  })

  it('computes points from placement and kills, ranks, and shows my row', async () => {
    await db.as(admin)
    const ok = await db.rpc<{ ok: boolean }>('admin_record_match', {
      p_tournament_id: soloEvent, p_label: 'Final', p_played_at: null,
      p_rows: [{ username: 'bob', placement: 1 }, { username: 'alice', placement: 2 }] })
    expect(ok.ok).toBe(true)
    const dup = await db.rpc<{ ok: boolean }>('admin_record_match', {
      p_tournament_id: soloEvent, p_label: 'final', p_played_at: null, p_rows: [{ username: 'bob', placement: 1 }] })
    expect(dup.ok).toBe(false)

    await db.as(alice)
    const rows = await db.query<{ rank: number; name: string; points: string; is_mine: boolean; members: unknown }>(
      'select * from public.tournament_standings($1)', [soloEvent])
    expect(rows.rows.map((r) => [Number(r.rank), r.name, Number(r.points), r.is_mine])).toEqual([
      [1, 'bob', 10, false], [2, 'alice', 6, true]])
    expect(JSON.stringify(rows.rows)).not.toMatch(/whatsapp|@ds\.study|BobChess/)
  })

  it('awards house points only for completed events', async () => {
    await db.as(admin)
    let h = await db.query<{ house_id: number; points: string }>('select * from public.house_standings(null)')
    expect(h.rows.every((r) => Number(r.points) === 0)).toBe(true)
    await db.rpc('admin_upsert_tournament', { p: { id: soloEvent, game_id: soloGame, slug: 'chess-blitz-1', title: 'Blitz Cup', status: 'completed' } })
    h = await db.query<{ house_id: number; points: string }>('select * from public.house_standings(null)')
    const pich = h.rows.find((r) => r.house_id === 9)
    expect(Number(pich?.points)).toBe(17) // 1st (10) + 2nd (7), both Pichavaram
  })

  it('admins see WhatsApp in registrations; the audit log records actions', async () => {
    await db.as(admin)
    const regs = await db.rpc<Array<{ members: Array<{ whatsapp: string }> }>>('admin_registrations', { p_tournament_id: squadEvent })
    expect(regs[0].members[0].whatsapp).toBe('+919876543210')
    const log = await db.rpc<Array<{ action: string }>>('admin_audit', { p_limit: 500 })
    expect(log.map((l) => l.action)).toEqual(expect.arrayContaining(['entry.team.create', 'match.record', 'user.status']))
  })
})
