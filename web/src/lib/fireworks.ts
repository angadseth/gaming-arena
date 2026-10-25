/**
 * Diwali layer: a canvas BEHIND the page content (cards stay readable) with
 *  - rockets that burst as peony, ring, golden willow or crackle shells,
 *  - anaar (flower pots) and chakri (ground spinners) along the bottom edge,
 *  - a few sky lanterns (kandil) drifting up,
 *  - tap or click on any empty spot to launch a cracker there,
 *  - confetti poppers from the bottom corners on celebrate().
 * Always on in the Diwali season, even with Windows animations off (Angad, 25 Oct: no switch).
 * Paused while the tab is hidden. Sky lanterns are Jaipuri kandils (lib/kandil.ts).
 */
import { KANDILS, kandilSprite, SPRITE_RES } from './kandil'

const COLOURS = ['#ffc23d', '#ff2e93', '#29e3ff', '#c6ff3d', '#ff7a45', '#b99cff', '#ffffff']
const GOLD = ['#ffd56a', '#ffc23d', '#ffb347']

type Kind = 'spark' | 'rocket' | 'confetti' | 'crackle' | 'flash' | 'fountain' | 'spinner'
type Shell = 'peony' | 'ring' | 'willow' | 'crackle'
type P = {
  x: number; y: number; vx: number; vy: number; life: number; max: number
  c: string; size: number; kind: Kind; rot: number; vr: number; target?: number; shell?: Shell; drag?: number; g?: number
}
type Lantern = { x: number; y: number; vx: number; vy: number; s: number; sway: number; ph: number; v: number }

let pop: (() => void) | null = null
/** Crackers always run in the Diwali season (Angad, 25 Oct: no on/off switch). */
export function festiveOn(): boolean {
  return true
}

/** html.fx-on lets the CSS animations (bulbs, diya flames) run even under reduced motion. */
const markRoot = (on: boolean) => document.documentElement.classList.toggle('fx-on', on)


/** Confetti from both corners: call after something worth celebrating. */
export function celebrate() {
  pop?.()
}

const INTERACTIVE = 'a,button,input,textarea,select,label,summary,video,[role="button"],[role="tab"],[role="option"],[contenteditable]'

export function startFireworks(): () => void {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  let w = 0
  let h = 0
  const ps: P[] = []
  const lanterns: Lantern[] = []
  let raf = 0
  let next = 0
  let nextGround = 0

  const rand = (a: number, b: number) => a + Math.random() * (b - a)
  const pick = (list = COLOURS) => list[(Math.random() * list.length) | 0]
  const narrow = () => w < 760

  const resize = () => {
    if (!canvas) return
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const spark = (x: number, y: number, vx: number, vy: number, c: string, max: number, size: number, extra: Partial<P> = {}) =>
    ps.push({ x, y, vx, vy, life: 0, max, c, size, kind: 'spark', rot: 0, vr: 0, ...extra })

  const burst = (x: number, y: number, shell: Shell) => {
    const c = pick()
    const c2 = pick()
    if (shell === 'willow') {
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2
        const s = rand(0.8, 3.2)
        spark(x, y, Math.cos(a) * s, Math.sin(a) * s, pick(GOLD), rand(110, 150), rand(1.1, 1.8), { drag: 0.975, g: 0.045 })
      }
    } else if (shell === 'ring') {
      const n = 40
      const tilt = rand(0.35, 0.8)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        spark(x, y, Math.cos(a) * 3.2, Math.sin(a) * 3.2 * tilt, c, rand(60, 75), 1.8)
      }
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2
        spark(x, y, Math.cos(a) * 1.2, Math.sin(a) * 1.2, '#ffffff', 45, 1.3)
      }
    } else if (shell === 'crackle') {
      for (let i = 0; i < 36; i++) {
        const a = Math.random() * Math.PI * 2
        const s = rand(1.4, 3)
        ps.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rand(38, 55), c: pick(GOLD), size: 1.4, kind: 'crackle', rot: 0, vr: 0 })
      }
    } else {
      const n = 52
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const s = rand(1.8, 3.8)
        spark(x, y, Math.cos(a) * s, Math.sin(a) * s, Math.random() < 0.5 ? c : c2, rand(55, 85), rand(1.4, 2.4))
      }
    }
    ps.push({ x, y, vx: 0, vy: 0, life: 0, max: 10, c: '#fff8e0', size: 26, kind: 'flash', rot: 0, vr: 0 })
  }

  const launch = (x: number, y: number) => {
    const shells: Shell[] = ['peony', 'peony', 'ring', 'willow', 'crackle']
    // Speed so the rocket tops out near y (v^2 = 2 g d), a little extra so it bursts on the way up.
    const v = Math.sqrt(2 * 0.09 * Math.max(60, h + 10 - y)) * 1.04
    const x0 = x + rand(-30, 30)
    ps.push({ x: x0, y: h + 10, vx: (x - x0) / (v / 0.09), vy: -v, life: 0, max: 400, c: '#fff4c7', size: 2, kind: 'rocket', rot: 0, vr: 0, target: y, shell: shells[(Math.random() * shells.length) | 0] })
  }

  /** Anaar (flower pot) or chakri (ground spinner) at the bottom edge. */
  const ground = () => {
    const x = Math.random() < 0.5 ? rand(24, w * 0.22) : rand(w * 0.78, w - 24)
    const kind: Kind = Math.random() < 0.55 ? 'fountain' : 'spinner'
    ps.push({ x, y: h - (narrow() ? 74 : 10), vx: 0, vy: 0, life: 0, max: kind === 'fountain' ? 160 : 190, c: pick(GOLD), size: 0, kind, rot: 0, vr: 0.32 })
  }

  const addLantern = (y = h + rand(20, 200)) =>
    lanterns.push({
      x: rand(w * 0.04, w * 0.96), y, vx: rand(-0.08, 0.08), vy: -rand(0.18, 0.32),
      s: rand(0.62, 0.92) * (narrow() ? 0.8 : 1), sway: rand(6, 14), ph: rand(0, 6), v: Math.floor(rand(0, KANDILS.length)),
    })

  const sprites = KANDILS.map(kandilSprite)
  const drawLantern = (l: Lantern, t: number) => {
    const x = l.x + Math.sin(t / 1400 + l.ph) * l.sway
    const s = l.s
    const flick = 0.85 + Math.sin(t / 130 + l.ph * 3) * 0.08
    // Warm halo first, then the painted kandil, gently rocking on its string.
    const g = ctx.createRadialGradient(x, l.y, 2, x, l.y, 46 * s)
    g.addColorStop(0, `rgba(255, 196, 90, ${0.38 * flick})`)
    g.addColorStop(1, 'rgba(255, 140, 40, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, l.y, 46 * s, 0, Math.PI * 2)
    ctx.fill()
    const sp = sprites[l.v]
    const dw = (sp.width / SPRITE_RES) * s
    const dh = (sp.height / SPRITE_RES) * s
    ctx.save()
    ctx.translate(x, l.y - 48 * s)
    ctx.rotate(Math.sin(t / 1100 + l.ph) * 0.06)
    ctx.globalAlpha = Math.min(1, 0.9 + (flick - 0.85) * 0.8)
    ctx.drawImage(sp, -dw / 2, 0, dw, dh)
    ctx.restore()
    ctx.globalAlpha = 1
  }

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    if (now > next && ps.length < 700) {
      launch(rand(w * 0.08, w * 0.92), rand(h * 0.1, h * 0.38))
      next = now + (narrow() ? rand(2600, 5200) : rand(1300, 2800))
    }
    if (now > nextGround) {
      ground()
      nextGround = now + rand(9000, 16000)
    }
    ctx.clearRect(0, 0, w, h)

    ctx.globalCompositeOperation = 'source-over'
    for (let i = lanterns.length - 1; i >= 0; i--) {
      const l = lanterns[i]
      l.x += l.vx
      l.y += l.vy
      if (l.y < -60) {
        lanterns.splice(i, 1)
        addLantern()
        continue
      }
      drawLantern(l, now)
    }

    ctx.globalCompositeOperation = 'lighter'
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.life++
      if (p.kind === 'rocket') {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.09
        if (p.y <= p.target! || p.vy >= -0.6) {
          burst(p.x, p.y, p.shell ?? 'peony')
          ps.splice(i, 1)
          continue
        }
        if (p.life % 2 === 0) spark(p.x, p.y + 4, rand(-0.3, 0.3), rand(0.4, 1.2), pick(GOLD), 22, 1.1)
        ctx.globalAlpha = 1
        ctx.fillStyle = p.c
        ctx.fillRect(p.x - 1, p.y, 2, 6)
        continue
      }
      if (p.kind === 'fountain' || p.kind === 'spinner') {
        if (p.life > p.max) {
          ps.splice(i, 1)
          continue
        }
        if (p.kind === 'fountain') {
          for (let k = 0; k < 4; k++) spark(p.x, p.y, rand(-1.4, 1.4), -rand(4.2, 7.4), pick(GOLD), rand(40, 70), rand(1, 1.8), { g: 0.12 })
        } else {
          p.rot += p.vr
          for (let k = 0; k < 3; k++) {
            const a = p.rot + (k * Math.PI * 2) / 3
            spark(p.x + Math.cos(a) * 6, p.y - 8 + Math.sin(a) * 6, -Math.sin(a) * 3.4, Math.cos(a) * 3.4, k ? pick(GOLD) : '#ff5a3d', rand(26, 40), 1.4, { g: 0.06 })
          }
          ctx.globalAlpha = 1
          ctx.fillStyle = '#fff4c7'
          ctx.beginPath()
          ctx.arc(p.x, p.y - 8, 3, 0, Math.PI * 2)
          ctx.fill()
        }
        continue
      }
      if (p.kind === 'flash') {
        const f = 1 - p.life / p.max
        if (f <= 0) {
          ps.splice(i, 1)
          continue
        }
        ctx.globalAlpha = f * 0.5
        ctx.fillStyle = p.c
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1.4 - f * 0.4), 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      if (p.kind === 'confetti') {
        p.vx *= 0.985
        p.vy = p.vy * 0.985 + 0.22
        p.rot += p.vr
      } else {
        const drag = p.drag ?? 0.97
        p.vx *= drag
        p.vy = p.vy * drag + (p.g ?? 0.035)
      }
      p.x += p.vx
      p.y += p.vy
      const fade = 1 - p.life / p.max
      if (fade <= 0 || p.y > h + 40) {
        // A crackle star ends in a tiny white pop.
        if (p.kind === 'crackle' && fade <= 0) {
          for (let k = 0; k < 4; k++) spark(p.x, p.y, rand(-1, 1), rand(-1, 1), '#ffffff', 12, 1)
        }
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
    if (!document.hidden && canvas) raf = requestAnimationFrame(tick)
  }
  // Tap or click on empty space: a cracker bursts where you tapped. Links and buttons work as usual.
  const onClick = (e: MouseEvent) => {
    if (!canvas || e.button !== 0) return
    const t = e.target as Element | null
    if (t?.closest?.(INTERACTIVE)) return
    if (window.getSelection()?.toString()) return
    launch(e.clientX, Math.min(e.clientY, h * 0.8))
  }

  const begin = () => {
    if (canvas) return
    canvas = document.createElement('canvas')
    canvas.className = 'fx-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    document.body.prepend(canvas)
    ctx = canvas.getContext('2d')!
    resize()
    lanterns.length = 0
    for (let i = 0; i < (w < 760 ? 3 : 6); i++) addLantern(rand(h * 0.2, h))
    next = performance.now() + 900
    nextGround = performance.now() + 3500
    pop = () => {
      for (const side of [0, 1]) {
        for (let i = 0; i < 70; i++) {
          const a = side ? rand(-2.6, -1.9) : rand(-1.25, -0.55)
          const s = rand(7, 14)
          ps.push({ x: side ? w - 10 : 10, y: h - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rand(110, 160), c: pick(), size: rand(5, 9), kind: 'confetti', rot: rand(0, 6), vr: rand(-0.3, 0.3) })
        }
      }
    }
    raf = requestAnimationFrame(tick)
  }
  const end = () => {
    cancelAnimationFrame(raf)
    canvas?.remove()
    canvas = null
    ps.length = 0
    pop = null
  }

  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', onVis)
  document.addEventListener('click', onClick)
  markRoot(festiveOn())
  if (festiveOn()) begin()

  // One popper per browser session, as a welcome.
  try {
    if (festiveOn() && !sessionStorage.getItem('ga-popped')) {
      sessionStorage.setItem('ga-popped', '1')
      setTimeout(() => pop?.(), 600)
    }
  } catch {
    /* storage blocked: skip the welcome popper */
  }

  return () => {
    end()
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVis)
    document.removeEventListener('click', onClick)
  }
}

