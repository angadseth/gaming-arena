import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Flap, PugmarkGlyph } from './ui'

const PRINTS = 11

/** Closing credit: a pugmark trail walks across, then the maker's name flips in like a scoreboard. */
export function SiteFooter() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        el.classList.add('is-in')
        io.disconnect()
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <footer ref={ref} className="site-footer">
      <div className="footer-trail" aria-hidden>
        {Array.from({ length: PRINTS }, (_, i) => (
          <span key={i} className="footer-print" style={{ animationDelay: `${i * 90}ms` }}>
            <PugmarkGlyph size={18} />
          </span>
        ))}
      </div>
      <div className="footer-inner">
        <p className="footer-word" aria-hidden>PUGMARK</p>
        <div className="footer-credit">
          <span className="footer-made">Website made by</span>
          <a className="footer-name" href="https://github.com/angadseth" target="_blank" rel="noreferrer">
            <Flap value="ANGAD SETH" tiles />
          </a>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/rules">Rulebook</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/request">Request a game</Link>
        </nav>
        <p className="footer-note">Built for the students of the IIT Madras BS degree. Entry to every event is free.</p>
      </div>
    </footer>
  )
}
