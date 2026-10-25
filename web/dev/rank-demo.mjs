// Preview: top 3 cards + my rank card on an event board. Usage: node dev/rank-demo.mjs (dev server on :5199)
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
const OUT = 'dev/shots-roles'
mkdirSync(OUT, { recursive: true })
const NAMES = ['rahul_07', 'priya_k', 'aman22', 'sid', 'kavya', 'rohan_x', 'meera', 'arjun9', 'tanvi', 'yash_g', 'neha', 'om_p']
const q = (s) => `'${String(s).replace(/'/g, "''")}'`
let sql = `update public.tournaments set status = 'live' where slug = 'stumble-guys-s1';\n`
const mid = randomUUID()
sql += `insert into public.matches (id, tournament_id, label) select ${q(mid)}, id, 'Game 1' from public.tournaments where slug = 'stumble-guys-s1';\n`
NAMES.forEach((n, i) => {
  const id = randomUUID(), e = randomUUID(), email = `23f10030${String(10 + i)}@ds.study.iitm.ac.in`
  sql += `insert into auth.users (id, email) values (${q(id)}, ${q(email)});\n`
  sql += `insert into public.profiles (id, email, username, full_name, house_id, region_id, whatsapp, rules_accepted_at) values (${q(id)}, ${q(email)}, ${q(n)}, 'Test Player', ${(i % 12) + 1}, 2, '+91980000${String(2000 + i)}', now());\n`
  sql += `insert into public.entries (id, tournament_id, name, captain_id, invite_code) select ${q(e)}, id, ${q(n)}, ${q(id)}, ${q('RNKR' + 'ABCDEFGHJKLM'[i] + 'ZZZ')} from public.tournaments where slug = 'stumble-guys-s1';\n`
  sql += `insert into public.entry_members (entry_id, tournament_id, user_id, role, ig_id, extra) select ${q(e)}, id, ${q(id)}, 'captain', ${q(n.toUpperCase())}, '{}' from public.tournaments where slug = 'stumble-guys-s1';\n`
  sql += `insert into public.match_results (match_id, entry_id, placement, kills, points) values (${q(mid)}, ${q(e)}, ${i + 1}, 0, ${Math.max(50, 1200 - i * 110)});\n`
})
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
await page.goto('http://localhost:5199/#/')
await page.waitForSelector('.game-card', { timeout: 60_000 })
await page.evaluate(async (s) => { await window.__devdb.exec(s) }, sql)
await page.goto('http://localhost:5199/#/signin')
await page.fill('#email', '23f1003015')
await page.click('button[type=submit]')
await page.waitForSelector('.otp input')
await page.fill('.otp input', '12345678')
await page.waitForTimeout(2500)
await page.goto('http://localhost:5199/#/e/stumble-guys-s1?tab=standings')
await page.waitForSelector('.myrank', { timeout: 20_000 })
await page.waitForTimeout(1200)
await page.evaluate(() => document.querySelector('.podium').scrollIntoView({ block: 'start' }))
await page.evaluate(() => window.scrollBy(0, -70))
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/11-rank-390.png` })
await browser.close()
console.log('ok')
