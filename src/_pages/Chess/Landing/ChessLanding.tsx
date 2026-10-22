'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, Plus } from 'lucide-react'
import Footer from '@/widgets/Footer/Footer'
import { getSkin } from '@/widgets/Chess/Board'
import { HeroScene } from './HeroScene'
import { Features } from './Features'
import { ChessHeader } from './ChessHeader'
import s from './ChessLanding.module.scss'

/*
 * /info-chess — the chess section's landing (T23). Hero A, made cinematic: a dark stage where Morphy's Opera game
 * plays itself on a board in perspective while the coach grades and explains the key moves; below — live fragments
 * of the real section on a warm field; FAQ; a closing call to play. Header — global (app/layout.tsx), footer — global.
 */

const FAQ = [1, 2, 3, 4, 5, 6] as const
const MARBLE = getSkin('marble').pieces

function Ctas() {
  const t = useTranslations('chess.landing')
  return (
    <div className={s.ctas}>
      <Link href="/chess/play" className={s.btnMain}>
        {t('cta_play')} <ArrowRight size={18} />
      </Link>
      <Link href="/chess/puzzles" className={s.btnGhost}>
        {t('cta_puzzles')}
      </Link>
    </div>
  )
}

export function ChessLanding() {
  const t = useTranslations('chess.landing')
  return (
    <div className={s.root}>
      <ChessHeader />
      <main>
        <section id="gwl-top" className={s.hero} aria-labelledby="gwl-title">
          <div className={s.haze} aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className={s.heroTop}>
            <div className={s.heroCopy}>
              <h1 id="gwl-title" className={s.h1}>
                {t('hero_title_a')} {t('hero_title_b')} <em>{t('hero_title_c')}</em>
              </h1>
              <p className={s.sub}>{t('hero_sub')}</p>
            </div>
            <div className={s.heroAct}>
              <p className={s.aside}>{t('hero_aside')}</p>
              <Ctas />
            </div>
          </div>
          <HeroScene />
        </section>

        <Features />

        <section id="gwl-faq" className={s.faq} aria-labelledby="gwl-faq-h">
          <h2 id="gwl-faq-h" className={s.h2}>
            {t('faq_title')}
          </h2>
          <div className={s.faqList}>
            {FAQ.map((n) => (
              <details key={n} className={s.qa}>
                <summary>
                  {t(`q${n}`)}
                  <Plus size={18} aria-hidden="true" />
                </summary>
                <p>{t(`a${n}`)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={s.final} aria-labelledby="gwl-final">
          <div className={s.finalPieces} aria-hidden="true">
            <MARBLE.wK className={s.finalKing} />
            <MARBLE.bN className={s.finalKnight} />
          </div>
          <div className={s.finalCopy}>
            <h2 id="gwl-final" className={s.h2}>
              {t('final_title')}
            </h2>
            <p className={s.sub}>{t('final_sub')}</p>
            <Ctas />
            <p className={s.credit}>{t('credit')}</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
