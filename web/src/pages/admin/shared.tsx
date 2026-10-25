import { useState, type CSSProperties, type ReactNode } from 'react'
import { Button, Field, Sheet } from '../../components/ui'

export const IST_OFFSET_MS = 5.5 * 3_600_000

/** ISO timestamp -> value for <input type="datetime-local"> in IST. */
export function isoToIstInput(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16)
}

/** <input type="datetime-local"> value read as IST -> ISO, or '' when empty. */
export function istInputToIso(v: string): string {
  if (!v) return ''
  const d = new Date(`${v}:00+05:30`)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

/** Points for a rank in a table like {"1": 10, "5-8": 2}; mirrors public.points_for_rank. */
export function pointsForRank(table: Record<string, number> | null | undefined, rank: number | null | undefined): number {
  if (!table || rank == null) return 0
  if (table[String(rank)] != null) return Number(table[String(rank)])
  for (const [k, v] of Object.entries(table)) {
    const m = /^(\d+)-(\d+)$/.exec(k)
    if (m && rank >= Number(m[1]) && rank <= Number(m[2])) return Number(v)
  }
  return 0
}

/** Parses a JSON textarea; returns [value, error]. */
export function parseJson<T>(text: string, kind: 'object' | 'array'): [T | null, string | null] {
  try {
    const v = JSON.parse(text || (kind === 'array' ? '[]' : '{}'))
    const ok = kind === 'array' ? Array.isArray(v) : v !== null && typeof v === 'object' && !Array.isArray(v)
    return ok ? [v as T, null] : [null, `Must be a JSON ${kind}`]
  } catch (e) {
    return [null, `Invalid JSON: ${(e as Error).message}`]
  }
}

/** CSV cell: quoted, and formula-injection safe for spreadsheet apps. */
function csvCell(v: unknown): string {
  let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const text = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Resizes an image to at most `maxW` wide and encodes it as WebP. */
export async function resizeToWebp(file: File, maxW = 1200, quality = 0.8): Promise<Blob> {
  if (!/^image\/(png|jpeg|webp|avif)$/.test(file.type)) throw new Error('Use a PNG, JPEG, WebP or AVIF image')
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxW / bmp.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', quality))
  if (!blob) throw new Error('Could not encode the image')
  if (blob.size > 500 * 1024) throw new Error(`Image is ${Math.round(blob.size / 1024)} KB after resizing; the limit is 500 KB`)
  return blob
}

/** Confirm dialog that requires typing a word (usually the event slug). */
export function ConfirmSheet({
  open, onClose, title, body, confirmWord, confirmLabel, danger = true, busy, onConfirm, children,
}: {
  open: boolean
  onClose: () => void
  title: string
  body: ReactNode
  confirmWord?: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  children?: ReactNode
}) {
  const [typed, setTyped] = useState('')
  const ok = !confirmWord || typed.trim() === confirmWord
  return (
    <Sheet
      open={open}
      onClose={() => {
        setTyped('')
        onClose()
      }}
      title={title}
    >
      <div className="stack">
        <div className="t2">{body}</div>
        {children}
        {confirmWord && (
          <Field label={`Type ${confirmWord} to confirm`} htmlFor="confirm-word">
            <input id="confirm-word" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button kind="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            kind={danger ? 'danger-fill' : 'primary'}
            disabled={!ok}
            busy={busy}
            onClick={() => {
              onConfirm()
              setTyped('')
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

export function AdminHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="spread wrap admin-head">
      <div className="stack" style={{ '--gap': '4px' } as CSSProperties}>
        <h1 className="h2">{title}</h1>
        {sub && <p className="t3 small">{sub}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  )
}

export function ReadOnlyNote() {
  return <p className="hint">View only. Ask Angad (Super Admin) to change this.</p>
}

export interface AdminMember {
  username: string
  full_name: string
  email: string
  whatsapp: string
  house_id: number
  region_id: number
  role: string
  ig_id: string
  extra: Record<string, string>
}

export interface AdminEntry {
  entry_id: string
  name: string
  status: 'active' | 'disqualified'
  house_id: number | null
  points_adjust: number
  adjust_note: string | null
  created_at: string
  members: AdminMember[] | null
}

/** Inline style setting the --gap used by .stack / .row. */
export const gap = (px: number) => ({ '--gap': `${px}px` }) as CSSProperties
