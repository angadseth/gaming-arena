import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Flap } from './ui'

const BULBS = 24

/** Closing credit: a marquee of bulbs lights up, then the maker's name spins in on slot reels. */
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
        {Array.from({ length: BULBS }, (_, i) => (
          <span key={i} className="footer-print" style={{ animationDelay: `${i * 40}ms` }} />
        ))}
      </div>
      <div className="footer-inner">
        <p className="footer-word" aria-hidden>
          <span>GAMING</span>
          <span>ARENA</span>
        </p>
        <div className="footer-credit">
          <span className="footer-made">Website made by</span>
          <a className="footer-name" href="https://github.com/angadseth" target="_blank" rel="noreferrer">
            <Flap value="ANGAD JANGIR" tiles />
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
