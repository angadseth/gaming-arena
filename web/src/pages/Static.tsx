import { Link } from 'react-router-dom'

export function Rulebook() {
  return (
    <div className="page stack" style={{ gap: 8 }}>
      <header className="page-header contour stack" style={{ gap: 8, marginBottom: 12 }}>
        <p className="tag-type t3">Applies to every event</p>
        <h1 className="display">Rulebook</h1>
        <p className="lead" style={{ maxWidth: 620 }}>Short version: be a real IITM BS student, play on your own account, play fair, respect people.</p>
      </header>
      <article className="prose">
        <h2>1. Eligibility</h2>
        <ol>
          <li>Open only to current IIT Madras BS students. You sign in with your verified student email (@ds, @es or @mg.study.iitm.ac.in).</li>
          <li>One account per person. Duplicate accounts get every one of them banned.</li>
          <li>Your house is set once; organisers can correct your house or region if they are wrong. You can change your username once every 30 days, and your full name and WhatsApp number from your profile.</li>
          <li>Usernames must be respectful. If we find a username offensive in any way, that account is banned from every event for the rest of the player's time in the programme. Renaming it afterwards does not undo the ban: every change is logged.</li>
          <li>One registration per person per event: you cannot be on two teams in the same event, even as a sub.</li>
          <li>An in-game ID can be registered by only one person per event, and it must be your own account.</li>
        </ol>

        <h2>2. Teams</h2>
        <ul>
          <li>The captain creates the team and shares the invite code. Every member, subs included, must have a Gaming Arena account.</li>
          <li>The captain handles lobby joins, result screenshots and disputes for the team.</li>
          <li>Rosters lock when registration closes. Teams short of players at that point may be removed.</li>
          <li>Each game allows at most the subs shown on its event page. Subs swap in only between matches.</li>
          <li>Team names must be clean. Organisers can rename or remove offensive names.</li>
        </ul>

        <h2>3. Houses</h2>
        <p>Teams can mix houses. A team's house points are split equally between its players, and each share goes to that player's house. Example: a BGMI squad of 3 Gir players and 1 Corbett player wins 10 house points, so Gir gets 7.5 and Corbett gets 2.5.</p>
        <p>Events marked <strong>House Cup</strong> are single-house: every member must be from the captain's house, and the house takes the full points.</p>

        <h2>4. Matches</h2>
        <ul>
          <li>Lobby details reach registered players on WhatsApp 10–15 minutes before start. Matches start on time; more than 10 minutes late is a forfeit.</li>
          <li>The captain (or the winner, in 1v1 games) shares an uncropped result screenshot within 15 minutes of the match ending.</li>
          <li>Keep a screen recording of your matches. Organisers may ask for it in a dispute.</li>
          <li>No emulators or tablets in phone events unless the event page says so.</li>
          <li>Streaming is allowed with at least a 3-minute delay and no lobby passwords on screen.</li>
        </ul>

        <h2>5. Fair play</h2>
        <p>Hacks, mods, macros, VPN region-hopping, account sharing, playing on someone else's account, teaming in battle royale, stream sniping, match-fixing and betting all mean an immediate disqualification and a platform ban.</p>

        <h2>6. Conduct</h2>
        <p>No slurs, harassment, sexism, casteism or regional abuse in game chat, voice, WhatsApp or streams. Respect volunteers. Never share another student's contact details. The IITM BS student code of conduct applies and takes precedence.</p>

        <h2>7. Disputes</h2>
        <ol>
          <li>Raise a dispute with the event organisers within 15 minutes of the result (30 minutes after the event ends for scoring errors), with a screenshot or recording.</li>
          <li>The other side gets 15 minutes to respond.</li>
          <li>The match admin decides within 60 minutes during a live event, or 24 hours otherwise.</li>
          <li>You can appeal within 24 hours to two organisers who were not involved. Their decision is final. Every result change is logged.</li>
        </ol>

        <h2>8. Penalties</h2>
        <ul>
          <li><strong>Minor</strong> (late check-in, wrong screenshot): warning.</li>
          <li><strong>Moderate</strong> (late to lobby, repeated warnings, toxic chat): points deduction or loss of a map/game.</li>
          <li><strong>Major</strong> (no-show, sub violation, playing on another account): forfeit or disqualification; house points void.</li>
          <li><strong>Severe</strong> (cheating, teaming, impersonation, match-fixing, betting): disqualification, platform ban, house points revoked, and a report to the programme.</li>
        </ul>
        <p>Two no-shows in a season mean a 30-day registration ban.</p>

        <h2>9. Money</h2>
        <p>Entry is always free. There are no stakes, bets or paid predictions on Gaming Arena, in line with India's online gaming law. Any prizes are sponsored and based on performance.</p>

        <p style={{ marginTop: 32 }}>
          See also the <Link to="/privacy" style={{ textDecoration: 'underline' }}>privacy note</Link>.
        </p>
      </article>
    </div>
  )
}

export function Privacy() {
  return (
    <div className="page stack" style={{ gap: 8 }}>
      <header className="page-header contour stack" style={{ gap: 8, marginBottom: 12 }}>
        <h1 className="display">Privacy</h1>
        <p className="lead" style={{ maxWidth: 620 }}>What we store, who sees it, and why.</p>
      </header>
      <article className="prose">
        <h2>What we store</h2>
        <ul>
          <li>Your verified IITM email, the username you chose, your full name, house, region and WhatsApp number.</li>
          <li>The events you register for, your in-game IDs for them, and your teams and results.</li>
          <li>A log of organiser actions (who changed what and when), so results can be audited.</li>
        </ul>
        <h2>Who sees it</h2>
        <ul>
          <li><strong>Everyone:</strong> your username, house, team names and results on leaderboards.</li>
          <li><strong>Your teammates:</strong> your username, house and role on the team.</li>
          <li><strong>Organisers only:</strong> your email, full name, WhatsApp number and in-game IDs, to run matches and contact you about them.</li>
        </ul>
        <p>We never sell data, show ads or share your contact details with sponsors. Sign-in uses one-time codes, so there is no password to leak.</p>
        <h2>Your choices</h2>
        <p>You can change your WhatsApp number from your profile at any time. To correct other details, or to have your account deleted, contact the organisers; results you played in stay on the boards without your personal details.</p>
      </article>
    </div>
  )
}
