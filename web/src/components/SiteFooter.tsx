import { Link } from 'react-router-dom'

const RIBBON = ['GAME NIGHT', 'GAMING ARENA', 'FOR PAN IIT', 'ENTRY FREE']

/** Slim closing strip: a neon ribbon that keeps running, then links and the team's credit. */
export function SiteFooter() {
  // Two identical halves: the track slides by one half and loops without a seam.
  const half = Array.from({ length: 3 }, () => RIBBON).flat()
  return (
    <footer className="site-footer">
      <div className="footer-ribbon" aria-hidden>
        <div className="ribbon-track">
          {[...half, ...half].map((w, i) => (
            <span key={i} className="ribbon-word">
              {w}
              <i className="ribbon-bulb" />
            </span>
          ))}
        </div>
      </div>
      <div className="footer-inner">
        <nav className="footer-links" aria-label="Footer">
          <Link to="/rules">Rulebook</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/request">Request a game</Link>
        </nav>
        <p className="footer-note">For Pan IIT · Entry to every event is free</p>
        <p className="footer-team">
          Made by <b>Angad Jangir</b>, <b>Abhimanyu</b> &amp; <b>Sagar Rathore</b>
        </p>
      </div>
    </footer>
  )
}
