/**
 * Pointer effects for the whole app, wired once from the Shell with event delegation:
 * - .holo cards tilt and catch light under the pointer (also follows a finger on touch),
 * - .btn-primary leans up to 6 px towards a mouse pointer,
 * - a mouse pointer leaves a short trail of fading pugmarks.
 * Nothing runs under prefers-reduced-motion; magnetism and the trail need a fine pointer.
 */
const PAW =
  '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="5.2" cy="9.2" rx="1.9" ry="2.6" transform="rotate(-20 5.2 9.2)"/><ellipse cx="9.5" cy="5.2" rx="2" ry="2.8" transform="rotate(-6 9.5 5.2)"/><ellipse cx="14.5" cy="5.2" rx="2" ry="2.8" transform="rotate(6 14.5 5.2)"/><ellipse cx="18.8" cy="9.2" rx="1.9" ry="2.6" transform="rotate(20 18.8 9.2)"/><path d="M12 11.2c-3.7 0-6.7 2.9-6.7 6.3 0 2.5 1.8 4.3 3.9 4.3 1.1 0 1.8-.6 2.8-.6s1.7.6 2.8.6c2.1 0 3.9-1.8 3.9-4.3 0-3.4-3-6.3-6.7-6.3z"/></svg>'

const STEP = 64 // px of pointer travel between prints
const MAX_PRINTS = 10
const MAX_PULL = 6

export function startFx(): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches

  let card: HTMLElement | null = null
  let btn: HTMLElement | null = null
  let frame = 0
  let last: PointerEvent | null = null

  const layer = document.createElement('div')
  layer.className = 'paw-layer'
  layer.setAttribute('aria-hidden', 'true')
  if (fine) document.body.appendChild(layer)
  let trailX = -1
  let trailY = -1
  let side = 1

  const releaseCard = () => {
    if (!card) return
    card.classList.remove('is-active')
    card.style.setProperty('--rx', '0deg')
    card.style.setProperty('--ry', '0deg')
    card.style.setProperty('--hover', '0')
    card = null
  }
  const releaseBtn = () => {
    if (!btn) return
    btn.style.setProperty('--mx', '0px')
    btn.style.setProperty('--my', '0px')
    btn = null
  }

  const dropPrint = (x: number, y: number) => {
    if (trailX < 0) {
      trailX = x
      trailY = y
      return
    }
    const dx = x - trailX
    const dy = y - trailY
    const dist = Math.hypot(dx, dy)
    if (dist < STEP) return
    const angle = Math.atan2(dy, dx)
    // Prints sit either side of the path, like a walking cat.
    side = -side
    const ox = Math.cos(angle + Math.PI / 2) * 9 * side
    const oy = Math.sin(angle + Math.PI / 2) * 9 * side
    const p = document.createElement('span')
    p.className = 'paw'
    p.innerHTML = PAW
    p.style.transform = `translate(${x + ox - 9}px, ${y + oy - 9}px) rotate(${angle + Math.PI / 2}rad)`
    layer.appendChild(p)
    while (layer.childElementCount > MAX_PRINTS) layer.firstElementChild?.remove()
    p.addEventListener('animationend', () => p.remove())
    trailX = x
    trailY = y
  }

  const tick = () => {
    frame = 0
    const e = last
    if (!e) return
    const target = e.target instanceof Element ? e.target : null

    const nextCard = target?.closest<HTMLElement>('.holo') ?? null
    if (nextCard !== card) releaseCard()
    if (nextCard) {
      card = nextCard
      const r = card.getBoundingClientRect()
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
      // Big cards tilt less so the text stays readable.
      const max = r.width > 520 ? 4 : 11
      card.classList.add('is-active')
      card.style.setProperty('--px', `${(px * 100).toFixed(1)}%`)
      card.style.setProperty('--py', `${(py * 100).toFixed(1)}%`)
      card.style.setProperty('--rx', `${((0.5 - py) * max).toFixed(2)}deg`)
      card.style.setProperty('--ry', `${((px - 0.5) * max).toFixed(2)}deg`)
      card.style.setProperty('--hover', '1')
    }

    if (e.pointerType !== 'mouse' || !fine) return
    const nextBtn = target?.closest<HTMLElement>('.btn-primary:not(:disabled)') ?? null
    if (nextBtn !== btn) releaseBtn()
    if (nextBtn) {
      btn = nextBtn
      const r = btn.getBoundingClientRect()
      const mx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * MAX_PULL
      const my = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * (MAX_PULL / 2)
      btn.style.setProperty('--mx', `${mx.toFixed(1)}px`)
      btn.style.setProperty('--my', `${my.toFixed(1)}px`)
    }
    dropPrint(e.clientX, e.clientY)
  }

  const onMove = (e: PointerEvent) => {
    last = e
    if (!frame) frame = requestAnimationFrame(tick)
  }
  const onLeave = () => {
    releaseCard()
    releaseBtn()
    trailX = -1
  }

  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerdown', onMove, { passive: true })
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') releaseCard()
  }
  document.addEventListener('pointerup', onUp, { passive: true })
  document.addEventListener('pointercancel', onLeave, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)

  return () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerdown', onMove)
    document.removeEventListener('pointerup', onUp)
    document.removeEventListener('pointercancel', onLeave)
    document.documentElement.removeEventListener('pointerleave', onLeave)
    if (frame) cancelAnimationFrame(frame)
    layer.remove()
  }
}
