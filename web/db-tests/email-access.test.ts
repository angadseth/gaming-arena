import { beforeAll, describe, expect, it } from 'vitest'
import { expectHint, freshDb, type Db } from './harness'

let db: Db
let su: string, alice: string, bob: string

async function onboard(id: string, username: string) {
  await db.as(id)
  await db.rpc('complete_profile', {
    p_username: username, p_full_name: `${username} Kumar`, p_house_id: 9, p_region_id: 2,
    p_whatsapp: '98765 43210', p_accept_rules: true,
  })
}
const roles = async (id: string) => {
  await db.as(id)
  return (await db.rpc<{ roles: string[] }>('get_my_profile')).roles
}

beforeAll(async () => {
  db = await freshDb()
  su = await db.newUser('24f2004141@ds.study.iitm.ac.in')
  alice = await db.newUser('23f1000001@ds.study.iitm.ac.in')
  bob = await db.newUser('23f1000002@ds.study.iitm.ac.in')
  await onboard(su, 'angad')
  await onboard(alice, 'alice')
  await onboard(bob, 'bob')
}, 60_000)

describe('roles by email (superadmin only)', () => {
  it('grants a role to someone who has already signed up', async () => {
    await db.as(su)
    const r = await db.rpc<{ registered: boolean }>('superadmin_set_email_role', { p_email: ' 23F1000001@ds.study.iitm.ac.in ', p_role: 'organizer' })
    expect(r.registered).toBe(true)
    expect(await roles(alice)).toEqual(['organizer'])
  })
  it('changes and removes the role', async () => {
    await db.as(su)
    await db.rpc('superadmin_set_email_role', { p_email: '23f1000001@ds.study.iitm.ac.in', p_role: 'admin' })
    expect(await roles(alice)).toEqual(['admin'])
    await db.as(su)
    await db.rpc('superadmin_set_email_role', { p_email: '23f1000001@ds.study.iitm.ac.in', p_role: null })
    expect(await roles(alice)).toEqual([])
  })
  it('pre-assigns a role that applies when the person signs up', async () => {
    await db.as(su)
    const r = await db.rpc<{ registered: boolean }>('superadmin_set_email_role', { p_email: '22f3000777@es.study.iitm.ac.in', p_role: 'organizer' })
    expect(r.registered).toBe(false)
    const neo = await db.newUser('22f3000777@es.study.iitm.ac.in')
    await onboard(neo, 'neo')
    expect(await roles(neo)).toEqual(['organizer'])
  })
  it('nobody but the superadmin can hand out roles, not even an admin', async () => {
    await db.as(su)
    await db.rpc('superadmin_set_email_role', { p_email: '23f1000001@ds.study.iitm.ac.in', p_role: 'admin' })
    await db.as(alice)
    await expectHint(db.rpc('superadmin_set_email_role', { p_email: '23f1000002@ds.study.iitm.ac.in', p_role: 'organizer' }), 'FORBIDDEN')
    await expectHint(db.rpc('superadmin_set_role', { p_user_id: bob, p_role: 'organizer', p_grant: true }), 'FORBIDDEN')
    await db.as(bob)
    await expectHint(db.rpc('superadmin_set_email_role', { p_email: '23f1000002@ds.study.iitm.ac.in', p_role: 'admin' }), 'FORBIDDEN')
    await expect(db.query('select * from public.email_access')).rejects.toThrow(/permission denied/)
    await expect(db.query(`insert into public.email_access (email, role) values ('23f1000002@ds.study.iitm.ac.in', 'admin')`)).rejects.toThrow(/permission denied/)
  })
  it('rejects outside emails and bad roles; cannot demote yourself', async () => {
    await db.as(su)
    await expectHint(db.rpc('superadmin_set_email_role', { p_email: 'x@gmail.com', p_role: 'admin' }), 'BAD_DOMAIN')
    await expectHint(db.rpc('superadmin_set_email_role', { p_email: '23f1000002@ds.study.iitm.ac.in', p_role: 'superadmin' }), 'BAD_INPUT')
    await expectHint(db.rpc('superadmin_set_email_role', { p_email: '24f2004141@ds.study.iitm.ac.in', p_role: null }), 'SELF')
    expect(await roles(su)).toEqual(['superadmin'])
  })
})

describe('bans by email', () => {
  it('a banned email can never create an account', async () => {
    await db.as(alice) // admin
    const r = await db.rpc<{ registered: boolean }>('admin_set_email_ban', { p_email: '21f1000666@ds.study.iitm.ac.in', p_banned: true, p_note: 'cheating' })
    expect(r.registered).toBe(false)
    await db.as('postgres')
    const hook = await db.rpc<{ error?: { http_code: number } }>('hook_before_user_created', { event: { user: { email: '21F1000666@ds.study.iitm.ac.in' } } })
    expect(hook.error?.http_code).toBe(403)
    await expect(db.newUser('21f1000666@ds.study.iitm.ac.in')).rejects.toThrow(/IIT Madras/)
  })
  it('banning a registered player locks them out of every action', async () => {
    await db.as(alice)
    await db.rpc('admin_set_email_ban', { p_email: '23f1000002@ds.study.iitm.ac.in', p_banned: true, p_note: 'smurfing' })
    await db.as(bob)
    const me = await db.rpc<{ status: string }>('get_my_profile')
    expect(me.status).toBe('banned')
    await expectHint(db.rpc('request_game', { p_game_name: 'Ludo', p_platform: 'mobile', p_note: null }), 'ACCOUNT_BLOCKED')
    await db.as(alice)
    await db.rpc('admin_set_email_ban', { p_email: '23f1000002@ds.study.iitm.ac.in', p_banned: false, p_note: null })
    await db.as(bob)
    expect((await db.rpc<{ status: string }>('get_my_profile')).status).toBe('active')
  })
  it('an admin cannot ban the superadmin, another admin, or themselves', async () => {
    await db.as(su)
    await db.rpc('superadmin_set_email_role', { p_email: '23f1000002@ds.study.iitm.ac.in', p_role: 'admin' })
    await db.as(alice)
    await expectHint(db.rpc('admin_set_email_ban', { p_email: '24f2004141@ds.study.iitm.ac.in', p_banned: true, p_note: null }), 'FORBIDDEN')
    await expectHint(db.rpc('admin_set_email_ban', { p_email: '23f1000002@ds.study.iitm.ac.in', p_banned: true, p_note: null }), 'FORBIDDEN')
    await expectHint(db.rpc('admin_set_user_status', { p_user_id: bob, p_status: 'banned', p_note: null }), 'FORBIDDEN')
    await expectHint(db.rpc('admin_set_user_status', { p_user_id: su, p_status: 'banned', p_note: null }), 'FORBIDDEN')
    await expectHint(db.rpc('admin_set_email_ban', { p_email: '23f1000001@ds.study.iitm.ac.in', p_banned: true, p_note: null }), 'SELF')
  })
  it('the superadmin can ban an admin, which also strips their powers', async () => {
    await db.as(su)
    await db.rpc('admin_set_email_ban', { p_email: '23f1000002@ds.study.iitm.ac.in', p_banned: true, p_note: null })
    await db.as(bob)
    await expectHint(db.rpc('admin_email_access'), 'FORBIDDEN')
  })
  it('banning by user id also bans the email', async () => {
    await db.as(su)
    await db.rpc('superadmin_set_email_role', { p_email: '23f1000001@ds.study.iitm.ac.in', p_role: null })
    await db.rpc('admin_set_user_status', { p_user_id: alice, p_status: 'banned', p_note: 'abuse' })
    const list = await db.rpc<Array<{ email: string; banned: boolean; registered: boolean; username: string }>>('admin_email_access')
    expect(list.find((x) => x.email === '23f1000001@ds.study.iitm.ac.in')).toMatchObject({ banned: true, registered: true, username: 'alice' })
    expect(list.find((x) => x.email === '21f1000666@ds.study.iitm.ac.in')).toMatchObject({ banned: true, registered: false })
    await db.as('postgres')
    const hook = await db.rpc<{ error?: unknown }>('hook_before_user_created', { event: { user: { email: '23f1000001@ds.study.iitm.ac.in' } } })
    expect(hook.error).toBeTruthy()
    const log = await db.query<{ action: string }>('select action from public.audit_log')
    expect(log.rows.map((r) => r.action)).toEqual(expect.arrayContaining(['role.grant_email', 'role.revoke_email', 'user.ban_email', 'user.unban_email']))
  })
  it('anon and players cannot list email access', async () => {
    await db.as(null)
    await expect(db.rpc('admin_email_access')).rejects.toThrow(/permission denied/)
    await db.as(alice)
    await expectHint(db.rpc('admin_email_access'), 'FORBIDDEN')
  })
})

describe('security review fixes', () => {
  it('code-only users (which GoTrue gives a random password) can sign up; email change is blocked', async () => {
    await db.as('postgres')
    await db.query(`insert into auth.users (email, encrypted_password) values ('22f1000555@ds.study.iitm.ac.in', '$2a$10$random')`)
    await expect(db.query(`update auth.users set email_change = 'a@gmail.com' where id = $1`, [su])).rejects.toThrow(/cannot be changed/)
  })
  it('the token hook refuses password and anonymous sessions', async () => {
    await db.as('postgres')
    const pw = await db.rpc<{ error?: { http_code: number } }>('hook_custom_access_token', { event: { authentication_method: 'password', claims: {} } })
    expect(pw.error?.http_code).toBe(403)
    const amr = await db.rpc<{ error?: unknown }>('hook_custom_access_token', { event: { authentication_method: 'token_refresh', claims: { amr: [{ method: 'password' }] } } })
    expect(amr.error).toBeTruthy()
    const otp = await db.rpc<{ claims?: unknown }>('hook_custom_access_token', { event: { authentication_method: 'otp', claims: { amr: [{ method: 'otp' }] } } })
    expect(otp.claims).toBeTruthy()
  })
  it('password or anonymous sessions get no powers, and unconfirmed emails cannot onboard', async () => {
    await db.as(su)
    await db.query(`select set_config('request.jwt.claims', '{"amr":[{"method":"password"}]}', false)`)
    expect((await db.query<{ ok: boolean }>('select public.has_role(array[\'superadmin\']) as ok')).rows[0].ok).toBe(false)
    await expectHint(db.rpc('admin_email_access'), 'FORBIDDEN')
    await db.query(`select set_config('request.jwt.claims', '', false)`)
    const ghost = await db.newUser('22f1000556@ds.study.iitm.ac.in')
    await db.query('update auth.users set email_confirmed_at = null where id = $1', [ghost])
    await db.as(ghost)
    await expectHint(db.rpc('complete_profile', { p_username: 'ghost', p_full_name: 'Ghost K', p_house_id: 1, p_region_id: 1, p_whatsapp: '9876543210', p_accept_rules: true }), 'BAD_DOMAIN')
  })
  it('staff-like usernames are refused', async () => {
    await db.as(su)
    expect(await db.rpc('username_available', { p_username: 'admin1' })).toBe(false)
    expect(await db.rpc('username_available', { p_username: 'iitm_official' })).toBe(false)
    expect(await db.rpc('username_available', { p_username: 'rahul_21' })).toBe(true)
  })
  it('anon cannot execute functions created later (default privileges)', async () => {
    await db.as('postgres')
    await db.exec(`create function public.zz_probe() returns int language sql as 'select 1'`)
    const r = await db.query<{ ok: boolean }>(`select has_function_privilege('anon', 'public.zz_probe()', 'execute') as ok`)
    expect(r.rows[0].ok).toBe(false)
  })
})

describe('organisers run matches', () => {
  it('an organiser passes the results guard; a player does not', async () => {
    const org = await db.newUser('22f3000888@es.study.iitm.ac.in')
    await db.as(su)
    await db.rpc('superadmin_set_email_role', { p_email: '22f3000888@es.study.iitm.ac.in', p_role: 'organizer' })
    await onboard(org, 'orgone')
    await db.as(org)
    await expectHint(db.rpc('admin_delete_match', { p_match_id: '00000000-0000-4000-8000-000000000000' }), 'NOT_FOUND')
    await expectHint(db.rpc('admin_upsert_game', { p: {} }), 'FORBIDDEN')
    await expectHint(db.rpc('admin_set_email_ban', { p_email: '21f1000001@ds.study.iitm.ac.in', p_banned: true, p_note: null }), 'FORBIDDEN')
    const neo = await db.newUser('22f3000889@es.study.iitm.ac.in')
    await onboard(neo, 'plainplayer')
    await db.as(neo)
    await expectHint(db.rpc('admin_delete_match', { p_match_id: '00000000-0000-4000-8000-000000000000' }), 'FORBIDDEN')
  })
})
