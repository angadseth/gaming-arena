// Preview of the Team & access page (Super Admin). Usage: node dev/access-demo.mjs [outDir]  (dev server on :5199)
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const OUT = process.argv[2] ?? 'dev/shots-roles'
const BASE = 'http://localhost:5199/'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()))
const shot = async (name, full = false) => {
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
  console.log('shot', name)
}

await page.goto(BASE + '#/signin')
await page.fill('#email', '24f2004141')
await page.click('button[type=submit]')
await page.waitForSelector('.otp input')
await page.fill('.otp input', '12345678')
await page.waitForSelector('#username, .game-card', { timeout: 20_000 })
if (await page.$('#username')) {
  await page.fill('#username', 'angad_seth')
  await page.fill('#fullname', 'Test Player')
  await page.selectOption('#house', '9')
  await page.selectOption('#region', { index: 2 })
  await page.fill('#wa', '9876543210')
  await page.waitForTimeout(600)
  await page.check('input[type=checkbox]')
  await page.click('button[type=submit]')
  await page.waitForURL((u) => !u.href.includes('welcome'), { timeout: 15_000 })
}

// A dev server started before 0016 existed may not have it in its migration glob.
const sql16 = readFileSync('../supabase/migrations/20261025000016_access_list.sql', 'utf8')
await page.evaluate(async (sql) => { await window.__devdb.exec(sql) }, sql16)
await page.goto(BASE + '#/admin/access')
await page.waitForSelector('.acc', { timeout: 20_000 })
// Make an organiser and ban someone through the page itself.
await page.fill('#acc-email', '23f1000777')
await page.click('button.chip:has-text("Make Organiser")')
await page.click('.acc-form .btn-primary')
await page.waitForTimeout(1200)
await page.fill('#acc-email', '23f1000888')
await page.click('button.chip:has-text("Ban")')
await page.fill('#acc-note', 'smurf account')
await page.click('.acc-form .btn-danger-fill')
await page.waitForTimeout(1500)
await shot('20-access-1280', true)
await page.setViewportSize({ width: 390, height: 844 })
await shot('21-access-390', true)
console.log('scrollWidth at 390:', await page.evaluate(() => document.documentElement.scrollWidth))
console.log('wide:', await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > 392).slice(0, 5).map((e) => e.className || e.tagName)))
await browser.close()
