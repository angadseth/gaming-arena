import { FileClock, Gamepad2, Inbox, LayoutDashboard, MapPinned, Trophy, Users } from 'lucide-react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../lib/app'
import { Empty } from '../../components/ui'
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
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, show: true },
    { to: '/admin/events', label: 'Events', icon: Trophy, show: true },
    { to: '/admin/games', label: 'Games', icon: Gamepad2, show: isAdmin },
    { to: '/admin/players', label: 'Players', icon: Users, show: isAdmin },
    { to: '/admin/requests', label: 'Game requests', icon: Inbox, show: true },
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
            <Route path="events/new" element={<EventEditor />} />
            <Route path="events/:id" element={<EventEditor />} />
            <Route path="events/:id/registrations" element={<Registrations />} />
            <Route path="events/:id/results" element={<Results />} />
            <Route path="events/:id/lobby" element={<Lobby />} />
            <Route path="games" element={<Games />} />
            <Route path="games/new" element={<GameEditor />} />
            <Route path="games/:id" element={<GameEditor />} />
            <Route path="players" element={<Players />} />
            <Route path="requests" element={<Requests />} />
            <Route path="regions" element={<Regions />} />
            <Route path="audit" element={<Audit />} />
            <Route path="*" element={<Empty title="Not found" text="This admin page does not exist." />} />
          </Routes>
        </section>
      </div>
    </div>
  )
}
