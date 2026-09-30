'use client'

import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { HeroBoard } from './HeroBoard'
import { HeroDesk } from './HeroDesk'
import { HeroLive } from './HeroLive'
import { Examples, Features, FilesBundle, FinalCta, HowItWorks } from './Sections'
import s from './LectureLanding.module.scss'

// /info-lecture — the lecture-notes landing. Three first screens are being
// compared (?hero=a|b|c, the pill at the bottom); each one is the feature
// itself, working, not a picture of it. Then: notes + files, examples,
// how it works, features, the final call.

const HEROES = { a: HeroLive, b: HeroDesk, c: HeroBoard } as const
type HeroId = keyof typeof HEROES

export function LectureLanding() {
  const t = useTranslations('lectureLanding')
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const raw = params.get('hero')
  const hero: HeroId = raw === 'b' || raw === 'c' ? raw : 'a'
  const Hero = HEROES[hero]
  const choose = (id: HeroId) => router.replace(`${pathname}?hero=${id}`, { scroll: false })

  return (
    <main className={s.page}>
      <Hero key={hero} />
      <FilesBundle />
      <Examples />
      <HowItWorks />
      <Features />
      <FinalCta />
      <nav className={s.switcher} aria-label={t('variantLabel')}>
        <span>{t('variantLabel')}</span>
        {(Object.keys(HEROES) as HeroId[]).map(id => (
          <button key={id} type="button" className={hero === id ? s.switchOn : ''} aria-pressed={hero === id} onClick={() => choose(id)}>{id.toUpperCase()}</button>
        ))}
      </nav>
    </main>
  )
}
