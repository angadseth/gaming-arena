import { beforeAll, describe, expect, it } from 'vitest'
import { freshDb, type Db } from './harness'

// 0018: every player-visible write sends one Broadcast ping per statement on topic 'arena'.
let db: Db

beforeAll(async () => {
  db = await freshDb()
  await db.as('postgres')
  await db.exec(`
    create schema if not exists realtime;
    create table realtime.pings (kind text, topic text, private boolean, payload jsonb);
    create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
    language sql as $$ insert into realtime.pings values (event, topic, private, payload) $$;
  `)
}, 60_000)

describe('live updates', () => {
  it('a statement touching many rows sends one public ping with only the kind', async () => {
    await db.as('postgres')
    await db.query(`update public.tournaments set summary = summary`)
    const r = await db.query<{ kind: string; topic: string; private: boolean; payload: Record<string, unknown> }>(
      `select * from realtime.pings`)
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({ kind: 'events', topic: 'arena', private: false })
    expect(Object.keys(r.rows[0].payload).sort()).toEqual(['at', 'kind'])
  })

  it('a broken realtime never blocks the write', async () => {
    await db.as('postgres')
    await db.exec(`create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
      returns void language plpgsql as $$ begin raise exception 'down'; end $$;`)
    const r = await db.query(`update public.games set short = short returning id`)
    expect(r.rows.length).toBeGreaterThan(0)
  })
})
