'use client'

import { useTranslations } from 'next-intl'
import s from './LectureLanding.module.scss'

export interface FaqItem { q: string; a: string }

/** Plain words for search engines and for readers who scroll to the end: what it is, for whom, how, plus FAQ. */
export function SeoText() {
  const t = useTranslations('lectureLanding.seo')
  const blocks = t.raw('blocks') as { h: string; p: string[] }[]
  const faq = t.raw('faq') as FaqItem[]
  return (
    <section className={s.seo} aria-labelledby="lecture-seo-h">
      <div className={`${s.wrap} ${s.seoGrid}`}>
        <article className={s.seoText}>
          <h2 id="lecture-seo-h" className={s.h2}>{t('h')}</h2>
          {(t.raw('intro') as string[]).map((p, i) => <p key={i}>{p}</p>)}
          {blocks.map(b => (
            <div key={b.h}>
              <h3>{b.h}</h3>
              {b.p.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ))}
        </article>
        <div>
          <div className={s.eyebrow}>{t('faqTitle')}</div>
          <div className={s.faq}>
            {faq.map(f => (
              <details key={f.q} className={s.faqItem}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
