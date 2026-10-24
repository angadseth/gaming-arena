// Generates the static topographic texture (web/src/assets/contour.svg).
// Deterministic: wobbly concentric rings around a few peaks, like a park map.
import { writeFileSync } from 'node:fs'

let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const W = 1200, H = 700
const peaks = [[260, 210, 9], [880, 160, 8], [690, 560, 9], [1120, 520, 6], [80, 620, 5]]
const paths = []
for (const [cx, cy, rings] of peaks) {
  const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28]
  for (let k = 1; k <= rings; k++) {
    const r = 18 + k * 26
    const pts = []
    const n = 22
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2
      const wob = 1 + 0.16 * Math.sin(3 * t + ph[0] + k * 0.25) + 0.08 * Math.sin(5 * t + ph[1] - k * 0.18)
        + 0.05 * Math.sin(2 * t + ph[2])
      pts.push([cx + Math.cos(t) * r * wob * 1.25, cy + Math.sin(t) * r * wob * 0.82])
    }
    // closed Catmull-Rom -> cubic Bezier
    let d = `M${pts[0][0].toFixed(0)} ${pts[0][1].toFixed(0)}`
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
      d += `C${c1[0].toFixed(0)} ${c1[1].toFixed(0)} ${c2[0].toFixed(0)} ${c2[1].toFixed(0)} ${p2[0].toFixed(0)} ${p2[1].toFixed(0)}`
    }
    paths.push(`<path d="${d}Z"/>`)
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#ECEFE7" stroke-opacity=".07" stroke-width="1">${paths.join('')}</g></svg>`
writeFileSync(new URL('../web/src/assets/contour.svg', import.meta.url), svg)
console.log('contour.svg', svg.length, 'bytes')
