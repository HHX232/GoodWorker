'use client'

import { HeroStudio } from './HeroStudio'
import { SeoText } from './Seo'
import { Examples, Features, FilesBundle, FinalCta, HowItWorks } from './Sections'
import s from './LectureLanding.module.scss'

// /info-lecture — the lecture-notes landing. The first screen is the feature
// itself, working: recording, the chalkboard photo and the notes they make.
// Then: notes + files, examples, how it works, features, the final call and
// the plain-text part for search.

export function LectureLanding() {
  return (
    <main className={s.page}>
      <HeroStudio />
      <FilesBundle />
      <Examples />
      <HowItWorks />
      <Features />
      <FinalCta />
      <SeoText />
    </main>
  )
}
