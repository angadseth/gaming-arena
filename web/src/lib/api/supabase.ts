import { createClient, type Session as SbSession } from '@supabase/supabase-js'
import type { Game, House, Region, Session, Tournament } from '../types'
import { ApiError, type Api } from './types'

const ART_BUCKET = 'game-art'

function toSession(s: SbSession | null): Session | null {
  return s?.user ? { userId: s.user.id, email: s.user.email ?? '' } : null
}

function fail(e: { message?: string; hint?: string | null; code?: string } | null): never {
  throw new ApiError(e?.message ?? 'Something went wrong', e?.hint || e?.code || 'UNKNOWN')
}

export function createSupabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  })

  const select = async <T>(table: string, order: string): Promise<T[]> => {
    const { data, error } = await sb.from(table).select('*').order(order)
    if (error) fail(error)
    return data as T[]
  }

  return {
    kind: 'supabase',
    async getSession() {
      const { data } = await sb.auth.getSession()
      return toSession(data.session)
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, s) => cb(toSession(s)))
      return () => data.subscription.unsubscribe()
    },
    onLive(cb) {
      const ch = sb
        .channel('arena')
        .on('broadcast', { event: '*' }, (m) => cb(String(m.event)))
        .subscribe()
      return () => {
        void sb.removeChannel(ch)
      }
    },
    async sendCode(email, captchaToken) {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, captchaToken },
      })
      if (error) {
        // The domain hook answers 403 with our own message.
        const domain = /IIT Madras|not allowed|signups? not allowed/i.test(error.message)
        throw new ApiError(
          domain ? 'Only IIT Madras BS student emails can sign in.' : error.message,
          domain ? 'BAD_DOMAIN' : error.status === 429 ? 'RATE_LIMITED' : 'AUTH',
        )
      }
    },
    async verifyCode(email, code) {
      const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error) throw new ApiError(error.message, error.status === 429 ? 'RATE_LIMITED' : 'BAD_CODE')
    },
    async signOut() {
      await sb.auth.signOut()
    },
    async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
      const { data, error } = await sb.rpc(fn, args)
      if (error) fail(error)
      return data as T
    },
    houses: () => select<House>('houses', 'id'),
    regions: () => select<Region>('regions', 'sort_order'),
    games: () => select<Game>('games', 'sort_order'),
    tournaments: () => select<Tournament>('tournaments', 'created_at'),
    async uploadArt(file, path) {
      const { error } = await sb.storage.from(ART_BUCKET).upload(path, file, {
        cacheControl: '31536000',
        contentType: file.type,
        upsert: false,
      })
      if (error) throw new ApiError(error.message, 'UPLOAD')
      return path
    },
    artUrl(path) {
      return sb.storage.from(ART_BUCKET).getPublicUrl(path).data.publicUrl
    },
  }
}
