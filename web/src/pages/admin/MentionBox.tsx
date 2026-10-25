import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { HouseTag } from '../../components/ui'
import { igNorm } from '../../lib/format'
import type { AdminEntry } from './shared'

export interface Mentionable {
  key: string
  /** What goes into the text after "@": the username for a solo entry, the team name otherwise. */
  tag: string
  sub: string
  house_id: number | null
  entry_id: string
}

export function mentionables(entries: AdminEntry[]): Mentionable[] {
  return entries.map((e) => {
    const solo = (e.members ?? []).length === 1 ? e.members![0] : null
    return solo
      ? { key: e.entry_id, tag: solo.username, sub: solo.ig_id, house_id: e.house_id, entry_id: e.entry_id }
      : { key: e.entry_id, tag: e.name, sub: (e.members ?? []).map((m) => m.username).join(', '), house_id: e.house_id, entry_id: e.entry_id }
  })
}

/** "@que" right before the caret on the current line, or null. */
function queryAt(text: string, caret: number): { start: number; q: string } | null {
  const before = text.slice(0, caret)
  const m = before.match(/(^|[\n\s])@([^\n,@]{0,30})$/)
  if (!m) return null
  // Stop suggesting once the name is finished with a comma or points.
  if (/\s\d/.test(m[2])) return null
  return { start: caret - m[2].length - 1, q: m[2] }
}

/**
 * Results textarea with WhatsApp-style mentions: type @ and pick a player registered in this
 * event, so names never mismatch. Picking inserts "@username, " ready for the points.
 */
export function MentionBox({
  value,
  onChange,
  people,
  taken,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  people: Mentionable[]
  taken: Set<string>
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [at, setAt] = useState<{ start: number; q: string } | null>(null)
  const [hi, setHi] = useState(0)

  const list = useMemo(() => {
    if (!at) return []
    const q = igNorm(at.q)
    const scored = people
      .filter((p) => !taken.has(p.entry_id))
      .map((p) => {
        const a = igNorm(p.tag)
        const b = igNorm(p.sub)
        const rank = !q ? 2 : a.startsWith(q) ? 0 : b.startsWith(q) ? 1 : a.includes(q) || b.includes(q) ? 2 : 9
        return { p, rank }
      })
      .filter((x) => x.rank < 9)
      .sort((x, y) => x.rank - y.rank || x.p.tag.localeCompare(y.p.tag))
    return scored.slice(0, 8).map((x) => x.p)
  }, [at, people, taken])

  const sync = () => {
    const el = ref.current
    if (!el) return
    const next = el.selectionStart === el.selectionEnd ? queryAt(el.value, el.selectionStart) : null
    setAt(next)
    if (next?.q !== at?.q) setHi(0)
  }

  const pick = (p: Mentionable) => {
    const el = ref.current
    if (!el || !at) return
    const caret = el.selectionStart
    // Swallow the rest of a half-typed word after the caret too.
    const rest = value.slice(caret).match(/^[^\n,]*/)?.[0] ?? ''
    const insert = `@${p.tag}, `
    const next = value.slice(0, at.start) + insert + value.slice(caret + rest.length).replace(/^,\s*/, '')
    onChange(next)
    setAt(null)
    const pos = at.start + insert.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!at || list.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((h) => (h + 1) % list.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => (h - 1 + list.length) % list.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      pick(list[Math.min(hi, list.length - 1)])
    } else if (e.key === 'Escape') {
      setAt(null)
    }
  }

  const open = !!at && list.length > 0
  return (
    <div className="mention">
      <textarea
        ref={ref}
        id="m-lines"
        className="textarea rs-lines"
        spellCheck={false}
        autoComplete="off"
        aria-label="Results, one player per line"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="mention-list"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          requestAnimationFrame(sync)
        }}
        onKeyDown={onKey}
        onKeyUp={(e) => {
          if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) sync()
        }}
        onClick={sync}
        onBlur={() => setTimeout(() => setAt(null), 120)}
      />
      {open && (
        <ul className="mention-list" id="mention-list" role="listbox" aria-label="Registered players">
          {list.map((p, i) => (
            <li key={p.key} role="option" aria-selected={i === hi}>
              <button
                type="button"
                className={i === hi ? 'is-hi' : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(p)}
              >
                <span className="mention-at">@</span>
                <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
                  <b className="ellipsis">{p.tag}</b>
                  {p.sub && p.sub !== p.tag && <small className="ellipsis t3">{p.sub}</small>}
                </span>
                <HouseTag id={p.house_id} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {at && list.length === 0 && (
        <p className="mention-none small t3">{people.length === 0 ? 'Nobody has registered yet.' : 'No registered player matches. Only registered players can get points.'}</p>
      )}
    </div>
  )
}
