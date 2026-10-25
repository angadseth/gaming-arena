import { beforeAll, describe, expect, it } from 'vitest'
import { expectHint, freshDb, type Db } from './harness'

let db: Db
let ravi: string, meera: string

type Me = { username: string; full_name: string; whatsapp: string; username_next_change: string | null }
const me = async (id: string) => {
  await db.as(id)
  return db.rpc<Me>('get_my_profile')
}
const edit = async (id: string, username: string, fullName: string, whatsapp: string) => {
  await db.as(id)
  return db.rpc('update_my_profile', { p_username: username, p_full_name: fullName, p_whatsapp: whatsapp })
}

beforeAll(async () => {
  db = await freshDb()
  ravi = await db.newUser('23f1000011@ds.study.iitm.ac.in')
  meera = await db.newUser('23f1000012@ds.study.iitm.ac.in')
  for (const [id, u] of [[ravi, 'ravi'], [meera, 'meera']]) {
    await db.as(id)
    await db.rpc('complete_profile', {
      p_username: u, p_full_name: `${u} Sharma`, p_house_id: 9, p_region_id: 2,
      p_whatsapp: '98765 43210', p_accept_rules: true,
    })
  }
}, 60_000)

describe('players edit their own profile', () => {
  it('changes full name and WhatsApp; the username stays as chosen', async () => {
    await edit(ravi, ' Ravi ', 'Ravi  Kumar Sharma', '91234 56789')
    const p = await me(ravi)
    expect(p.username).toBe('ravi')
    expect(p.full_name).toBe('Ravi Kumar Sharma')
    expect(p.whatsapp).toBe('+919123456789')
  })
  it('never changes a username, even to a free one (0022)', async () => {
    await expectHint(edit(ravi, 'raviplays', 'Ravi Kumar Sharma', '91234 56789'), 'USERNAME_LOCKED')
    await db.as('postgres')
    await db.exec(`update public.profiles set username_changed_at = now() - interval '365 days' where id = '${ravi}'`)
    await expectHint(edit(ravi, 'raviplays', 'Ravi Kumar Sharma', '91234 56789'), 'USERNAME_LOCKED')
    await expectHint(edit(meera, 'ravi', 'Meera Sharma', '98765 43210'), 'USERNAME_LOCKED')
    expect((await me(ravi)).username).toBe('ravi')
    expect((await me(meera)).username).toBe('meera')
  })
  it('still checks the full name', async () => {
    await expectHint(edit(meera, 'meera', 'M3era!', '98765 43210'), 'BAD_NAME')
  })
  it('limits full-name changes to 3 in 30 days', async () => {
    await edit(meera, 'meera', 'Meera A Sharma', '98765 43210')
    await edit(meera, 'meera', 'Meera B Sharma', '98765 43210')
    await edit(meera, 'meera', 'Meera C Sharma', '98765 43210')
    await expectHint(edit(meera, 'meera', 'Meera D Sharma', '98765 43210'), 'RATE_LIMITED')
  })
  it('a username can still not be changed by a direct update', async () => {
    await db.as('postgres')
    await expect(db.exec(`update public.profiles set username = 'sneaky' where id = '${meera}'`)).rejects.toThrow(/profile page/)
  })
  it('a banned player cannot edit', async () => {
    await db.as('postgres')
    await db.exec(`update public.profiles set status = 'banned' where id = '${meera}'`)
    await expectHint(edit(meera, 'meera_new', 'Meera Sharma', '98765 43210'), 'ACCOUNT_BLOCKED')
  })
})
