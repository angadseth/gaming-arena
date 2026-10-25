import { describe, expect, it } from 'vitest'
import { parseLines } from './Results'
import type { AdminEntry } from './shared'

const solo = (id: string, ig: string, username = id) =>
  ({ entry_id: id, name: username, status: 'active', members: [{ username, ig_id: ig }] }) as unknown as AdminEntry

describe('parseLines: names as skribbl shows them', () => {
  const entries = [
    solo('a', 'Rohit, IITM', 'rohit'),
    solo('b', 'Ab&c.d', 'abc'),
    solo('c', 'SuperLongSkribblName2026', 'longy'),
    solo('d', 'r.k', 'rk1'),
    solo('e', 'rk', 'rk2'),
  ]
  const who = (t: string) => parseLines(t, entries).map((l) => l.entry?.entry_id ?? null)

  it('matches exact names first', () => expect(who('rk\n@rk1')).toEqual(['e', 'd']))
  it('matches skribbl-stripped punctuation', () => expect(who('Rohit IITM\nAbcd')).toEqual(['a', 'b']))
  it('matches a name skribbl cut short', () => expect(who('SuperLongSkribblName')).toEqual(['c']))
  it('does not guess short or ambiguous names', () => expect(who('Super\nr k')).toEqual([null, 'e']))
})
