import { Link } from 'react-router-dom'
import { Empty } from '../components/ui'

export default function NotFound() {
  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <Empty
        title="Off the trail"
        text="That page does not exist, or the event has moved."
        action={<Link to="/" className="btn btn-secondary">Back to events</Link>}
      />
    </div>
  )
}
