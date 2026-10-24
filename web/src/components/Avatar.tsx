import { createAvatar, type Style } from '@dicebear/core'
import * as bottts from '@dicebear/bottts'
import * as lorelei from '@dicebear/lorelei'
import * as pixelArt from '@dicebear/pixel-art'
import * as thumbs from '@dicebear/thumbs'
import { useMemo } from 'react'

// Styles are CC0 or free for any use (DiceBear: bottts by Pablo Stanley; pixel-art, lorelei, thumbs CC0).
export type AvatarStyle = 'bottts' | 'pixel-art' | 'lorelei' | 'thumbs'
// Each style has its own option type; we only pass seed and size, which they all share.
const STYLES = { bottts, 'pixel-art': pixelArt, lorelei, thumbs } as unknown as Record<AvatarStyle, Style<object>>
export const AVATAR_STYLES: { key: AvatarStyle; label: string }[] = [
  { key: 'bottts', label: 'Robots' },
  { key: 'pixel-art', label: 'Pixel' },
  { key: 'lorelei', label: 'Faces' },
  { key: 'thumbs', label: 'Blobs' },
]

/** "style:seed" as stored on the profile; falls back to a robot seeded by the username. */
export function avatarKey(avatar: string | null | undefined, username = 'player') {
  return avatar || `bottts:${username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'player'}`
}

const cache = new Map<string, string>()
function uri(key: string) {
  let u = cache.get(key)
  if (!u) {
    const [style, seed] = key.split(':') as [AvatarStyle, string]
    u = createAvatar(STYLES[style] ?? STYLES.bottts, { seed: seed || 'player', size: 96 }).toDataUri()
    cache.set(key, u)
  }
  return u
}

export function Avatar({ value, size = 40, ring }: { value: string; size?: number; ring?: string }) {
  const src = useMemo(() => uri(value), [value])
  return (
    <img
      className="avatar"
      src={src}
      width={size}
      height={size}
      alt=""
      style={ring ? { boxShadow: `0 0 0 2px var(--bg), 0 0 0 4px ${ring}` } : undefined}
    />
  )
}
