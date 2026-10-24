import { CircleCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, Field } from '../components/ui'
import { errorText, useApi } from '../lib/app'

export default function RequestGame() {
  const api = useApi()
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) {
      setErr('Enter the game name')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await api.rpc('request_game', { p_game_name: name.trim(), p_platform: platform.trim(), p_note: note.trim() })
      setSent(true)
    } catch (e2) {
      setErr(errorText(e2))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="page stack" style={{ gap: 16, maxWidth: 560, paddingTop: 40 }}>
        <CircleCheck size={48} strokeWidth={1.5} style={{ color: 'var(--success)' }} aria-hidden />
        <h1 className="h1">Request sent</h1>
        <p className="lead">Organisers review requests every week. Popular requests become events.</p>
        <Link to="/" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Back to events</Link>
      </div>
    )
  }

  return (
    <form className="page stack" style={{ gap: 20, maxWidth: 640 }} onSubmit={submit} noValidate>
      <h1 className="h1">Request a game</h1>
      <p className="t2">Tell us what you want to play. Free-to-play games that run on phones get picked first. Up to 3 requests a day.</p>
      <Field label="Game" htmlFor="g" error={err}>
        <input id="g" className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clash of Clans" />
      </Field>
      <Field label="Platform (optional)" htmlFor="p">
        <input id="p" className="input" maxLength={40} value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Android, PC, Web…" />
      </Field>
      <Field label="Anything else? (optional)" htmlFor="n" hint="Format ideas, how many friends would play, etc.">
        <textarea id="n" className="textarea" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button kind="primary" block busy={busy} type="submit">Send request</Button>
    </form>
  )
}
