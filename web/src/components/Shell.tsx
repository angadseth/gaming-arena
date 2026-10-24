import { CalendarRange, ListOrdered, Shield, Trees, UserRound } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApi, useAuth } from '../lib/app'
import { startFireworks } from '../lib/fireworks'
import { startFx } from '../lib/fx'
import { SideGarlands, TopGarland } from './Festive'
import { SiteFooter } from './SiteFooter'
import { Brand, Spinner } from './ui'

const NAV = [
  { to: '/', label: 'Events', icon: CalendarRange, end: true },
  { to: '/leaderboards', label: 'Leaderboards', icon: ListOrdered },
  { to: '/houses', label: 'Houses', icon: Trees },
]

export function Shell() {
  const api = useApi()
  const { session, profile, isStaff } = useAuth()
  const loc = useLocation()

  useEffect(() => startFx(), [])
  useEffect(() => startFireworks(), [])

  // A signed-in student without a profile finishes onboarding first.
  if (session && profile === null && loc.pathname !== '/welcome') {
    return <Navigate to={`/welcome?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  }

  return (
    <>
      {api.kind === 'pglite' && (
        <div className="dev-banner">LOCAL PREVIEW DATABASE · sign-in code is 12345678 · nothing here is live</div>
      )}
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <nav className="desk-nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} viewTransition>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="top-actions">
            {isStaff && (
              <NavLink to="/admin" className="icon-btn" aria-label="Admin console" title="Admin console">
                <Shield size={20} strokeWidth={1.75} />
              </NavLink>
            )}
            {session ? (
              <NavLink to="/me" className="btn btn-secondary btn-sm">
                <UserRound size={16} strokeWidth={1.75} aria-hidden />
                {profile?.username ?? 'Me'}
              </NavLink>
            ) : (
              <NavLink to={`/signin?next=${encodeURIComponent(loc.pathname)}`} className="btn btn-secondary btn-sm">
                Sign in
              </NavLink>
            )}
          </div>
        </div>
        <TopGarland />
      </header>
      <SideGarlands />
      <main id="main">
        <Outlet />
      </main>
      <SiteFooter />
      <nav className="bottombar" aria-label="Main">
        {[...NAV, { to: '/me', label: 'Me', icon: UserRound, end: false }].map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} viewTransition>
            <n.icon size={20} strokeWidth={1.75} aria-hidden />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready, profile } = useAuth()
  const loc = useLocation()
  if (!ready) return <Spinner />
  if (!session) return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (profile === undefined) return <Spinner />
  return <>{children}</>
}

export function RequireStaff({ children }: { children: ReactNode }) {
  const { isStaff, profile } = useAuth()
  if (profile === undefined) return <Spinner />
  if (!isStaff) return <Navigate to="/" replace />
  return <>{children}</>
}
