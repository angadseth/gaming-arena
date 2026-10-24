import { beforeAll, describe, expect, it } from 'vitest'
import { expectHint, freshDb, type Db } from './harness'

let db: Db
let neha: string, arjun: string

const signup = async (id: string, username: string) => {
  await db.as(id)
  return db.rpc('complete_profile', {
    p_username: username, p_full_name: 'Test Player', p_house_id: 9, p_region_id: 2,
    p_whatsapp: '98765 43210', p_accept_rules: true,
  })
}
const available = async (u: string) => {
  await db.as(arjun)
  return db.rpc<boolean>('username_available', { p_username: u })
}

beforeAll(async () => {
  db = await freshDb()
  neha = await db.newUser('23f1000021@ds.study.iitm.ac.in')
  arjun = await db.newUser('23f1000022@ds.study.iitm.ac.in')
  await signup(arjun, 'arjun')
}, 60_000)

describe('offensive usernames', () => {
  it('refuses abuse at signup, including leetspeak, stretched letters and underscores', async () => {
    for (const u of ['fuckboy', 'b1tch_queen', 'fuuuck', 'f_u_c_k', 'bhenchod7', 'chutiya_op', 'pro_bc', 'a55', 'lund_99', 'gaandu']) {
      await expectHint(signup(neha, u), 'USERNAME_BLOCKED')
    }
  })
  it('does not block real names that only look close', async () => {
    for (const u of ['gandhi', 'aasim', 'chodankar', 'bhosale', 'kamineni', 'poornima', 'dickens', 'class_topper', 'suvarna', 'cumberbatch', 'shital']) {
      expect(await available(u), u).toBe(true)
    }
  })
  it('the live check says no to blocked names', async () => {
    expect(await available('madarchod')).toBe(false)
    expect(await available('neha_plays')).toBe(true)
  })
  it('refuses a rename to a blocked name', async () => {
    await expectHint(db.rpc('update_my_profile', { p_username: 'harami_x', p_full_name: 'Test Player', p_whatsapp: '98765 43210' }), 'USERNAME_BLOCKED')
  })
  it('keeps the word list private', async () => {
    await db.as(arjun)
    await expect(db.query('select * from public.blocked_words')).rejects.toThrow()
    await expect(db.rpc('username_is_clean', { p_username: 'x' })).rejects.toThrow()
  })
})
