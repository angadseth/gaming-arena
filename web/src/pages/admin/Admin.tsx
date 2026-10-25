import { FileClock, Gamepad2, Inbox, LayoutDashboard, MapPinned, ShieldCheck, Trophy, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../lib/app'
import { Empty } from '../../components/ui'
import Access from './Access'
import Audit from './Audit'
import Events, { EventEditor } from './Events'
import Games, { GameEditor } from './Games'
import Lobby from './Lobby'
import Overview from './Overview'
import Players from './Players'
import Regions from './Regions'
import Registrations from './Registrations'
import Requests from './Requests'
import Results from './Results'

export default function Admin() {
  const { isAdmin } = useAuth()
  const nav = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, show: true },
    { to: '/admin/events', label: 'Events', icon: Trophy, show: true },
    { to: '/admin/games', label: 'Games', icon: Gamepad2, show: isAdmin },
    { to: '/admin/access', label: 'Team & access', icon: ShieldCheck, show: isAdmin },
    { to: '/admin/players', label: 'Players', icon: Users, show: isAdmin },
    { to: '/admin/requests', label: 'Game requests', icon: Inbox, show: isAdmin },
    { to: '/admin/regions', label: 'Regions', icon: MapPinned, show: isAdmin },
    { to: '/admin/audit', label: 'Audit log', icon: FileClock, show: isAdmin },
  ]
  return (
    <div className="page">
      <div className="admin-layout">
        <nav className="admin-nav" aria-label="Admin">
          {nav
            .filter((n) => n.show)
            .map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                <n.icon size={18} strokeWidth={1.75} aria-hidden />
                {n.label}
              </NavLink>
            ))}
        </nav>
        <section className="admin-main stack" style={{ minWidth: 0 }}>
          <Routes>
            <Route index element={<Overview />} />
            <Route path="events" element={<Events />} />
            <Route path="events/new" element={<SuperOnly><EventEditor /></SuperOnly>} />
            <Route path="events/:id" element={<EventEditor />} />
            <Route path="events/:id/registrations" element={<Registrations />} />
            <Route path="events/:id/results" element={<Results />} />
            <Route path="events/:id/lobby" element={<Lobby />} />
            <Route path="games" element={<SuperOnly><Games /></SuperOnly>} />
            <Route path="games/new" element={<SuperOnly><GameEditor /></SuperOnly>} />
            <Route path="games/:id" element={<SuperOnly><GameEditor /></SuperOnly>} />
            <Route path="access" element={<SuperOnly><Access /></SuperOnly>} />
            <Route path="players" element={<SuperOnly><Players /></SuperOnly>} />
            <Route path="requests" element={<SuperOnly><Requests /></SuperOnly>} />
            <Route path="regions" element={<SuperOnly><Regions /></SuperOnly>} />
            <Route path="audit" element={<SuperOnly><Audit /></SuperOnly>} />
            <Route path="*" element={<Empty title="Not found" text="This admin page does not exist." />} />
          </Routes>
        </section>
      </div>
    </div>
  )
}

/** Pages only the Super Admin uses; the database refuses these calls for everyone else anyway. */
function SuperOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  return isAdmin ? <>{children}</> : <Empty title="Super Admin only" text="This part of the console is only for Angad. Ask him if something here needs changing." />
}
