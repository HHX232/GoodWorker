'use client'

import dynamic from 'next/dynamic'

// TipTap + mathlive are browser-only — never server-rendered.
const SharedLecture = dynamic(() => import('./SharedLecture').then(m => m.SharedLecture), { ssr: false })

export function SharedLectureLoader({ token }: { token: string }) {
  return <SharedLecture token={token} />
}
