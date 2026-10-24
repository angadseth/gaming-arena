// Screenshots the game-night flow on the local dev database: locked lobby, register with the
// in-game name helper, organiser runbook, and results by "names in order".
// Usage: node dev/gamenight-demo.mjs [outDir] [width]   (dev server on :5199)
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const OUT = process.argv[2] ?? 'dev/shots-gamenight'
const WIDTH = Number(process.argv[3] ?? 1280)
const BASE = 'http://localhost:5199/'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 820 }, deviceScaleFactor: 1 })
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
await sql(`update public.tournaments set status = 'open', reg_opens_at = null, reg_closes_at = null, starts_at = date_trunc('hour', now()) + interval '3 hours' where slug = 'stumble-guys-s1'`)
await page.goto(BASE + '#/e/stumble-guys-s1?tab=lobby')
await page.waitForSelector('.lobby-gate')
await shot('01-lobby-anon', false)

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
await page.goto(BASE + '#/e/stumble-guys-s1/register')
await page.waitForSelector('.name-help')
await page.fill('#igid', '[color=red]AngadStumbles[/color]')
await shot('02-register')
await page.check('form .check input')
await page.click('form button[type=submit]')
await page.waitForSelector('text=Open lobby')
console.log('registered as', JSON.stringify(await sql(`select ig_id from public.entry_members`)))

await page.goto(BASE + '#/e/stumble-guys-s1?tab=lobby')
if (await page.$('.rule-list')) {
  await page.check('.lobby-card .check input')
  await page.click('text=Unlock lobby')
}
await page.waitForSelector('.checkin')
await shot('03-lobby-registered')

const tid = (await sql(`select id from public.tournaments where slug = 'stumble-guys-s1'`))[0].id
await page.goto(BASE + `#/admin/events/${tid}/lobby`)
await page.waitForSelector('.night-steps')
await shot('04-admin-lobby', false)

await page.goto(BASE + `#/admin/events/${tid}/results`)
await page.waitForSelector('#m-lines')
await page.fill('#m-lines', ['angadstumble, 1200', 'Rahul_07, 700', 'Priya.k'].join(String.fromCharCode(10)))
await shot('05-results-typo')
await page.click('text=Use AngadStumbles')
await page.locator('label.check', { hasText: 'outsiders' }).locator('input').check()
await shot('06-results-ok')
await page.click('text=Save Game 1')
await page.waitForSelector('.rs-game')
await page.waitForTimeout(1200)
console.log('saved', JSON.stringify(await sql(`select r.placement, r.points from public.match_results r`)))
await shot('07-results-saved')
await page.click('.rs-game >> text=Edit')
await shot('08-results-edit', false)
await browser.close()
