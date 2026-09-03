'use client'

import dynamic from 'next/dynamic'

// Neither of these renders anything needed for first paint (the tutorial
// overlay is null until a tutorial is actively running; the toaster is an
// empty portal until something calls toast()). Splitting them into their own
// chunk keeps their code out of the bundle every page — including the public
// landing page — has to parse before it becomes interactive.
const TutorialOverlay = dynamic(() => import('@/widgets/Tutorial/TutorialOverlay'), {ssr: false})
const ThemedToaster = dynamic(() => import('./ThemedToaster').then((m) => m.ThemedToaster), {ssr: false})

export function LazyClientWidgets() {
  return (
    <>
      <ThemedToaster />
      <TutorialOverlay />
    </>
  )
}
