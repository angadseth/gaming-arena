import { useState } from 'react'
import { Button, ErrorBox, Field, Skeleton } from '../../components/ui'
import { useAction, useRegions, useToast } from '../../lib/app'
import type { Region } from '../../lib/types'
import { AdminHeader, gap } from './shared'

type Args = { p_id: number | null; p_name: string; p_sort: number; p_active: boolean }

export default function Regions() {
  const regions = useRegions()
  const toast = useToast()
  const [name, setName] = useState('')
  const save = useAction((a, args: Args) => a.rpc('admin_upsert_region', args), [['regions']])

  if (regions.error) return <ErrorBox error={regions.error} retry={() => regions.refetch()} />
  const list = regions.data ?? []
  const nextSort = list.reduce((m, r) => Math.max(m, r.sort_order), 0) + 1

  return (
    <>
      <AdminHeader title="Regions" sub="Shown in the sign-up form. Hidden regions stay on existing profiles." />
      <div className="panel row wrap" style={{ alignItems: 'flex-end' }}>
        <div className="grow">
          <Field label="New region" htmlFor="r-new">
            <input id="r-new" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <Button
          kind="primary"
          busy={save.isPending}
          disabled={name.trim().length < 2}
          onClick={() =>
            save.mutate(
              { p_id: null, p_name: name.trim(), p_sort: nextSort, p_active: true },
              {
                onSuccess: () => {
                  toast({ kind: 'success', text: `${name.trim()} added.` })
                  setName('')
                },
              },
            )
          }
        >
          Add region
        </Button>
      </div>
      {regions.isPending ? (
        <Skeleton h={300} />
      ) : (
        <div className="rows">
          {list.map((r) => (
            <RegionRow key={r.id} region={r} save={(a) => save.mutate(a)} busy={save.isPending} />
          ))}
        </div>
      )}
    </>
  )
}

function RegionRow({ region, save, busy }: { region: Region; save: (a: Args) => void; busy: boolean }) {
  const [name, setName] = useState(region.name)
  const [sort, setSort] = useState(String(region.sort_order))
  const dirty = name.trim() !== region.name || Number(sort) !== region.sort_order
  const args = (patch: Partial<Args>): Args => ({ p_id: region.id, p_name: name.trim(), p_sort: Number(sort) || 0, p_active: region.is_active, ...patch })
  return (
    <div className="link-row wrap" style={gap(10)}>
      <input className="input" style={{ flex: '1 1 160px' }} value={name} aria-label="Region name" maxLength={40} onChange={(e) => setName(e.target.value)} />
      <input className="input num" style={{ width: 80 }} value={sort} aria-label="Sort order" inputMode="numeric" onChange={(e) => setSort(e.target.value.replace(/[^\d-]/g, ''))} />
      {!region.is_active && <span className="pill pill-draft">Hidden</span>}
      <Button size="sm" disabled={!dirty || busy || name.trim().length < 2} onClick={() => save(args({}))}>
        Save
      </Button>
      <Button size="sm" kind="ghost" disabled={busy} onClick={() => save(args({ p_active: !region.is_active }))}>
        {region.is_active ? 'Hide' : 'Show'}
      </Button>
    </div>
  )
}
