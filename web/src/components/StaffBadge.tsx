import { useStaffBadges } from '../lib/app'

/** Plain "Super Admin" or "Admin" next to a username (no icons, Angad's call); nothing for everyone else. */
export function StaffBadge({ username, compact }: { username: string | null | undefined; compact?: boolean }) {
  const badges = useStaffBadges()
  const role = username ? badges.data?.[username.toLowerCase()] : undefined
  if (!role) return null
  return (
    <span className={`staff-badge${role === 'superadmin' ? ' is-super' : ''}${compact ? ' is-compact' : ''}`}>
      {role === 'superadmin' ? 'Super Admin' : 'Admin'}
    </span>
  )
}
