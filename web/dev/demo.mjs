// Local preview driver: seeds demo data into the in-browser dev database,
// signs in as the superadmin and screenshots every page.
// Usage: node dev/demo.mjs [outDir] [width]   (dev server on :5199)
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const OUT = process.argv[2] ?? 'dev/shots'
const WIDTH = Number(process.argv[3] ?? 390)
const BASE = 'http://localhost:5199/'
mkdirSync(OUT, { recursive: true })

const NAMES = ['aarav', 'vihaan', 'ishaan', 'kabir', 'ananya', 'diya', 'meera', 'riya', 'arjun', 'rohan', 'sai', 'neha',
  'kavya', 'aditya', 'yash', 'tanvi', 'priya', 'rahul', 'sneha', 'karan', 'pooja', 'nikhil', 'aisha', 'varun',
  'shreya', 'manav', 'tara', 'dev', 'ira', 'om', 'zoya', 'reyansh', 'siya', 'atharv', 'myra', 'vivaan',
  'anika', 'krish', 'navya', 'ayaan', 'pari', 'shaurya', 'kiara', 'rudra', 'avni', 'dhruv', 'saanvi', 'arnav']
const TEAMS = ['Night Owls', 'Saffron Squad', 'Mangrove Ghosts', 'Tusker Unit', 'Red Panda Ops', 'Ghat Runners',
  'Monsoon Five', 'Shola Strikers', 'Delta Wolves', 'Kanha Kings', 'Rann Raiders', 'Terai Titans']

function demoSql() {
  const users = NAMES.map((n, i) => ({ id: randomUUID(), u: `${n}_${(i % 7) + 21}`, email: `2${3 + (i % 2)}f100${String(1000 + i)}@ds.study.iitm.ac.in`, house: (i % 12) + 1, region: (i % 10) + 1, name: n[0].toUpperCase() + n.slice(1) + ' Sharma' }))
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`
  let sql = ''
  for (const u of users) {
    sql += `insert into auth.users (id, email) values (${q(u.id)}, ${q(u.email)});\n`
    sql += `insert into public.profiles (id, email, username, full_name, house_id, region_id, whatsapp, rules_accepted_at) values (${q(u.id)}, ${q(u.email)}, ${q(u.u)}, ${q(u.name)}, ${u.house}, ${u.region}, '+919800000${String(100 + users.indexOf(u)).padStart(3, '0')}', now());\n`
  }
  const day = 86_400_000
  const iso = (ms) => new Date(Date.now() + ms).toISOString()
  sql += `update public.tournaments set status = 'live', reg_opens_at = ${q(iso(-9 * day))}, reg_closes_at = ${q(iso(-2 * day))}, starts_at = ${q(iso(-1 * day))}, title = 'BGMI Squad Cup', summary = 'Season 1 squad battle royale. Three maps per day across Erangel, Miramar and Sanhok. Top 16 squads go to the final.' where slug = 'bgmi-s1';\n`
  sql += `update public.tournaments set status = 'completed', reg_opens_at = ${q(iso(-30 * day))}, reg_closes_at = ${q(iso(-20 * day))}, starts_at = ${q(iso(-14 * day))}, title = 'Blitz Arena' where slug = 'chess-s1';\n`
  sql += `update public.tournaments set status = 'open', reg_opens_at = ${q(iso(-3 * day))}, reg_closes_at = ${q(iso(4 * day))}, starts_at = ${q(iso(7 * day))}, title = 'VALORANT Ascent Open' where slug = 'valorant-s1';\n`
  sql += `update public.tournaments set status = 'open', reg_opens_at = ${q(iso(-1 * day))}, reg_closes_at = ${q(iso(2 * day))}, starts_at = ${q(iso(3 * day))}, title = 'Free Fire MAX Clash' where slug = 'ff-max-s1';\n`
  sql += `update public.tournaments set status = 'open', reg_opens_at = ${q(iso(-1 * day))}, reg_closes_at = ${q(iso(6 * day))}, starts_at = ${q(iso(8 * day))} where slug in ('clash-royale-s1', 'skribbl-s1');\n`
  sql += `update public.tournaments set reg_opens_at = ${q(iso(5 * day))} where status = 'upcoming';\n`

  // BGMI: 12 squads of 4, two matches played.
  const entries = []
  for (let t = 0; t < 12; t++) {
    const id = randomUUID()
    const cap = users[t * 4]
    entries.push(id)
    sql += `insert into public.entries (id, tournament_id, name, captain_id, invite_code) select ${q(id)}, id, ${q(TEAMS[t])}, ${q(cap.id)}, ${q('BGMITM' + 'ABCDEFGHJKLM'[t] + 'Z')} from public.tournaments where slug = 'bgmi-s1';\n`
    for (let m = 0; m < 4; m++) {
      const u = users[t * 4 + m]
      sql += `insert into public.entry_members (entry_id, tournament_id, user_id, role, ig_id, extra) select ${q(id)}, id, ${q(u.id)}, ${m === 0 ? "'captain'" : "'player'"}, '5${String(10000000 + t * 4 + m)}', '{"ign": "${u.u.toUpperCase()}"}' from public.tournaments where slug = 'bgmi-s1';\n`
    }
  }
  const bgmiPts = { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 }
  for (const [mi, label] of ['Match 1 · Erangel', 'Match 2 · Miramar'].entries()) {
    const mid = randomUUID()
    sql += `insert into public.matches (id, tournament_id, label, played_at) select ${q(mid)}, id, ${q(label)}, ${q(iso(-day + mi * 3_600_000))} from public.tournaments where slug = 'bgmi-s1';\n`
    const order = [...entries].sort(() => Math.random() - 0.5)
    order.forEach((e, i) => {
      const kills = Math.max(0, Math.round(12 - i + Math.random() * 6 - 3))
      sql += `insert into public.match_results (match_id, entry_id, placement, kills, points) values (${q(mid)}, ${q(e)}, ${i + 1}, ${kills}, ${(bgmiPts[i + 1] ?? 0) + kills});\n`
    })
  }

  // Chess: 16 players, completed with final placements.
  const mid = randomUUID()
  sql += `insert into public.matches (id, tournament_id, label, played_at) select ${q(mid)}, id, 'Final standings', ${q(iso(-14 * day))} from public.tournaments where slug = 'chess-s1';\n`
  const chessPts = { 1: 10, 2: 7, 3: 5, 4: 4 }
  users.slice(16, 32).forEach((u, i) => {
    const id = randomUUID()
    sql += `insert into public.entries (id, tournament_id, name, captain_id, house_id) select ${q(id)}, id, ${q(u.u)}, ${q(u.id)}, ${u.house} from public.tournaments where slug = 'chess-s1';\n`
    sql += `insert into public.entry_members (entry_id, tournament_id, user_id, role, ig_id) select ${q(id)}, id, ${q(u.id)}, 'captain', ${q('lc_' + u.u)} from public.tournaments where slug = 'chess-s1';\n`
    sql += `insert into public.match_results (match_id, entry_id, placement, points) values (${q(mid)}, ${q(id)}, ${i + 1}, ${chessPts[i + 1] ?? (i < 8 ? 2 : 1)});\n`
  })
  // Valorant: 3 teams forming.
  for (let t = 0; t < 3; t++) {
    const id = randomUUID()
    const cap = users[32 + t * 3]
    sql += `insert into public.entries (id, tournament_id, name, captain_id, invite_code) select ${q(id)}, id, ${q(['Spike Rush', 'Haven Heroes', 'Lotus Bloom'][t])}, ${q(cap.id)}, ${q('VALRNT' + 'ABC'[t] + 'Z')} from public.tournaments where slug = 'valorant-s1';\n`
    for (let m = 0; m < 3; m++) {
      const u = users[32 + t * 3 + m]
      sql += `insert into public.entry_members (entry_id, tournament_id, user_id, role, ig_id, extra) select ${q(id)}, id, ${q(u.id)}, ${m === 0 ? "'captain'" : "'player'"}, ${q(u.u + '#IITM')}, '{"rank": "Gold 2"}' from public.tournaments where slug = 'valorant-s1';\n`
    }
  }
  return sql
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()))

const shot = async (name, full = true) => {
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
  console.log('shot', name)
}

await page.goto(BASE + '#/')
await page.waitForSelector('.game-card', { timeout: 60_000 })
const seeded = await page.evaluate(async () => (await window.__devdb.query("select count(*)::int as n from public.profiles")).rows[0].n)
if (seeded === 0) {
  await page.evaluate(async (sql) => { await window.__devdb.exec(sql) }, demoSql())
  await page.reload()
  await page.waitForSelector('.game-card')
}
await shot('01-events-anon')

await page.goto(BASE + '#/signin')
await page.fill('#email', '24f2004141')
await shot('02-signin', false)
await page.click('button[type=submit]')
await page.waitForSelector('.otp input')
await shot('03-otp', false)
await page.fill('.otp input', '12345678')
await page.waitForSelector('#username, .game-card', { timeout: 20_000 })
if (await page.$('#username')) {
  await page.fill('#username', 'angad')
  await page.fill('#fullname', 'Angad Jangir')
  await page.selectOption('#house', '9')
  await page.selectOption('#region', { label: 'Chandigarh' })
  await page.fill('#wa', '9876543210')
  await page.waitForTimeout(600)
  await shot('04-onboarding')
  await page.check('input[type=checkbox]')
  await page.click('button[type=submit]')
  await page.waitForURL((u) => !u.href.includes('welcome'), { timeout: 15_000 })
}
await page.goto(BASE + '#/')
await page.waitForSelector('.game-card')
await shot('05-events')
await page.goto(BASE + '#/e/bgmi-s1')
await page.waitForSelector('.lrow')
await shot('06-event-bgmi-standings')
await page.goto(BASE + '#/e/valorant-s1')
await page.waitForSelector('.meta-grid')
await shot('07-event-valorant')
await page.goto(BASE + '#/e/valorant-s1/register')
await page.waitForSelector('#team')
await shot('08-register-team')
await page.goto(BASE + '#/houses')
await page.waitForSelector('.lrow')
await shot('09-houses')
await page.goto(BASE + '#/leaderboards')
await page.waitForSelector('.link-row')
await shot('10-leaderboards')
await page.goto(BASE + '#/me')
await page.waitForSelector('.stats')
await shot('11-me')
await page.goto(BASE + '#/rules')
await shot('12-rules', false)

if (process.env.ADMIN) {
  await page.setViewportSize({ width: 1280, height: 900 })
  const ids = await page.evaluate(async () => {
    const r = await window.__devdb.query("select t.slug, t.id, t.game_id from public.tournaments t where slug in ('bgmi-s1', 'valorant-s1')")
    return Object.fromEntries(r.rows.map((x) => [x.slug, x]))
  })
  const visit = async (hash, name, sel = '.admin-layout') => {
    await page.goto(BASE + '#/admin' + hash)
    await page.waitForSelector(sel, { timeout: 20_000 })
    await shot(name)
  }
  await visit('', '20-admin-overview')
  await visit('/events', '21-admin-events')
  await visit(`/events/${ids['valorant-s1'].id}`, '22-admin-event-edit')
  await visit(`/events/${ids['bgmi-s1'].id}/registrations`, '23-admin-registrations')
  await visit(`/events/${ids['bgmi-s1'].id}/results`, '24-admin-results')
  await visit(`/games/${ids['bgmi-s1'].game_id}`, '25-admin-game-edit')
  await visit('/players', '26-admin-players')
  await visit('/audit', '27-admin-audit')
}
await browser.close()
