/**
 * Festive layer: a canvas behind the page that sets off fireworks now and then,
 * plus confetti poppers from the bottom corners (on first visit and on celebrate()).
 * Off under prefers-reduced-motion; paused while the tab is hidden.
 */
const COLOURS = ['#ffc23d', '#ff2e93', '#29e3ff', '#c6ff3d', '#ff7a45', '#b99cff', '#ffffff']

type P = {
  x: number; y: number; vx: number; vy: number; life: number; max: number
  c: string; size: number; kind: 'spark' | 'rocket' | 'confetti'; rot: number; vr: number; target?: number
}

let fire: ((x: number, y: number) => void) | null = null
let pop: (() => void) | null = null

/** Confetti from both corners: call after something worth celebrating. */
export function celebrate() {
  pop?.()
}

export function startFireworks(): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const canvas = document.createElement('canvas')
  canvas.className = 'fx-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.prepend(canvas)
  const ctx = canvas.getContext('2d')!
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  let w = 0
  let h = 0
  const resize = () => {
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)

  const ps: P[] = []
  const rand = (a: number, b: number) => a + Math.random() * (b - a)
  const pick = () => COLOURS[(Math.random() * COLOURS.length) | 0]

  const burst = (x: number, y: number) => {
    const c = pick()
    const n = 46
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const s = rand(1.6, 3.6)
      ps.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rand(55, 80), c: Math.random() < 0.8 ? c : '#fff', size: rand(1.4, 2.4), kind: 'spark', rot: 0, vr: 0 })
    }
  }
  fire = (x, y) => ps.push({ x, y: h + 10, vx: rand(-0.6, 0.6), vy: -rand(7, 9.5), life: 0, max: 200, c: '#fff4c7', size: 2, kind: 'rocket', rot: 0, vr: 0, target: y })
  pop = () => {
    for (const side of [0, 1]) {
      for (let i = 0; i < 70; i++) {
        const a = side ? rand(-2.6, -1.9) : rand(-1.25, -0.55)
        const s = rand(7, 14)
        ps.push({ x: side ? w - 10 : 10, y: h - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rand(110, 160), c: pick(), size: rand(5, 9), kind: 'confetti', rot: rand(0, 6), vr: rand(-0.3, 0.3) })
      }
    }
  }

  let raf = 0
  let next = performance.now() + 1500
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    if (now > next && ps.length < 600) {
      // Launch in the side gutters on wide screens, anywhere on small ones.
      const gutter = Math.max(0, (w - 1180) / 2)
      const x = gutter > 120 ? (Math.random() < 0.5 ? rand(20, gutter - 20) : rand(w - gutter + 20, w - 20)) : rand(w * 0.1, w * 0.9)
      fire!(x, rand(h * 0.12, h * 0.4))
      // Over the content on narrow screens, so keep it rarer there.
      next = now + (gutter > 120 ? rand(1800, 3600) : rand(6000, 10000))
    }
    ctx.clearRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.life++
      if (p.kind === 'rocket') {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.09
        if (p.y <= p.target! || p.vy >= -1) {
          burst(p.x, p.y)
          ps.splice(i, 1)
          continue
        }
        ctx.fillStyle = p.c
        ctx.fillRect(p.x - 1, p.y, 2, 6)
        continue
      }
      if (p.kind === 'spark') {
        p.vx *= 0.97
        p.vy = p.vy * 0.97 + 0.035
      } else {
        p.vx *= 0.985
        p.vy = p.vy * 0.985 + 0.22
        p.rot += p.vr
      }
      p.x += p.vx
      p.y += p.vy
      const fade = 1 - p.life / p.max
      if (fade <= 0 || p.y > h + 40) {
        ps.splice(i, 1)
        continue
      }
      ctx.globalAlpha = Math.max(0, fade)
      ctx.fillStyle = p.c
      if (p.kind === 'confetti') {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      } else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }
  const onVis = () => {
    cancelAnimationFrame(raf)
    if (!document.hidden) raf = requestAnimationFrame(tick)
  }
  document.addEventListener('visibilitychange', onVis)
  raf = requestAnimationFrame(tick)

  // One popper per browser session, as a welcome.
  try {
    if (!sessionStorage.getItem('ga-popped')) {
      sessionStorage.setItem('ga-popped', '1')
      setTimeout(() => pop?.(), 600)
    }
  } catch {
    /* storage blocked: skip the welcome popper */
  }

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVis)
    canvas.remove()
    fire = null
    pop = null
  }
}
