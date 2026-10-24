// Screenshots the match lobby flow on the local dev database.
// Usage: node dev/lobby-demo.mjs [outDir] [width]   (dev server on :5199)
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const OUT = process.argv[2] ?? 'dev/shots-lobby'
const WIDTH = Number(process.argv[3] ?? 390)
const BASE = 'http://localhost:5199/'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()))
const shot = async (name, full = true) => {
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
  console.log('shot', name)
}
const sql = (q) => page.evaluate(async (q) => (await window.__devdb.query(q)).rows, q)

await page.goto(BASE + '#/')
await page.waitForSelector('.game-card', { timeout: 60_000 })
await sql(`update public.tournaments set status = 'closed', starts_at = now() + interval '2 hours', title = 'Stumble Guys Knockout' where slug = 'stumble-guys-s1'`)
await page.goto(BASE + '#/e/stumble-guys-s1?tab=lobby')
await page.waitForSelector('.lobby')
await shot('01-lobby-anon')

await page.goto(BASE + '#/signin')
await page.fill('#email', '24f2004141')
await page.click('button[type=submit]')
await page.waitForSelector('.otp input')
await page.fill('.otp input', '12345678')
await page.waitForSelector('#username, .game-card', { timeout: 20_000 })
if (await page.$('#username')) {
  await page.fill('#username', 'angad')
  await page.fill('#fullname', 'Angad Jangir')
  await page.selectOption('#house', '9')
  await page.selectOption('#region', { label: 'Chandigarh' })
  await page.fill('#wa', '9876543210')
  await page.waitForTimeout(600)
  await page.check('input[type=checkbox]')
  await page.click('button[type=submit]')
  await page.waitForURL((u) => !u.href.includes('welcome'), { timeout: 15_000 })
}
// Act as a plain player: drop the superadmin role and register directly.
await sql(`delete from public.user_roles`)
await sql(`with t as (select id from public.tournaments where slug = 'stumble-guys-s1'), p as (select id, username, house_id from public.profiles where username = 'angad'),
  e as (insert into public.entries (tournament_id, name, captain_id, house_id) select t.id, p.username, p.id, p.house_id from t, p returning id, tournament_id, captain_id)
  insert into public.entry_members (entry_id, tournament_id, user_id, role, ig_id) select id, tournament_id, captain_id, 'captain', 'AngadStumbles' from e`)
await sql(`insert into public.event_lobby (tournament_id, meet_url, chat_url, room_code, note) select id, 'https://meet.google.com/abc-defg-hij', 'https://chat.whatsapp.com/ExampleInvite', 'SG4821', 'Region: Asia · 5 games · top 8 to the final' from public.tournaments where slug = 'stumble-guys-s1'`)
await sql(`insert into public.event_notices (tournament_id, kind, title, body, created_at) select id, 'reminder', 'Starting in 15 minutes', 'Join the Google Meet now. Room code follows shortly.', now() - interval '5 minutes' from public.tournaments where slug = 'stumble-guys-s1'`)
await sql(`insert into public.event_notices (tournament_id, kind, title, body) select id, 'room', 'Room code is up: SG4821', 'Open the Lobby tab for the Meet link, room code and steps.' from public.tournaments where slug = 'stumble-guys-s1'`)
await page.goto(BASE + '#/')
await page.reload()
await page.goto(BASE + '#/e/stumble-guys-s1?tab=lobby')
await page.waitForSelector('.rule-list')
await shot('02-lobby-agree')
await page.check('.lobby-card .check input')
await page.click('text=Unlock lobby')
await page.waitForSelector('.room-tile')
await shot('03-lobby-unlocked')
await page.goto(BASE + '#/inbox')
await page.waitForSelector('.notice-list')
await page.evaluate(() => window.scrollTo(0, 0))
console.log('inbox h1:', await page.$eval('h1', (e) => e.textContent), 'scrollY', await page.evaluate(() => window.scrollY))
await shot('04-inbox', false)

await sql(`insert into public.user_roles (user_id, role) select id, 'superadmin' from public.profiles where username = 'angad'`)
await page.goto(BASE + '#/')
await page.reload()
await page.waitForSelector('.game-card')
const id = (await sql(`select id from public.tournaments where slug = 'stumble-guys-s1'`))[0].id
await page.setViewportSize({ width: Math.max(WIDTH, 1280), height: 900 })
await page.goto(BASE + `#/admin/events/${id}/lobby`)
await page.waitForSelector('.stat-chips', { timeout: 20_000 })
await shot('05-admin-lobby')
await browser.close()
