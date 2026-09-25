import type { FilesPerson } from '@/shared/types/TutorFiles/tutorFiles.types'
import { initials } from '../lib'
import ui from '../ui.module.scss'

/** Floe-style overlapping avatars of the students who hold access — up to `max`, then `+N`. */
export function AvatarStack({ people, max = 3 }: { people: FilesPerson[]; max?: number }) {
  if (people.length === 0) return null
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <span className={ui.avatars} title={people.map(p => p.name).join(', ')}>
      {shown.map(p =>
        p.avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img key={p.id} src={p.avatarUrl} alt="" className={ui.avatar} />
          : <span key={p.id} className={ui.avatar}>{initials(p.name)}</span>
      )}
      {rest > 0 && <span className={`${ui.avatar} ${ui.avatarMore}`}>+{rest}</span>}
    </span>
  )
}
