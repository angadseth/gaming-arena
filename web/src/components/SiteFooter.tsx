import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const BULBS = 24

/** Closing credit: a marquee of bulbs lights up, then the team's names. */
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
        <p className="footer-team">
          Made by <b>Angad Jangir</b>, <b>Abhimanyu</b> and <b>Sagar Rathore</b>
        </p>
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
