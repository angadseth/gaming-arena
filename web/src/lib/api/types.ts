import type { Game, House, Region, Session, Tournament } from '../types'

/** Everything the UI needs from a backend. Two implementations:
 *  supabase (production) and pglite (local dev, real migrations in-browser). */
export interface Api {
  kind: 'supabase' | 'pglite'
  getSession(): Promise<Session | null>
  onAuthChange(cb: (s: Session | null) => void): () => void
  sendCode(email: string, captchaToken?: string): Promise<void>
  verifyCode(email: string, code: string): Promise<void>
  signOut(): Promise<void>
  /** Calls a Postgres function. Set-returning functions resolve to rows. */
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T>
  houses(): Promise<House[]>
  regions(): Promise<Region[]>
  games(): Promise<Game[]>
  tournaments(): Promise<Tournament[]>
  /** Uploads game art; returns the stored path for games.cover_path. */
  uploadArt(file: Blob, path: string): Promise<string>
  artUrl(path: string): string
}

export class ApiError extends Error {
  code: string
  constructor(message: string, code = 'UNKNOWN') {
    super(message)
    this.code = code
  }
}

/** Functions that return rows (table functions) rather than one value. */
export const SET_RETURNING = new Set([
  'tournament_standings',
  'house_standings',
  'tournament_counts',
  'tournament_match_results',
  'player_rankings',
])

/** Digits in the emailed code; must match Supabase Auth > Email > OTP length. */
export const OTP_LENGTH = 8
