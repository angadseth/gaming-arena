import { Crown, Star } from 'lucide-react'
import { useStaffBadges } from '../lib/app'

/** "Super Admin" or "Admin ★" next to a username; nothing for everyone else. */
export function StaffBadge({ username, compact }: { username: string | null | undefined; compact?: boolean }) {
  const badges = useStaffBadges()
  const role = username ? badges.data?.[username.toLowerCase()] : undefined
  if (!role) return null
  if (compact)
    return (
      <span className={`staff-badge is-icon${role === 'superadmin' ? ' is-super' : ''}`} title={role === 'superadmin' ? 'Super Admin' : 'Admin'}>
        {role === 'superadmin' ? <Crown size={11} strokeWidth={2.4} aria-hidden /> : <Star size={11} strokeWidth={2.4} fill="currentColor" aria-hidden />}
        <span className="sr-only">{role === 'superadmin' ? 'Super Admin' : 'Admin'}</span>
      </span>
    )
  return role === 'superadmin' ? (
    <span className="staff-badge is-super" title="Super Admin">
      <Crown size={11} strokeWidth={2.4} aria-hidden />
      Super Admin
    </span>
  ) : (
    <span className="staff-badge" title="Admin">
      <Star size={11} strokeWidth={2.4} fill="currentColor" aria-hidden />
      Admin
    </span>
  )
}
