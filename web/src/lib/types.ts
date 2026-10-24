export type TournamentStatus = 'draft' | 'upcoming' | 'open' | 'closed' | 'live' | 'completed' | 'cancelled'
export type GameMode = 'solo' | 'duo' | 'squad' | 'team'
export type Role = 'superadmin' | 'admin' | 'organizer'

export interface ExtraField {
  key: string
  label: string
  pattern?: string
  hint?: string
  required?: boolean
}

export interface House {
  id: number
  slug: string
  name: string
  color: string
}

export interface Region {
  id: number
  name: string
  sort_order: number
  is_active: boolean
}

export interface Game {
  id: string
  slug: string
  title: string
  short: string
  description: string
  platforms: string[]
  mode: GameMode
  team_size: number
  max_subs: number
  ig_id_label: string
  ig_id_pattern: string
  ig_id_hint: string
  extra_fields: ExtraField[]
  rules: string[]
  scoring: string
  placement_points: Record<string, number>
  kill_points: number
  match_minutes: number | null
  verify_note: string
  cover_path: string | null
  accent: string | null
  is_active: boolean
  sort_order: number
  /** Public "get the game" links. */
  play_links: PlayLink[]
  /** How to enter a custom room, one short step each. */
  join_steps: string[]
}

export type PlayKind = 'web' | 'android' | 'ios' | 'pc' | 'mac' | 'console'
export interface PlayLink {
  kind: PlayKind
  label: string
  url: string
}

export type NoticeKind = 'info' | 'room' | 'live' | 'reminder' | 'result'
export interface Notice {
  id: string
  kind: NoticeKind
  title: string
  body: string
  created_at: string
}

/** event_lobby(): outsiders get registered=false; players see details after agreeing to the lobby rules. */
export interface Lobby {
  registered: boolean
  agreed?: boolean
  has_room?: boolean
  checkin_open?: boolean
  /** Room code and password come back only after the player checks in. */
  checked_in?: boolean
  checked_in_at?: string | null
  my_ig_id?: string
  meet_url?: string | null
  chat_url?: string | null
  room_code?: string | null
  room_password?: string | null
  note?: string
  updated_at?: string | null
  notices?: Notice[]
}

export interface RosterRow {
  username: string
  full_name: string
  house_id: number
  entry: string
  entry_status: string
  role: string
  ig_id: string
  checked_in_at: string | null
  ig_changes: number
}

export interface AdminLobby extends Lobby {
  event_meet_url: string | null
  default_meet_url: string | null
  recipients: number
  agreed_count: number
  checked_in_count: number
  emails: string[]
  roster: RosterRow[]
}

export interface InboxItem extends Notice {
  event_slug: string
  event_title: string
  unread: boolean
}
export interface Inbox {
  unread: number
  items: InboxItem[]
}

export interface Tournament {
  id: string
  game_id: string
  slug: string
  title: string
  season: string
  summary: string
  status: TournamentStatus
  reg_opens_at: string | null
  reg_closes_at: string | null
  starts_at: string | null
  max_entries: number | null
  same_house_teams: boolean
  placement_points: Record<string, number>
  kill_points: number
  house_points: Record<string, number>
  contact_note: string
  created_at: string
}

export interface MyProfile {
  id: string
  email: string
  username: string
  full_name: string
  house_id: number
  region_id: number
  whatsapp: string
  status: 'active' | 'suspended' | 'banned'
  created_at: string
  /** Picked avatar "style:seed"; null = default robot from the username. */
  avatar: string | null
  /** When the next username change is allowed; null = allowed now. */
  username_next_change: string | null
  roles: Role[]
}

export interface StandingRow {
  rank: number | null
  entry_id: string
  name: string
  house_id: number | null
  members: { username: string; role: string }[] | null
  points: number
  matches: number
  wins: number
  kills: number
  best_placement: number | null
  status: 'active' | 'disqualified'
  is_mine: boolean
  avatar: string
}

export type RankFormat = 'all' | 'solo' | 'small' | 'squad'
export interface PlayerRank {
  rank: number
  username: string
  avatar: string
  house_id: number
  points: number
  events: number
  podiums: number
  firsts: number
  is_me: boolean
}

export interface HouseStanding {
  rank: number
  house_id: number
  points: number
  podiums: number
  players: number
}

export interface TournamentCount {
  tournament_id: string
  entries: number
  players: number
}

export interface MyEntry {
  entry_id: string
  name: string
  status: string
  is_captain: boolean
  invite_code: string | null
  my_ig_id: string
  my_role: string
  tournament: { id: string; slug: string; title: string; status: TournamentStatus; starts_at: string | null; reg_open: boolean }
  game: { slug: string; title: string; team_size: number; max_subs: number; cover_path: string | null }
  members: { username: string; role: string; house_id: number }[]
}

export interface TeamPreview {
  entry_id: string
  team_name: string
  tournament_id: string
  tournament_title: string
  tournament_slug: string
  game_title: string
  house_id: number | null
  team_size: number
  max_subs: number
  members: number
  open: boolean
}

export interface MatchResultRow {
  match_id: string
  label: string
  played_at: string
  entry_id: string
  placement: number | null
  kills: number
  points: number
}

export interface Session {
  userId: string
  email: string
}

export interface PlayerCardData {
  username: string
  house_id: number
  avatar: string
  xp: number
  level: string
  level_floor: number
  next_level_at: number | null
  events: number
  checkins: number
  games: number
  badges: { key: string; count: number; have: boolean }[]
}
