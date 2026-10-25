import { beforeAll, describe, expect, it } from 'vitest'
import { expectHint, freshDb, type Db } from './harness'

// 0020: Girls (pookie, queen) and Boys (boy, dude) avatar styles.
let db: Db
let u: string

beforeAll(async () => {
  db = await freshDb()
  u = await db.newUser('23f1000031@ds.study.iitm.ac.in')
  await db.as(u)
  await db.rpc('complete_profile', {
    p_username: 'pooja', p_full_name: 'Pooja Kumari', p_house_id: 2, p_region_id: 2, p_whatsapp: null, p_accept_rules: true,
  })
}, 60_000)

describe('avatar styles', () => {
  it('accepts every picker style', async () => {
    for (const st of ['pookie', 'queen', 'boy', 'dude', 'bottts', 'pixel-art', 'lorelei', 'thumbs']) {
      await db.as(u)
      await db.rpc('set_my_avatar', { p_avatar: `${st}:ab12` })
      await db.as('postgres')
      const r = await db.query<{ avatar: string }>(`select avatar from public.profiles where username = 'pooja'`)
      expect(r.rows[0].avatar).toBe(`${st}:ab12`)
    }
  })

  it('still refuses anything else', async () => {
    await db.as(u)
    await expectHint(db.rpc('set_my_avatar', { p_avatar: 'https://evil.example/x.png' }), 'BAD_INPUT')
  })
})
