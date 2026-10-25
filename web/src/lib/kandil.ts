// Jaipuri kandil for the Diwali sky (Angad, 25 Oct: "jaipuria art jaisa"). Painted once per
// colourway into a small sprite: rani pink, peacock and saffron bodies, a gold meenakari band
// with a lehariya zigzag, a cusped jharokha window glowing from the diya inside, block-print
// bootis, a chhatri dome with a kalash on top and three phundne (tassels) below.
// Units: 1 = 1 css px at scale 1; the sprite is drawn with its top at the string's hook.

export type Kandil = { body: string; band: string; booti: string; tassel: string }

export const KANDILS: Kandil[] = [
  { body: '#e0457b', band: '#0f8b8d', booti: '#ffd36e', tassel: '#ff7aa8' }, // rani pink + peacock
  { body: '#0f8b8d', band: '#c2185b', booti: '#ffd36e', tassel: '#ffb347' }, // peacock + rani
  { body: '#f08a24', band: '#8e1b3a', booti: '#fff1b8', tassel: '#e0457b' }, // kesariya + maroon
]
export const SPRITE_RES = 3
const GOLD = '#f6c453'

export function kandilSprite(k: Kandil): HTMLCanvasElement {
  const W = 48
  const H = 96
  const c = document.createElement('canvas')
  c.width = W * SPRITE_RES
  c.height = H * SPRITE_RES
  const g = c.getContext('2d')!
  g.scale(SPRITE_RES, SPRITE_RES)
  g.translate(W / 2, 0)
  g.lineJoin = 'round'

  // string + ring
  g.strokeStyle = 'rgba(246, 196, 83, 0.8)'
  g.lineWidth = 0.8
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(0, 6)
  g.stroke()
  g.beginPath()
  g.arc(0, 7.5, 1.6, 0, Math.PI * 2)
  g.stroke()

  // chhatri dome with a kalash finial
  g.fillStyle = GOLD
  g.beginPath()
  g.arc(0, 10.5, 1.3, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  g.moveTo(-13, 22)
  g.bezierCurveTo(-12, 14, -5, 11.5, 0, 11.5)
  g.bezierCurveTo(5, 11.5, 12, 14, 13, 22)
  g.closePath()
  g.fillStyle = k.band
  g.fill()
  g.strokeStyle = GOLD
  g.lineWidth = 1.1
  g.stroke()
  g.fillStyle = k.booti
  for (const dx of [-6, 0, 6]) {
    g.beginPath()
    g.arc(dx, 18, 0.9, 0, Math.PI * 2)
    g.fill()
  }

  // meenakari band with a gold lehariya zigzag
  const band = (y: number, hh: number, half: number) => {
    g.fillStyle = k.band
    g.fillRect(-half, y, half * 2, hh)
    g.strokeStyle = GOLD
    g.lineWidth = 0.9
    g.strokeRect(-half, y, half * 2, hh)
    g.beginPath()
    let up = true
    for (let x = -half + 1; x <= half - 1; x += 2.5) {
      g.lineTo(x, y + (up ? 1.2 : hh - 1.2))
      up = !up
    }
    g.stroke()
  }
  band(22, 5, 14)

  // body, slightly flared
  g.beginPath()
  g.moveTo(-14, 27)
  g.lineTo(14, 27)
  g.lineTo(16, 60)
  g.lineTo(-16, 60)
  g.closePath()
  g.fillStyle = k.body
  g.fill()
  g.strokeStyle = GOLD
  g.lineWidth = 1.2
  g.stroke()

  // jharokha: a cusped (multi-foil) arch window lit by the diya
  g.beginPath()
  g.moveTo(-7, 56)
  g.lineTo(-7, 41)
  g.quadraticCurveTo(-7.5, 37.5, -4.5, 36.5)
  g.quadraticCurveTo(-4, 33, -1, 32.5)
  g.quadraticCurveTo(0, 30, 1, 32.5)
  g.quadraticCurveTo(4, 33, 4.5, 36.5)
  g.quadraticCurveTo(7.5, 37.5, 7, 41)
  g.lineTo(7, 56)
  g.closePath()
  const glow = g.createRadialGradient(0, 49, 0.5, 0, 46, 12)
  glow.addColorStop(0, '#fffbe6')
  glow.addColorStop(0.35, '#ffd36e')
  glow.addColorStop(1, '#ff8a3d')
  g.fillStyle = glow
  g.fill()
  g.strokeStyle = GOLD
  g.lineWidth = 1
  g.stroke()
  // jaali bars and the flame
  g.strokeStyle = 'rgba(142, 27, 58, 0.45)'
  g.lineWidth = 0.5
  for (const dx of [-3.5, 0, 3.5]) {
    g.beginPath()
    g.moveTo(dx, 38)
    g.lineTo(dx, 56)
    g.stroke()
  }
  g.fillStyle = '#fff6d5'
  g.beginPath()
  g.ellipse(0, 50.5, 1.4, 2.6, 0, 0, Math.PI * 2)
  g.fill()

  // block-print bootis: four dots round a white centre
  const booti = (x: number, y: number) => {
    g.fillStyle = k.booti
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2
      g.beginPath()
      g.arc(x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6, 0.85, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#fff'
    g.beginPath()
    g.arc(x, y, 0.7, 0, Math.PI * 2)
    g.fill()
  }
  for (const [x, y] of [[-11, 33], [11, 33], [-11.5, 43], [11.5, 43], [-12, 53], [12, 53]]) booti(x, y)

  // bottom band + gold scallops
  band(60, 5, 16)
  g.fillStyle = GOLD
  for (let x = -14; x <= 14; x += 4) {
    g.beginPath()
    g.arc(x, 65, 2, 0, Math.PI)
    g.fill()
  }

  // phundne: three tassels on beaded strings
  for (const [x, len] of [[-9, 12], [0, 18], [9, 12]]) {
    g.strokeStyle = GOLD
    g.lineWidth = 0.6
    g.beginPath()
    g.moveTo(x, 67)
    g.lineTo(x, 67 + len)
    g.stroke()
    g.fillStyle = GOLD
    g.beginPath()
    g.arc(x, 67 + len * 0.45, 1.2, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = k.tassel
    g.beginPath()
    g.moveTo(x - 0.8, 67 + len)
    g.lineTo(x + 0.8, 67 + len)
    g.lineTo(x + 2.4, 67 + len + 7)
    g.lineTo(x - 2.4, 67 + len + 7)
    g.closePath()
    g.fill()
    g.fillStyle = GOLD
    g.fillRect(x - 1.2, 67 + len - 0.4, 2.4, 1.4)
  }
  return c
}
