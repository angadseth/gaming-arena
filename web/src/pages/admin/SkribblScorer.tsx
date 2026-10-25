import { Bookmark, Copy } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Button } from '../../components/ui'
import { useToast } from '../../lib/app'

/**
 * skribbl.io has no API, so the host carries the scoreboard over with one bookmark.
 * On the skribbl tab it reads #game-players (name, "#rank", "N points"; the host's own row
 * ends in "(You)"), sorts by rank and opens this event's Results with the names filled in,
 * winner first. Names match registered skribbl names; the event's points table gives the points.
 */
export function bookmarklet(resultsUrl: string) {
  const js = `(()=>{const L=[...document.querySelectorAll('#game-players .player')].map(p=>{const n=p.querySelector('.player-name');if(!n)return null;let t=n.textContent.trim();if(n.classList.contains('me'))t=t.replace(/\\s*\\([^)]*\\)\\s*$/,'');t=t.replace(/[,\\t\\n]+/g,' ').trim();const r=parseInt((p.querySelector('.player-rank')||{}).textContent?.replace('#','')||'')||999;const s=parseInt((p.querySelector('.player-score')||{}).textContent||'')||0;return t?{t,r,s}:null}).filter(Boolean).sort((a,b)=>a.r-b.r||b.s-a.s);if(!L.length){alert('Gaming Arena: no skribbl players found. Click this on the skribbl.io game tab.');return}window.open(${JSON.stringify(resultsUrl)}+'?from=skribbl&lines='+encodeURIComponent(L.map(x=>x.t).join('\\n')),'_blank')})()`
  // Browsers percent-decode a bookmark URL before running it, and a bare # would end it early.
  return `javascript:${js.replace(/%/g, '%25').replace(/#/g, '%23')}`
}

export function SkribblScorer({ tournamentId }: { tournamentId: string }) {
  const toast = useToast()
  const link = useRef<HTMLAnchorElement>(null)
  const code = useMemo(
    () => bookmarklet(`${location.origin}${location.pathname}#/admin/events/${tournamentId}/results`),
    [tournamentId],
  )
  // React refuses javascript: hrefs in JSX, so the bookmark's href is set on the element directly.
  useEffect(() => {
    link.current?.setAttribute('href', code)
  }, [code])

  return (
    <section className="lobby-card stack" style={{ gap: 12 }}>
      <div>
        <h3 className="lobby-h">skribbl auto-score</h3>
        <p className="small t3">One click after every skribbl game: the room's scoreboard comes here with the names in order, winner first.</p>
      </div>
      <ol className="sk-steps small">
        <li>
          <b>Once:</b> drag this button to your bookmarks bar (Ctrl+Shift+B shows the bar).
          <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
            <a ref={link} className="btn btn-primary btn-sm sk-bm" onClick={(e) => e.preventDefault()} draggable>
              <Bookmark size={16} aria-hidden /> skribbl → Gaming Arena
            </a>
            <Button
              size="sm"
              kind="ghost"
              onClick={() => navigator.clipboard.writeText(code).then(() => toast({ kind: 'success', text: 'Copied. Make a new bookmark and paste this as its URL.' }))}
            >
              <Copy size={16} aria-hidden /> Copy instead
            </Button>
          </div>
        </li>
        <li>Players join the skribbl room with the <b>same name they registered</b> here.</li>
        <li>When skribbl shows the final podium, click the bookmark on the skribbl tab.</li>
        <li>This page opens with every name filled in. Fix any red card, press <b>Save</b>. Houses and leaderboards update at once.</li>
      </ol>
    </section>
  )
}
