import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider, ScrollRestoration, Outlet } from 'react-router-dom'
import { RequireAuth, RequireStaff, Shell } from './components/Shell'
import { Spinner } from './components/ui'
import { getApi, type Api } from './lib/api'
import { ApiProvider, ToastProvider } from './lib/app'
import EventPage from './pages/EventPage'
import Events from './pages/Events'
import Houses from './pages/Houses'
import JoinTeam from './pages/JoinTeam'
import Leaderboards from './pages/Leaderboards'
import Me from './pages/Me'
import Inbox from './pages/Inbox'
import NotFound from './pages/NotFound'
import Onboarding from './pages/Onboarding'
import Register from './pages/Register'
import RequestGame from './pages/RequestGame'
import { Privacy, Rulebook } from './pages/Static'
import SignIn from './pages/SignIn'
import './styles.css'

// The admin console is a separate chunk: players never download it.
const Admin = lazy(() => import('./pages/admin/Admin'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
  },
})

function Root() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  )
}

const router = createHashRouter([
  {
    element: <Root />,
    children: [
      { path: '/signin', element: <SignIn /> },
      {
        element: <Shell />,
        children: [
          { path: '/', element: <Events /> },
          { path: '/e/:slug', element: <EventPage /> },
          { path: '/e/:slug/register', element: <RequireAuth><Register /></RequireAuth> },
          { path: '/join/:code?', element: <RequireAuth><JoinTeam /></RequireAuth> },
          { path: '/leaderboards', element: <Leaderboards /> },
          { path: '/houses', element: <Houses /> },
          { path: '/me', element: <RequireAuth><Me /></RequireAuth> },
          { path: '/inbox', element: <RequireAuth><Inbox /></RequireAuth> },
          { path: '/welcome', element: <RequireAuth><Onboarding /></RequireAuth> },
          { path: '/request', element: <RequireAuth><RequestGame /></RequireAuth> },
          { path: '/rules', element: <Rulebook /> },
          { path: '/privacy', element: <Privacy /> },
          {
            path: '/admin/*',
            element: (
              <RequireAuth>
                <RequireStaff>
                  <Suspense fallback={<Spinner />}>
                    <Admin />
                  </Suspense>
                </RequireStaff>
              </RequireAuth>
            ),
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])

function App() {
  const [api, setApi] = useState<Api | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    getApi().then(setApi, (e: Error) => setError(e.message))
  }, [])
  if (error) {
    return (
      <div className="page">
        <p className="t2">{error}</p>
      </div>
    )
  }
  if (!api) return <Spinner />
  return (
    <ApiProvider api={api}>
      <RouterProvider router={router} />
    </ApiProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
