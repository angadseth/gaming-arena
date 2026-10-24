import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, type Api } from './api'
import type {
  Game, House, HouseStanding, MatchResultRow, MyEntry, MyProfile, PlayerRank, RankFormat, Region, Session, StandingRow, Tournament, TournamentCount,
} from './types'

// ---------------------------------------------------------------------
// API + session
// ---------------------------------------------------------------------
const ApiCtx = createContext<Api | null>(null)
export const useApi = () => {
  const api = useContext(ApiCtx)
  if (!api) throw new Error('ApiProvider missing')
  return api
}

interface AuthState {
  session: Session | null
  ready: boolean
  profile: MyProfile | null | undefined // undefined = loading, null = not onboarded
  isAdmin: boolean
  isStaff: boolean
  isSuperadmin: boolean
}
const AuthCtx = createContext<AuthState | null>(null)
export const useAuth = () => {
  const a = useContext(AuthCtx)
  if (!a) throw new Error('AuthProvider missing')
  return a
}

export function ApiProvider({ api, children }: { api: Api; children: ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    api.getSession().then((s) => {
      if (!alive) return
      setSession(s)
      setReady(true)
    })
    const off = api.onAuthChange((s) => {
      setSession((prev) => {
        if (prev?.userId !== s?.userId) qc.clear()
        return s
      })
    })
    return () => {
      alive = false
      off()
    }
  }, [api, qc])

  const profileQ = useQuery({
    queryKey: ['me', session?.userId],
    queryFn: () => api.rpc<MyProfile | null>('get_my_profile'),
    enabled: !!session,
    staleTime: 60_000,
  })

  const value = useMemo<AuthState>(() => {
    const profile = session ? (profileQ.isPending ? undefined : (profileQ.data ?? null)) : null
    const roles = profile?.roles ?? []
    const active = profile?.status === 'active'
    return {
      session,
      ready,
      profile,
      isSuperadmin: active && roles.includes('superadmin'),
      isAdmin: active && (roles.includes('superadmin') || roles.includes('admin')),
      isStaff: active && roles.length > 0,
    }
  }, [session, ready, profileQ.isPending, profileQ.data])

  return (
    <ApiCtx.Provider value={api}>
      <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
    </ApiCtx.Provider>
  )
}

// ---------------------------------------------------------------------
// Toasts (one visible at a time, aria-live)
// ---------------------------------------------------------------------
type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  text: string
  action?: { label: string; run: () => void }
}
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((t: Omit<Toast, 'id'>) => {
    window.clearTimeout(timer.current)
    setToast({ ...t, id: Date.now() })
    timer.current = window.setTimeout(() => setToast(null), t.action ? 8000 : 4500)
  }, [])
  const Icon = toast?.kind === 'success' ? CircleCheck : toast?.kind === 'error' ? CircleAlert : Info
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite" role="status">
        {toast && (
          <div key={toast.id} className={`toast ${toast.kind}`}>
            <Icon size={20} strokeWidth={1.75} aria-hidden />
            <span className="grow">{toast.text}</span>
            {toast.action && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  toast.action?.run()
                  setToast(null)
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Dismiss" onClick={() => setToast(null)}>
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------------------------------------------------------------------
// Errors: map server HINT codes to plain words.
// ---------------------------------------------------------------------
const FRIENDLY: Record<string, string> = {
  AUTH_REQUIRED: 'Please sign in first.',
  PROFILE_REQUIRED: 'Finish setting up your profile first.',
  ACCOUNT_BLOCKED: 'Your account is not active. Contact the organisers.',
  FORBIDDEN: 'You do not have permission to do that.',
  RATE_LIMITED: 'Too many tries. Please wait a minute and try again.',
  '42501': 'You do not have permission to do that.',
}
export function errorText(e: unknown): string {
  if (e instanceof ApiError) return FRIENDLY[e.code] && e.code !== 'RATE_LIMITED' ? FRIENDLY[e.code] : e.message
  if (e instanceof Error) return /fetch|network/i.test(e.message) ? 'Network problem. Check your connection.' : e.message
  return 'Something went wrong.'
}
export const errorCode = (e: unknown) => (e instanceof ApiError ? e.code : 'UNKNOWN')

// ---------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------
const LONG = 5 * 60_000
export const useHouses = () => {
  const api = useApi()
  return useQuery({ queryKey: ['houses'], queryFn: () => api.houses(), staleTime: Infinity })
}
export const useRegions = () => {
  const api = useApi()
  return useQuery({ queryKey: ['regions'], queryFn: () => api.regions(), staleTime: LONG })
}
export const useGames = () => {
  const api = useApi()
  return useQuery({ queryKey: ['games'], queryFn: () => api.games(), staleTime: LONG })
}
export const useTournaments = () => {
  const api = useApi()
  return useQuery({ queryKey: ['tournaments'], queryFn: () => api.tournaments(), staleTime: 60_000 })
}
export const useCounts = () => {
  const api = useApi()
  return useQuery({
    queryKey: ['counts'],
    queryFn: async () => {
      const rows = await api.rpc<TournamentCount[]>('tournament_counts')
      return new Map(rows.map((r) => [r.tournament_id, { entries: Number(r.entries), players: Number(r.players) }]))
    },
    staleTime: 60_000,
  })
}
export const useStandings = (tournamentId: string | undefined) => {
  const api = useApi()
  const { session } = useAuth()
  return useQuery({
    queryKey: ['standings', tournamentId, session?.userId],
    queryFn: async () =>
      (await api.rpc<StandingRow[]>('tournament_standings', { p_tournament_id: tournamentId })).map((r) => ({
        ...r,
        rank: r.rank == null ? null : Number(r.rank),
        points: Number(r.points),
        matches: Number(r.matches),
        wins: Number(r.wins),
        kills: Number(r.kills),
      })),
    enabled: !!tournamentId,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}
export const useMatchResults = (tournamentId: string | undefined) => {
  const api = useApi()
  return useQuery({
    queryKey: ['match-results', tournamentId],
    queryFn: () => api.rpc<MatchResultRow[]>('tournament_match_results', { p_tournament_id: tournamentId }),
    enabled: !!tournamentId,
  })
}
export const usePlayerRankings = (format: RankFormat) => {
  const api = useApi()
  const { session } = useAuth()
  return useQuery({
    queryKey: ['player-rankings', format, session?.userId],
    queryFn: async () =>
      (await api.rpc<PlayerRank[]>('player_rankings', { p_format: format, p_season: null })).map((r) => ({
        ...r,
        rank: Number(r.rank),
        points: Number(r.points),
        events: Number(r.events),
        podiums: Number(r.podiums),
        firsts: Number(r.firsts),
      })),
    staleTime: 60_000,
  })
}
export const useHouseStandings = (season: string | null) => {
  const api = useApi()
  return useQuery({
    queryKey: ['house-standings', season],
    queryFn: async () =>
      (await api.rpc<HouseStanding[]>('house_standings', { p_season: season })).map((r) => ({
        rank: Number(r.rank),
        house_id: Number(r.house_id),
        points: Number(r.points),
        podiums: Number(r.podiums),
        players: Number(r.players),
      })),
    staleTime: 60_000,
  })
}
export const useMyEntries = () => {
  const api = useApi()
  const { session, profile } = useAuth()
  return useQuery({
    queryKey: ['my-entries', session?.userId],
    queryFn: () => api.rpc<MyEntry[]>('my_entries'),
    enabled: !!session && !!profile,
  })
}

/** Lookup helpers built from the cached catalog. */
export function useCatalog() {
  const games = useGames()
  const tournaments = useTournaments()
  return useMemo(() => {
    const gameById = new Map<string, Game>((games.data ?? []).map((g) => [g.id, g]))
    const gameBySlug = new Map<string, Game>((games.data ?? []).map((g) => [g.slug, g]))
    const list = (tournaments.data ?? []) as Tournament[]
    return {
      loading: games.isPending || tournaments.isPending,
      error: games.error ?? tournaments.error,
      games: games.data ?? [],
      tournaments: list,
      gameById,
      gameBySlug,
      tournamentBySlug: new Map(list.map((t) => [t.slug, t])),
    }
  }, [games.data, games.isPending, games.error, tournaments.data, tournaments.isPending, tournaments.error])
}

export function useHouseName() {
  const { data } = useHouses()
  return useCallback((id: number | null | undefined) => (data as House[] | undefined)?.find((h) => h.id === id)?.name ?? '', [data])
}
export function useRegionName() {
  const { data } = useRegions()
  return useCallback((id: number | null | undefined) => (data as Region[] | undefined)?.find((r) => r.id === id)?.name ?? '', [data])
}

/** A server action with toast on error and cache invalidation on success. */
export function useAction<A, R>(fn: (api: Api, args: A) => Promise<R>, invalidate: QueryKey[] = [], opts: { silent?: boolean } = {}) {
  const api = useApi()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (args: A) => fn(api, args),
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })),
    onError: (e) => {
      if (!opts.silent) toast({ kind: 'error', text: errorText(e) })
    },
  })
}
