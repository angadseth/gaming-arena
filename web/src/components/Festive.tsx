import type { CSSProperties } from 'react'

const COLOURS = ['#ffc23d', '#ff2e93', '#29e3ff', '#c6ff3d', '#ff7a45', '#b99cff']

function Bulbs({ n, offset = 0 }: { n: number; offset?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="bulb"
          style={{ '--c': COLOURS[(i + offset) % COLOURS.length], '--d': `${((i * 37) % 10) * 0.17}s` } as CSSProperties}
        />
      ))}
    </>
  )
}

/** Fairy lights: a garland under the top bar and, on wide screens, strings down both sides. */
export function TopGarland() {
  return (
    <div className="garland-top" aria-hidden>
      <Bulbs n={44} />
    </div>
  )
}

export function SideGarlands() {
  return (
    <>
      <div className="garland-side garland-l" aria-hidden><Bulbs n={18} /></div>
      <div className="garland-side garland-r" aria-hidden><Bulbs n={18} offset={3} /></div>
    </>
  )
}
