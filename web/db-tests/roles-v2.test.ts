import { beforeAll, describe, expect, it } from 'vitest'
import { expectHint, freshDb, type Db } from './harness'

// 0015: admins open/close events and fix points; everything else stays with the superadmin.
let db: Db
let su: string, sagar: string, org: string, bob: string
let eventId: string, entryId: string

async function onboard(id: string, username: string) {
  await db.as(id)
  await db.rpc('complete_profile', {
    p_username: username, p_full_name: `${username} Kumar`, p_house_id: 9, p_region_id: 2,
    p_whatsapp: '98765 43210', p_accept_rules: true,
  })
}

beforeAll(async () => {
  db = await freshDb()
  su = await db.newUser('24f2004141@ds.study.iitm.ac.in')
  sagar = await db.newUser('25f2003321@ds.study.iitm.ac.in')
  org = await db.newUser('23f1000003@ds.study.iitm.ac.in')
  bob = await db.newUser('23f1000002@ds.study.iitm.ac.in')
  await onboard(su, 'angad')
  await onboard(sagar, 'sagar')
  await onboard(org, 'orgy')
  await onboard(bob, 'bob')
  await db.as(su)
  await db.rpc('superadmin_set_email_role', { p_email: '23f1000003@ds.study.iitm.ac.in', p_role: 'organizer' })
  await db.as('postgres')
  const t = await db.query<{ id: string }>(`select id from public.tournaments where slug = 'stumble-guys-s1'`)
  eventId = t.rows[0].id
  await db.query(`update public.tournaments set status = 'open', reg_opens_at = null, reg_closes_at = null where id = $1`, [eventId])
  await db.as(bob)
  await db.rpc('register_solo', { p_tournament_id: eventId, p_ig_id: 'BobTheBuilder', p_extra: {} })
  await db.as('postgres')
  entryId = (await db.query<{ id: string }>(`select id from public.entries where tournament_id = $1`, [eventId])).rows[0].id
}, 60_000)

describe('roles v2', () => {
  it('Sagar is an admin from the pre-set email, the @mg domain is allowed', async () => {
    await db.as(sagar)
    expect((await db.rpc<{ roles: string[] }>('get_my_profile')).roles).toEqual(['admin'])
    const abhi = await db.newUser('24f3002949@mg.study.iitm.ac.in')
    await onboard(abhi, 'abhimanyu')
    await db.as(abhi)
    expect((await db.rpc<{ roles: string[] }>('get_my_profile')).roles).toEqual(['admin'])
  })
  it('badges: Super Admin and Admin are public, organisers and players get none', async () => {
    await db.as(bob)
    const b = await db.rpc<Record<string, string>>('staff_badges')
    expect(b).toMatchObject({ angad: 'superadmin', sagar: 'admin', abhimanyu: 'admin' })
    expect(b.orgy).toBeUndefined()
    expect(b.bob).toBeUndefined()
  })
  it('an admin opens and closes events, fixes points and records results', async () => {
    await db.as(sagar)
    await db.rpc('admin_set_event_status', { p_tournament_id: eventId, p_status: 'closed' })
    await db.rpc('admin_set_event_status', { p_tournament_id: eventId, p_status: 'open' })
    await expectHint(db.rpc('admin_set_event_status', { p_tournament_id: eventId, p_status: 'completed' }), 'BAD_INPUT')
    await db.rpc('admin_adjust_points', { p_entry_id: entryId, p_points_adjust: -50, p_note: 'typo in game 1' })
    const regs = await db.rpc<Array<{ points_adjust: number }>>('admin_registrations', { p_tournament_id: eventId })
    expect(Number(regs[0].points_adjust)).toBe(-50)
    const r = await db.rpc<{ ok: boolean }>('admin_record_match', {
      p_tournament_id: eventId, p_label: 'Game 1', p_played_at: null, p_rows: [{ entry_id: entryId, placement: 1, kills: 0 }], p_replace: false,
    })
    expect(r.ok).toBe(true)
  })
  it('an admin cannot touch roles, bans, players, games, requests, logs or event settings', async () => {
    await db.as(sagar)
    const forbidden: [string, Record<string, unknown>][] = [
      ['superadmin_set_email_role', { p_email: '23f1000002@ds.study.iitm.ac.in', p_role: 'organizer' }],
      ['superadmin_set_role', { p_user_id: bob, p_role: 'organizer', p_grant: true }],
      ['admin_set_email_ban', { p_email: '23f1000002@ds.study.iitm.ac.in', p_banned: true, p_note: null }],
      ['admin_set_user_status', { p_user_id: bob, p_status: 'banned', p_note: null }],
      ['admin_correct_profile', { p_user_id: bob, p_full_name: 'X', p_house_id: 1, p_region_id: 1 }],
      ['admin_set_ig_id', { p_tournament_id: eventId, p_username: 'bob', p_ig_id: 'Other' }],
      ['admin_set_entry', { p_entry_id: entryId, p_status: 'disqualified', p_points_adjust: 0, p_note: null }],
      ['admin_remove_entry', { p_entry_id: entryId, p_reason: 'x' }],
      ['admin_search_users', { p_query: 'bob' }],
      ['admin_email_access', {}],
      ['admin_game_requests', {}],
      ['admin_audit', {}],
      ['admin_upsert_tournament', { p: { id: eventId, title: 'Hacked', slug: 'stumble-guys-s1', game_id: null } }],
    ]
    for (const [fn, args] of forbidden) {
      await expectHint(db.rpc(fn, args), 'FORBIDDEN').catch((e) => {
        throw new Error(`${fn}: ${e.message}`)
      })
    }
  })
  it('an organiser cannot open or close events or fix points', async () => {
    await db.as(org)
    await expectHint(db.rpc('admin_set_event_status', { p_tournament_id: eventId, p_status: 'closed' }), 'FORBIDDEN')
    await expectHint(db.rpc('admin_adjust_points', { p_entry_id: entryId, p_points_adjust: 10, p_note: null }), 'FORBIDDEN')
  })
  it('loophole fixes: organisers only add results, admins cannot set links, reopen started events or touch finished ones', async () => {
    // Organiser adds a game but cannot replace or delete it.
    await db.as(org)
    const g2 = await db.rpc<{ ok: boolean; match_id: string }>('admin_record_match', {
      p_tournament_id: eventId, p_label: 'Game 2', p_played_at: null, p_rows: [{ entry_id: entryId, placement: 1, kills: 0 }], p_replace: false,
    })
    expect(g2.ok).toBe(true)
    await expectHint(db.rpc('admin_record_match', {
      p_tournament_id: eventId, p_label: 'Game 2', p_played_at: null, p_rows: [{ entry_id: entryId, placement: 2, kills: 0 }], p_replace: true,
    }), 'FORBIDDEN')
    await expectHint(db.rpc('admin_delete_match', { p_match_id: g2.match_id }), 'FORBIDDEN')
    // Admin can delete it; but the event has results now, so admin cannot reopen it after closing.
    await db.as(sagar)
    await db.rpc('admin_delete_match', { p_match_id: g2.match_id })
    await db.rpc('admin_set_event_status', { p_tournament_id: eventId, p_status: 'closed' })
    await expectHint(db.rpc('admin_set_event_status', { p_tournament_id: eventId, p_status: 'open' }), 'STARTED')
    // Event Meet link: an admin's value is ignored, the superadmin's sticks.
    await db.rpc('admin_set_lobby', { p_tournament_id: eventId, p: { meet_url: 'https://evil.example/x', room_code: 'ABC' }, p_notify: false })
    await db.as('postgres')
    expect((await db.query<{ meet_url: string | null }>('select meet_url from public.event_lobby where tournament_id = $1', [eventId])).rows[0].meet_url).toBeNull()
    // Completed event: results and points frozen for admins.
    await db.query(`update public.tournaments set status = 'completed' where id = $1`, [eventId])
    await db.as(sagar)
    await expectHint(db.rpc('admin_record_match', {
      p_tournament_id: eventId, p_label: 'Game 9', p_played_at: null, p_rows: [{ entry_id: entryId, placement: 1, kills: 0 }], p_replace: false,
    }), 'FORBIDDEN')
    await expectHint(db.rpc('admin_adjust_points', { p_entry_id: entryId, p_points_adjust: 999, p_note: null }), 'FORBIDDEN')
    // Game requests table: an admin sees only their own rows.
    await db.as(bob)
    await db.rpc('request_game', { p_game_name: 'Rocket League', p_platform: 'pc', p_note: null })
    await db.as(sagar)
    expect((await db.query('select * from public.game_requests')).rows.length).toBe(0)
    // Only one superadmin can ever exist.
    await db.as('postgres')
    await expect(db.query(`insert into public.user_roles (user_id, role) values ($1, 'superadmin')`, [sagar])).rejects.toThrow(/one_superadmin|duplicate/)
  })
  it('the twelve games come first, in Angad\'s order, and no game was removed', async () => {
    await db.as(bob)
    const g = await db.query<{ slug: string }>(`select slug from public.games order by sort_order, slug`)
    expect(g.rows.slice(0, 12).map((r) => r.slug)).toEqual([
      'smash-karts', 'stumble-guys', 'bgmi', 'ff-max', 'codm', 'skribbl', 'clash-of-clans', 'clash-royale', 'cs2', 'valorant', 'among-us', 'extra',
    ])
    expect(g.rows.length).toBe(19)
  })
})
