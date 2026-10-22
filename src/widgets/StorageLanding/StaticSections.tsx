import { CloudUpload, Eye, FileText, Folder, Lock, Plus, Play, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CtaLink } from './CtaLink'
import { HeroWindow } from './HeroWindow'
import type { CssVars } from './motion'
import s from './StorageLanding.module.scss'

// Статичные блоки лендинга — серверные компоненты (текст попадает в HTML для поиска).

export function Hero() {
   const t = useTranslations('StorageLanding')
   return (
      <section className={s.hero}>
         <div className={`${s.wrap} ${s.heroGrid}`}>
            <div>
               <span className={`${s.badge} ${s.rise}`} style={{ '--i': 0 } as CssVars}>
                  <Folder className={s.ic} aria-hidden='true' />
                  {t('badge')}
               </span>
               <h1 className={`${s.h1} ${s.rise}`} style={{ '--i': 1 } as CssVars}>
                  {t.rich('hero_title', {
                     hl: chunks => (
                        <span className={s.hl}>
                           {chunks}
                           <svg viewBox='0 0 200 12' preserveAspectRatio='none' aria-hidden='true'>
                              <path style={{ '--len': 210 } as CssVars} d='M3 8C40 3 90 3 125 5s55 3 72 0' />
                           </svg>
                        </span>
                     )
                  })}
               </h1>
               <p className={`${s.lead} ${s.rise}`} style={{ '--i': 2 } as CssVars}>
                  {t('hero_lead')}
               </p>
               <div className={`${s.ctas} ${s.rise}`} style={{ '--i': 3 } as CssVars}>
                  <CtaLink />
                  <a className={s.linkPlay} href='#how'>
                     <span className={s.pl}>
                        <Play className={s.ic} aria-hidden='true' />
                     </span>
                     {t('hero_cta2')}
                  </a>
               </div>
               <div className={`${s.sig} ${s.rise}`} style={{ '--i': 4 } as CssVars} aria-hidden='true'>
                  {t('hero_sig')}
                  <svg viewBox='0 0 78 48'>
                     <path style={{ '--len': 120 } as CssVars} d='M6 8C28 0 58 8 66 34M66 34l-9-8M66 34l8-9' />
                  </svg>
               </div>
            </div>

            <div className={s.heroArt}>
               <span className={`${s.tile} ${s.tCloud}`} aria-hidden='true'>
                  <CloudUpload className={s.ic} />
               </span>
               <span className={`${s.tile} ${s.tPdf}`} aria-hidden='true'>
                  <FileText className={s.ic} />
               </span>
               <span className={`${s.tile} ${s.tLock}`} aria-hidden='true'>
                  <Lock className={s.ic} />
               </span>
               <HeroWindow />
            </div>
         </div>
      </section>
   )
}

const STEP_TILES = [
   { Icon: Folder, style: { '--c': '#5b4df0', '--r': '-5deg', '--d': 0 } },
   { Icon: Eye, style: { '--c': '#f2b134', '--tc': '#3b2a00', '--r': '4deg', '--d': 160 } },
   { Icon: Upload, style: { '--c': '#2fb67a', '--tc': '#06281a', '--r': '-3deg', '--d': 320 } }
] as const

export function Steps() {
   const t = useTranslations('StorageLanding')
   return (
      <section className={`${s.blk} ${s.steps}`} id='steps' aria-labelledby='sl-steps-h'>
         <div className={s.wrap}>
            <h2 id='sl-steps-h'>{t('steps_title')}</h2>
            <p className={s.blkLead}>{t('steps_lead')}</p>
            <ol className={s.stp} data-reveal>
               {STEP_TILES.map(({ Icon, style }, i) => (
                  <li key={i} style={{ '--d': style['--d'] } as CssVars}>
                     <span className={s.stpN} aria-hidden='true'>
                        {i + 1}
                     </span>
                     <span className={s.stpTile} style={style as CssVars} aria-hidden='true'>
                        <Icon className={s.ic} />
                     </span>
                     <h3>{t(`step${i + 1}_t`)}</h3>
                     <p>{t(`step${i + 1}_d`)}</p>
                  </li>
               ))}
            </ol>
         </div>
      </section>
   )
}

export function Audience() {
   const t = useTranslations('StorageLanding')
   return (
      <section className={`${s.blk} ${s.aud}`} id='audience' aria-labelledby='sl-aud-h'>
         <div className={s.wrap}>
            <h2 id='sl-aud-h'>{t('aud_title')}</h2>
            <div className={s.audGrid} data-reveal>
               <div className={`${s.audP} ${s.audT}`}>
                  <h3>{t('aud_t_title')}</h3>
                  <p className={s.sl}>{t('aud_t_sub')}</p>
                  <ul>
                     {[1, 2, 3, 4].map(n => (
                        <li key={n}>
                           <b>{t(`aud_t${n}_b`)}</b>
                           <span>{t(`aud_t${n}_d`)}</span>
                        </li>
                     ))}
                  </ul>
               </div>
               <div className={`${s.audP} ${s.audS}`}>
                  <h3>{t('aud_s_title')}</h3>
                  <p className={s.sl}>{t('aud_s_sub')}</p>
                  <ul>
                     {[1, 2, 3].map(n => (
                        <li key={n}>
                           <b>{t(`aud_s${n}_b`)}</b>
                           <span>{t(`aud_s${n}_d`)}</span>
                        </li>
                     ))}
                  </ul>
               </div>
            </div>
         </div>
      </section>
   )
}

export function Faq() {
   const t = useTranslations('StorageLanding')
   return (
      <section className={`${s.blk} ${s.faq}`} id='faq' aria-labelledby='sl-faq-h'>
         <div className={`${s.wrap} ${s.faqG}`} data-reveal>
            <div className={s.faqL}>
               <h2 id='sl-faq-h'>{t('faq_title')}</h2>
               <p className={s.blkLead}>{t('faq_lead')}</p>
            </div>
            <div>
               {[1, 2, 3, 4, 5, 6].map((n, i) => (
                  <details key={n} open={i === 0} style={{ '--d': i * 70 } as CssVars}>
                     <summary>
                        {t(`faq${n}_q`)}
                        <span className={s.pm} aria-hidden='true'>
                           <Plus className={s.ic} />
                        </span>
                     </summary>
                     <p>{t(`faq${n}_a`)}</p>
                  </details>
               ))}
            </div>
         </div>
      </section>
   )
}

export function FinalCta() {
   const t = useTranslations('StorageLanding')
   return (
      <section className={s.cta} aria-labelledby='sl-cta-h'>
         <div className={s.wrap}>
            <div className={s.ctaBox} data-reveal>
               <div>
                  <h2 id='sl-cta-h'>{t('cta_title')}</h2>
                  <p>{t('cta_text')}</p>
                  <CtaLink inverted />
               </div>
               <div className={s.ctaArt} aria-hidden='true'>
                  {[Folder, CloudUpload, Lock].map((Icon, i) => (
                     <span key={i} className={s.ctaT} style={{ '--d': i * 140 } as CssVars}>
                        <Icon className={s.ic} />
                     </span>
                  ))}
               </div>
            </div>
         </div>
      </section>
   )
}
