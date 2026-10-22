'use client'

import dynamic from 'next/dynamic'

// TipTap + mathlive + the recorder are browser-only — never server-rendered.
const LectureWorkspace = dynamic(() => import('./LectureWorkspace').then(m => m.LectureWorkspace), { ssr: false })

export function LectureWorkspaceLoader({ lectureId }: { lectureId: string }) {
  return <LectureWorkspace lectureId={lectureId} />
}
