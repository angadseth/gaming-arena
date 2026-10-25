import * as adventurer from '@dicebear/adventurer'
import * as avataaars from '@dicebear/avataaars'
import { createAvatar, type Style } from '@dicebear/core'
import * as bottts from '@dicebear/bottts'
import * as lorelei from '@dicebear/lorelei'
import * as pixelArt from '@dicebear/pixel-art'
import * as thumbs from '@dicebear/thumbs'
import { useMemo } from 'react'

// Licences: bottts (Pablo Stanley, free for any use), pixel-art, lorelei, thumbs (CC0),
// adventurer (Lisa Wischofsky, CC BY 4.0: credited under the picker), avataaars (Pablo Stanley,
// free for personal and commercial use). All drawn locally by DiceBear; nothing is fetched.
export type AvatarStyle = 'pookie' | 'queen' | 'boy' | 'dude' | 'bottts' | 'pixel-art' | 'lorelei' | 'thumbs'

const LONG_HAIR = Array.from({ length: 26 }, (_, i) => `long${String(i + 1).padStart(2, '0')}`)
const SHORT_HAIR = Array.from({ length: 19 }, (_, i) => `short${String(i + 1).padStart(2, '0')}`)
const PASTEL_PINK = ['ffd5e5', 'ffe4f1', 'f5d0fe', 'fde2e4', 'e9d5ff']
const COOL_BG = ['bfdbfe', 'a5f3fc', 'c7d2fe', 'bbf7d0', 'fde68a']

// Each style has its own option type; these are the options each look passes on top of the seed.
const STYLES: Record<AvatarStyle, { style: Style<object>; opts?: Record<string, unknown> }> = {
  // Girls: cute, blushing, long hair, earrings, pastel backgrounds ("pookie", Angad 25 Oct).
  pookie: {
    style: adventurer as unknown as Style<object>,
    opts: {
      hair: LONG_HAIR, features: ['blush'], featuresProbability: 100, earringsProbability: 75,
      glassesProbability: 10, backgroundColor: PASTEL_PINK, hairColor: ['0e0e0e', '562306', '6a4e35', '592454', 'dba3be', 'ab2a18'],
    },
  },
  queen: {
    style: avataaars as unknown as Style<object>,
    opts: {
      top: ['bob', 'bun', 'curly', 'curvy', 'frida', 'longButNotTooLong', 'miaWallace', 'straight01', 'straight02', 'straightAndStrand', 'bigHair', 'hijab'],
      facialHairProbability: 0, accessoriesProbability: 15, accessories: ['round', 'prescription02', 'sunglasses'],
      mouth: ['smile', 'twinkle', 'default', 'tongue'], eyes: ['happy', 'hearts', 'wink', 'default', 'squint'],
      eyebrows: ['defaultNatural', 'raisedExcitedNatural', 'default'], clothing: ['hoodie', 'shirtScoopNeck', 'shirtVNeck', 'overall', 'collarAndSweater'],
      clothesColor: ['ff488e', 'ff5c5c', 'ffafb9', 'b1e2ff', 'a7ffc4', 'ffdeb5'], backgroundColor: PASTEL_PINK,
    },
  },
  // Boys: short hair, sometimes glasses or a beard, cool backgrounds.
  boy: {
    style: adventurer as unknown as Style<object>,
    opts: {
      hair: SHORT_HAIR, earringsProbability: 0, features: ['freckles', 'birthmark'], featuresProbability: 15,
      glassesProbability: 25, backgroundColor: COOL_BG, hairColor: ['0e0e0e', '562306', '6a4e35', '796a45', 'ac6511'],
    },
  },
  dude: {
    style: avataaars as unknown as Style<object>,
    opts: {
      top: ['dreads01', 'dreads02', 'frizzle', 'shaggy', 'shaggyMullet', 'shortCurly', 'shortFlat', 'shortRound', 'shortWaved', 'sides', 'theCaesar', 'theCaesarAndSidePart', 'turban', 'winterHat1'],
      facialHairProbability: 40, accessoriesProbability: 30, accessories: ['sunglasses', 'wayfarers', 'round', 'prescription01'],
      mouth: ['smile', 'default', 'twinkle', 'tongue', 'serious'], eyes: ['default', 'happy', 'wink', 'side', 'squint'],
      eyebrows: ['defaultNatural', 'raisedExcitedNatural', 'upDownNatural', 'default'],
      clothing: ['hoodie', 'graphicShirt', 'blazerAndShirt', 'shirtCrewNeck', 'collarAndSweater'], backgroundColor: COOL_BG,
    },
  },
  bottts: { style: bottts as unknown as Style<object> },
  'pixel-art': { style: pixelArt as unknown as Style<object> },
  lorelei: { style: lorelei as unknown as Style<object> },
  thumbs: { style: thumbs as unknown as Style<object> },
}

/** The picker's sections. Keys must match public.set_my_avatar (migration 0020). */
export const AVATAR_GROUPS: { title: string; styles: { key: AvatarStyle; label: string }[] }[] = [
  { title: 'Girls', styles: [{ key: 'pookie', label: 'Pookie' }, { key: 'queen', label: 'Queen' }] },
  { title: 'Boys', styles: [{ key: 'boy', label: 'Cool' }, { key: 'dude', label: 'Dude' }] },
  {
    title: 'Fun',
    styles: [
      { key: 'bottts', label: 'Robots' },
      { key: 'pixel-art', label: 'Pixel' },
      { key: 'lorelei', label: 'Faces' },
      { key: 'thumbs', label: 'Blobs' },
    ],
  },
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
    const s = STYLES[style] ?? STYLES.bottts
    u = createAvatar(s.style, { seed: seed || 'player', size: 96, ...s.opts }).toDataUri()
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
