// Local development backend: runs the real Supabase migrations inside
// PGlite (Postgres in WebAssembly) in the browser, with a stand-in auth.
// Never shipped in production builds (loaded by dynamic import only when
// no Supabase URL is configured).
import type { PGlite, Transaction } from '@electric-sql/pglite'
import stubSql from '../../../dev/supabase-stub.sql?raw'
import type { Game, House, Region, Session, Tournament } from '../types'
import { ApiError, SET_RETURNING, type Api } from './types'

export const DEV_OTP = '12345678'
const SESSION_KEY = 'pugmark-dev-session'
const ART_KEY = 'pugmark-dev-art:'

const migrations = import.meta.glob('../../../../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

// pglite returns Date / bigint / numeric-as-string; Supabase returns JSON.
function normalize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'bigint') return Number(v)
  if (Array.isArray(v)) return v.map(normalize)
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)]))
  }
  return v
}

const NUMERIC_KEYS = new Set(['points', 'kill_points', 'points_adjust'])
function numerics<T>(row: T): T {
  const r = row as Record<string, unknown>
  for (const k of Object.keys(r)) {
    if (NUMERIC_KEYS.has(k) && typeof r[k] === 'string') r[k] = Number(r[k])
  }
  return row
}

function toApiError(e: unknown): ApiError {
  const err = e as { message?: string; hint?: string; code?: string }
  return new ApiError(err.message ?? 'Something went wrong', err.hint || err.code || 'UNKNOWN')
}

export async function createPgliteApi(): Promise<Api> {
  const { PGlite: PG } = await import('@electric-sql/pglite')
  const db: PGlite = await PG.create('idb://pugmark-dev')

  const ready = await db.query<{ ok: string | null }>(`select to_regclass('public.games')::text as ok`)
  if (!ready.rows[0]?.ok) {
    await db.exec(stubSql)
    for (const key of Object.keys(migrations).sort()) {
      if (key.includes('_remote_')) continue
      await db.exec(await migrations[key]())
    }
  }

  // Dev-only handle for scripted demo data (dev/demo.mjs).
  ;(window as unknown as { __devdb?: PGlite }).__devdb = db

  let session: Session | null = null
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    session = null
  }
  const listeners = new Set<(s: Session | null) => void>()
  const setSession = (s: Session | null) => {
    session = s
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* private mode: session lives in memory */
    }
    listeners.forEach((cb) => cb(s))
  }

  // Every call runs in its own transaction as anon/authenticated, so RLS
  // and grants apply exactly as they would through PostgREST.
  const asCaller = async <T>(fn: (tx: Transaction) => Promise<T>): Promise<T> => {
    try {
      return await db.transaction(async (tx) => {
        await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [session?.userId ?? ''])
        await tx.exec(session ? 'set local role authenticated' : 'set local role anon')
        return fn(tx)
      })
    } catch (e) {
      throw toApiError(e)
    }
  }

  const select = <T>(sql: string) =>
    asCaller(async (tx) => (await tx.query<T>(sql)).rows.map((r) => numerics(normalize(r) as T)))

  return {
    kind: 'pglite',
    async getSession() {
      return session
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async sendCode(email) {
      const ok = await db.query<{ ok: boolean }>('select public.email_domain_allowed($1) as ok', [email])
      if (!ok.rows[0]?.ok) throw new ApiError('Only IIT Madras BS student emails can sign in.', 'BAD_DOMAIN')
      const exists = await db.query('select 1 from auth.users where lower(email) = lower($1)', [email])
      if (!exists.rows.length) await db.query('insert into auth.users (email) values (lower($1))', [email])
    },
    async verifyCode(email, code) {
      if (code !== DEV_OTP) throw new ApiError('That code did not match.', 'BAD_CODE')
      const r = await db.query<{ id: string }>('select id from auth.users where lower(email) = lower($1)', [email])
      if (!r.rows[0]) throw new ApiError('Request a new code first.', 'BAD_CODE')
      setSession({ userId: r.rows[0].id, email: email.toLowerCase() })
    },
    async signOut() {
      setSession(null)
    },
    async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
      if (!/^[a-z_][a-z0-9_]*$/.test(fn)) throw new ApiError('Bad function name', 'BAD_INPUT')
      const keys = Object.keys(args)
      const named = keys.map((k, i) => `${k} => $${i + 1}`).join(', ')
      const vals = keys.map((k) => {
        const v = args[k]
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
      })
      return asCaller(async (tx) => {
        if (SET_RETURNING.has(fn)) {
          const res = await tx.query(`select * from public.${fn}(${named})`, vals)
          return res.rows.map((r) => numerics(normalize(r))) as T
        }
        const res = await tx.query<{ r: unknown }>(`select public.${fn}(${named}) as r`, vals)
        return normalize(res.rows[0]?.r ?? null) as T
      })
    },
    houses: () => select<House>('select * from public.houses order by id'),
    regions: () => select<Region>('select * from public.regions order by sort_order'),
    games: () => select<Game>('select * from public.games order by sort_order'),
    tournaments: () => select<Tournament>('select * from public.tournaments order by created_at'),
    async uploadArt(file, path) {
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(String(fr.result))
        fr.onerror = () => rej(fr.error)
        fr.readAsDataURL(file)
      })
      try {
        localStorage.setItem(ART_KEY + path, dataUrl)
      } catch {
        throw new ApiError('Dev storage is full', 'UPLOAD')
      }
      return path
    },
    artUrl(path) {
      try {
        return localStorage.getItem(ART_KEY + path) ?? ''
      } catch {
        return ''
      }
    },
  }
}
