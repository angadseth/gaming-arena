// Preview of the 25 Oct changes: Diwali home, roles v2 dashboard, @mention results.
// Usage: node dev/roles-demo.mjs [outDir]   (dev server on :5199)
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const OUT = process.argv[2] ?? 'dev/shots-roles'
const BASE = 'http://localhost:5199/'
mkdirSync(OUT, { recursive: true })

const NAMES = ['rahul_07', 'priya_k', 'aman22', 'sid', 'kavya', 'rohan_x', 'meera', 'arjun9']
function seedSql() {
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`
  let sql = `update public.tournaments set status = 'open', reg_opens_at = null, reg_closes_at = now() + interval '5 days', starts_at = now() + interval '5 days 1 hour' where slug in ('stumble-guys-s1', 'smash-karts-s1', 'bgmi-s1');\n`
  NAMES.forEach((n, i) => {
    const id = randomUUID()
    const email = `23f10020${String(10 + i)}@ds.study.iitm.ac.in`
    sql += `insert into auth.users (id, email) values (${q(id)}, ${q(email)});\n`
    sql += `insert into public.profiles (id, email, username, full_name, house_id, region_id, whatsapp, rules_accepted_at) values (${q(id)}, ${q(email)}, ${q(n)}, ${q(n + ' Kumar')}, ${(i % 12) + 1}, 2, '+91980000${String(1000 + i)}', now());\n`
    const e = randomUUID()
    sql += `insert into public.entries (id, tournament_id, name, captain_id, invite_code) select ${q(e)}, id, ${q(n)}, ${q(id)}, ${q('STMBL' + 'ABCDEFGH'[i] + 'ZZ')} from public.tournaments where slug = 'stumble-guys-s1';\n`
    sql += `insert into public.entry_members (entry_id, tournament_id, user_id, role, ig_id, extra) select ${q(e)}, id, ${q(id)}, 'captain', ${q(n.toUpperCase().replace(/[._]/g, ''))}, '{}' from public.tournaments where slug = 'stumble-guys-s1';\n`
  })
  return sql
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()))
const shot = async (name, full = false) => {
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
  console.log('shot', name)
}

async function signIn(roll, username) {
  await page.goto(BASE + '#/signin')
  await page.fill('#email', roll)
  await page.click('button[type=submit]')
  await page.waitForSelector('.otp input')
  await page.fill('.otp input', '12345678')
  await page.waitForSelector('#username, .game-card', { timeout: 20_000 })
  if (await page.$('#username')) {
    await page.fill('#username', username)
    await page.fill('#fullname', 'Test Player')
    await page.selectOption('#house', '9')
    await page.selectOption('#region', { index: 2 })
    await page.fill('#wa', '9876543210')
    await page.waitForTimeout(600)
    await page.check('input[type=checkbox]')
    await page.click('button[type=submit]')
    await page.waitForURL((u) => !u.href.includes('welcome'), { timeout: 15_000 }).catch(async (e) => {
      await page.screenshot({ path: `${OUT}/err-onboard.png`, fullPage: true })
      throw e
    })
  }
}

await page.goto(BASE + '#/')
await page.waitForSelector('.game-card', { timeout: 60_000 })
await page.evaluate(async (sql) => { await window.__devdb.exec(sql) }, seedSql())
await page.reload()
await page.waitForSelector('.game-card')
await shot('01-home-1280')
await shot('02-home-full', true)
await page.setViewportSize({ width: 390, height: 844 })
await shot('03-home-390')
await page.setViewportSize({ width: 1280, height: 860 })

await signIn('24f2004141', 'angad_seth')
await page.goto(BASE + '#/admin')
await page.waitForSelector('.aev')
await shot('04-dash-super', true)
const sid = await page.evaluate(async () => (await window.__devdb.query("select id from public.tournaments where slug = 'stumble-guys-s1'")).rows[0].id)
await page.goto(BASE + `#/admin/events/${sid}/results`)
await page.waitForSelector('#m-lines')
await page.click('#m-lines')
await page.keyboard.type('@ra')
await shot('05-mention')
await page.keyboard.press('Enter')
await page.keyboard.type('1000\n@pri')
await page.keyboard.press('Enter')
await page.keyboard.type('700\n@')
await shot('06-mention-all')
await page.keyboard.press('Escape')
await page.keyboard.type('aman22 500')
await shot('07-results-filled')

// Sagar (admin, pre-set by email in 0015)
await page.evaluate(() => localStorage.clear())
await ctx.clearCookies()
await page.goto(BASE + '#/me')
const out = await page.$('text=Sign out')
if (out) await out.click()
await page.waitForTimeout(800)
await signIn('25f2003321', 'sagar')
await page.goto(BASE + '#/admin')
await page.waitForSelector('.aev')
await shot('08-dash-admin', true)
await page.goto(BASE + `#/admin/events/${sid}/registrations`)
await page.waitForTimeout(1200)
await shot('09-regs-admin')
await page.goto(BASE + '#/leaderboards')
await page.waitForTimeout(1200)
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(BASE + '#/admin')
await page.waitForSelector('.aev')
await shot('10-dash-admin-390', true)
await browser.close()
