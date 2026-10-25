import { useEffect, useRef, useState, type CSSProperties } from 'react'

const COLOURS = ['#ffc23d', '#ff2e93', '#29e3ff', '#c6ff3d', '#ff7a45', '#b99cff']
const H = 40 // garland height in px
const SPAN = 72 // target width of one scallop

/** Width of an element, kept current with a ResizeObserver (zoom and resize included). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Point on a quadratic curve. */
const q = (t: number, a: number, c: number, b: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b

/**
 * Toran under the top bar: a sagging wire with fairy bulbs hanging from it and marigolds where
 * the scallops meet. Wire, bulbs and flowers are drawn in ONE svg in pixel units from the
 * measured width, so zooming or resizing can never pull them apart (the old CSS version did).
 */
export function TopGarland() {
  const [ref, w] = useWidth<HTMLDivElement>()
  const n = Math.max(4, Math.round(w / SPAN))
  const span = w / n
  const sag = 13
  let d = ''
  const bulbs: { x: number; y: number; c: string; delay: number }[] = []
  for (let i = 0; i < n; i++) {
    const x0 = i * span
    const x1 = x0 + span
    const cx = x0 + span / 2
    const cy = 4 + sag * 2
    d += `${i === 0 ? `M${x0} 4` : ''} Q${cx} ${cy} ${x1} 4`
    for (const t of [0.3, 0.5, 0.7]) {
      const k = bulbs.length
      bulbs.push({ x: q(t, x0, cx, x1), y: q(t, 4, cy, 4), c: COLOURS[k % COLOURS.length], delay: ((k * 37) % 10) * 0.17 })
    }
  }
  return (
    <div ref={ref} className="garland-top" aria-hidden>
      {w > 0 && (
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`}>
          <path d={d} className="g-wire" />
          {bulbs.map((b, i) => (
            <g key={i} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`} className="g-bulb" style={{ '--c': b.c, '--d': `${b.delay}s` } as CSSProperties}>
              <rect x={-1.6} y={0} width={3.2} height={3} rx={0.6} className="g-cap" />
              <ellipse cx={0} cy={7.5} rx={3.4} ry={4.8} className="g-glass" />
              <ellipse cx={-1} cy={6} rx={1} ry={1.6} className="g-shine" />
            </g>
          ))}
          {Array.from({ length: n + 1 }, (_, i) => (
            <g key={`m${i}`} transform={`translate(${(i * span).toFixed(1)} 6)`} className="g-marigold">
              <circle r={6} className="g-petal-o" />
              <circle r={4} className="g-petal-i" />
              <circle r={1.6} className="g-core" />
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}

/** A clay diya with a flickering flame. */
export function Diya({ size = 34, delay = 0 }: { size?: number; delay?: number }) {
  return (
    <svg className="diya" width={size} height={size} viewBox="0 0 40 40" aria-hidden style={{ '--fd': `${delay}s` } as CSSProperties}>
      <defs>
        <radialGradient id="diya-glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#ffd56a" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ff8a1f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="diya-clay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2793a" />
          <stop offset="100%" stopColor="#8f3a17" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="15" r="13" fill="url(#diya-glow)" className="diya-glow" />
      <path className="diya-flame" d="M20 4c3 5 5 8 5 11a5 5 0 0 1-10 0c0-3 2-6 5-11z" fill="#ffc23d" />
      <path className="diya-flame-in" d="M20 10c1.4 2.4 2.4 3.8 2.4 5.2a2.4 2.4 0 0 1-4.8 0c0-1.4 1-2.8 2.4-5.2z" fill="#fff4c7" />
      <path d="M4 22h32c0 7-7 12-16 12S4 29 4 22z" fill="url(#diya-clay)" />
      <path d="M4 22h32" stroke="#ffc23d" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 27h18" stroke="#ffd56a" strokeOpacity=".5" strokeWidth="1.2" strokeDasharray="1.5 3" strokeLinecap="round" />
    </svg>
  )
}

export function DiyaRow({ n = 5, size = 30 }: { n?: number; size?: number }) {
  return (
    <span className="diya-row" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <Diya key={i} size={size} delay={(i * 0.37) % 1.3} />
      ))}
    </span>
  )
}

/** Home page strip that sets the Diwali mood; the crackers always run (no switch). */
export function DiwaliBanner() {
  return (
    <section className="diwali-banner" aria-label="Diwali season">
      <div className="diwali-rangoli" aria-hidden />
      <div className="diwali-copy">
        <span className="tag-type">Diwali season</span>
        <b className="diwali-title">Shubh Deepavali, gamers</b>
        <span className="small t2">Game nights every week. Tap the sky anywhere to burst a cracker.</span>
      </div>
      <DiyaRow />
    </section>
  )
}
