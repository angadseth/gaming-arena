// Runs the real Supabase migrations inside PGlite with a minimal stand-in
// for Supabase's auth schema and roles, so RLS and RPC rules can be tested
// without Docker or a live project.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = join(__dirname, '..', '..', 'supabase', 'migrations')

const SUPABASE_STUB = readFileSync(join(__dirname, '..', 'dev', 'supabase-stub.sql'), 'utf8')

export type Db = PGlite & {
  as: (who: string | null) => Promise<void>
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<T>
  newUser: (email: string) => Promise<string>
}

export async function freshDb(): Promise<Db> {
  const pg = (await PGlite.create()) as Db
  await pg.exec(SUPABASE_STUB)
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && !f.includes('_remote_')).sort()) {
    await pg.exec(readFileSync(join(MIGRATIONS, f), 'utf8'))
  }

  // who = user id -> authenticated; null -> anon; 'postgres' -> owner.
  pg.as = async (who) => {
    await pg.exec('reset role')
    if (who === 'postgres') {
      await pg.exec(`select set_config('request.jwt.claim.sub', '', false)`)
      return
    }
    await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who ?? ''])
    await pg.exec(who ? 'set role authenticated' : 'set role anon')
  }

  // Calls a function with named args, like supabase.rpc().
  pg.rpc = async (fn, args = {}) => {
    const keys = Object.keys(args)
    const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`
    const vals = keys.map((k) => {
      const v = args[k]
      return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
    })
    const res = await pg.query<{ r: unknown }>(sql, vals)
    return res.rows[0]?.r as never
  }

  // Inserts an auth user as the auth server would (owner role).
  pg.newUser = async (email) => {
    await pg.exec('reset role')
    const r = await pg.query<{ id: string }>('insert into auth.users (email) values ($1) returning id', [email])
    return r.rows[0].id
  }
  return pg
}

// Expects a promise to reject with a given HINT code.
export async function expectHint(p: Promise<unknown>, hint: string) {
  try {
    await p
  } catch (e) {
    const err = e as { hint?: string; message?: string }
    if (err.hint === hint) return
    throw new Error(`expected hint ${hint}, got ${err.hint}: ${err.message}`)
  }
  throw new Error(`expected hint ${hint}, but call succeeded`)
}
