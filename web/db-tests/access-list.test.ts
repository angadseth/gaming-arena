import { beforeAll, describe, expect, it } from 'vitest'
import { expectHint, freshDb, type Db } from './harness'

// 0016: the Super Admin's "Team & access" list.
let db: Db
let su: string, sagar: string, bob: string

interface Row { email: string; registered: boolean; username: string | null; role: string | null; banned: boolean; suspended: boolean; note: string | null }

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
  bob = await db.newUser('23f1000002@ds.study.iitm.ac.in')
  await onboard(su, 'angad')
  await onboard(sagar, 'sagar')
  await onboard(bob, 'bob')
  await db.as(su)
  await db.rpc('superadmin_set_email_role', { p_email: '23f1000009@ds.study.iitm.ac.in', p_role: 'organizer' })
  await db.rpc('admin_set_email_ban', { p_email: '23f1000002@ds.study.iitm.ac.in', p_banned: true, p_note: 'cheating' })
}, 60_000)

describe('access list', () => {
  it('lists the superadmin, admins, pre-set roles and bans, staff first', async () => {
    await db.as(su)
    const rows = await db.rpc<Row[]>('superadmin_access_list')
    const by = Object.fromEntries(rows.map((r) => [r.email, r]))
    expect(rows[0]).toMatchObject({ username: 'angad', role: 'superadmin', banned: false })
    expect(by['25f2003321@ds.study.iitm.ac.in']).toMatchObject({ username: 'sagar', role: 'admin', registered: true })
    expect(by['24f3002949@mg.study.iitm.ac.in']).toMatchObject({ role: 'admin', registered: false })
    expect(by['23f1000009@ds.study.iitm.ac.in']).toMatchObject({ role: 'organizer', registered: false })
    expect(by['23f1000002@ds.study.iitm.ac.in']).toMatchObject({ username: 'bob', banned: true, note: 'cheating', role: null })
    const order = rows.map((r) => r.role)
    expect(order.indexOf('organizer')).toBeGreaterThan(order.lastIndexOf('admin'))
  })
  it('admins and players cannot read it', async () => {
    await db.as(sagar)
    await expectHint(db.rpc('superadmin_access_list'), 'FORBIDDEN')
    await db.as(null)
    await expect(db.rpc('superadmin_access_list')).rejects.toThrow()
  })
})
