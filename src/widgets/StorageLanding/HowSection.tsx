'use client'

import { Check, Clock, Eye, Lock, Search, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CtaLink } from './CtaLink'
import type { StudentId } from './heroModel'
import { cx } from './motion'
import s from './StorageLanding.module.scss'
import { Ava, FileTile, FolderTile } from './WindowParts'

const N = 4
const PERIODS = [6500, 8500, 6500, 7000]

/**
 * «Всё для учёбы». ≥900px и без reduced-motion — закреплённая сцена: тезисы переключаются
 * скроллом (sticky + доля прокрутки трека). Иначе — стопка, где сцена проигрывается, когда видна;
 * в покое каждая сцена показывает финальный кадр.
 */
export function HowSection() {
   const t = useTranslations('StorageLanding')
   const query = t('search_query')

   const trackRef = useRef<HTMLDivElement>(null)
   const thRefs = useRef<(HTMLLIElement | null)[]>([])
   const sceneRefs = useRef<(HTMLDivElement | null)[]>([])
   const scrollToThesis = useRef<(i: number) => void>(() => {})

   const [active, setActive] = useState(0)
   const [s1Pre, setS1Pre] = useState(false)
   const [s2Closed, setS2Closed] = useState(false)
   const [s2Press, setS2Press] = useState(false)
   const [s3St, setS3St] = useState(2)
   const [s4Pre, setS4Pre] = useState(false)
   const [typed, setTyped] = useState(query)

   useEffect(() => {
      const mqR = window.matchMedia('(prefers-reduced-motion: reduce)')
      const mqP = window.matchMedia('(min-width:900px) and (prefers-reduced-motion: no-preference)')
      const timers: number[][] = [[], [], [], []]
      const T = (i: number, ms: number, fn: () => void) => {
         timers[i].push(window.setTimeout(fn, ms))
      }
      const stop = (i: number) => {
         timers[i].forEach(window.clearTimeout)
         timers[i] = []
      }

      const starts = [
         // папки по ученикам
         (i: number) => {
            setS1Pre(true)
            T(i, 350, () => setS1Pre(false))
         },
         // доступ на время: открыто -> клик -> закрыто -> открыто
         (i: number) => {
            setS2Closed(true)
            T(i, 300, () => setS2Closed(false))
            T(i, 2900, () => setS2Press(true))
            T(i, 3100, () => {
               setS2Press(false)
               setS2Closed(true)
            })
            T(i, 5400, () => setS2Closed(false))
         },
         // сдача работ
         (i: number) => {
            setS3St(0)
            T(i, 1000, () => setS3St(1))
            T(i, 2500, () => setS3St(2))
         },
         // поиск: набор запроса
         (i: number) => {
            setS4Pre(true)
            setTyped('')
            let k = 0
            const type = () => {
               if (k < query.length) {
                  k += 1
                  setTyped(query.slice(0, k))
                  T(i, 75, type)
               } else {
                  T(i, 260, () => setS4Pre(false))
               }
            }
            type()
         }
      ]

      const play = (i: number) => {
         stop(i)
         starts[i](i)
         T(i, PERIODS[i], () => play(i))
      }
      // финальный (статичный) кадр сцены
      const halt = (i: number) => {
         stop(i)
         if (i === 0) setS1Pre(false)
         if (i === 1) {
            setS2Closed(false)
            setS2Press(false)
         }
         if (i === 2) setS3St(2)
         if (i === 3) {
            setS4Pre(false)
            setTyped(query)
         }
      }
      const stopAll = () => {
         for (let i = 0; i < N; i++) halt(i)
      }

      let cur = -1
      let playing = false
      const activate = (i: number) => {
         if (i !== cur) {
            if (cur > -1) halt(cur)
            setActive(i)
            cur = i
         }
         play(i)
         playing = true
      }
      const onScroll = () => {
         const track = trackRef.current
         if (!mqP.matches || !track) return
         const r = track.getBoundingClientRect()
         const vh = window.innerHeight
         const total = r.height - vh
         const inView = r.top < vh * 0.45 && r.bottom > vh * 0.55
         if (!inView) {
            if (playing) {
               if (cur > -1) halt(cur)
               playing = false
            }
            return
         }
         const p = Math.min(0.9999, Math.max(0, -r.top / total))
         const i = Math.floor(p * N)
         thRefs.current[i]?.style.setProperty('--p', (p * N - i).toFixed(3))
         if (i !== cur || !playing) activate(i)
      }

      let tick = false
      const onScrollRaf = () => {
         if (tick) return
         tick = true
         requestAnimationFrame(() => {
            tick = false
            onScroll()
         })
      }
      const onVis = () => {
         if (document.hidden) {
            stopAll()
            playing = false
         } else onScroll()
      }

      scrollToThesis.current = i => {
         const track = trackRef.current
         if (!mqP.matches || !track) return
         const r = track.getBoundingClientRect()
         const total = r.height - window.innerHeight
         window.scrollTo({ top: window.scrollY + r.top + ((i + 0.5) / N) * total, behavior: 'smooth' })
      }

      window.addEventListener('scroll', onScrollRaf, { passive: true })
      window.addEventListener('resize', onScroll)
      document.addEventListener('visibilitychange', onVis)

      // стопка (мобильный / планшет без reduced-motion): сцена играет, когда видна
      const observers: IntersectionObserver[] = []
      if (!mqR.matches && 'IntersectionObserver' in window) {
         sceneRefs.current.forEach((el, i) => {
            if (!el) return
            const io = new IntersectionObserver(
               en => {
                  if (mqP.matches) return
                  if (en[0].isIntersecting) play(i)
                  else halt(i)
               },
               { threshold: 0.5 }
            )
            io.observe(el)
            observers.push(io)
         })
      }
      onScroll()

      return () => {
         window.removeEventListener('scroll', onScrollRaf)
         window.removeEventListener('resize', onScroll)
         document.removeEventListener('visibilitychange', onVis)
         observers.forEach(o => o.disconnect())
         for (let i = 0; i < N; i++) stop(i)
      }
   }, [query])

   const thesis = (i: number, scene: ReactNode) => (
      <li
         key={i}
         ref={el => {
            thRefs.current[i] = el
         }}
         className={s.th}
         data-active={active === i}
         data-reveal
      >
         <div className={s.thB}>
            <button className={s.thT} type='button' onClick={() => scrollToThesis.current(i)}>
               <h3>{t(`th${i + 1}_t`)}</h3>
            </button>
            <div className={s.thD}>
               <div>
                  <p>{t(`th${i + 1}_d`)}</p>
               </div>
            </div>
         </div>
         {scene}
      </li>
   )

   const lockedRow = (id: StudentId, mine?: boolean) => (
      <li key={id} className={cx(s.srow, mine && s.mine)}>
         <span className={s.ava}>
            <Ava id={id} />
         </span>
         <div>
            <b>{t(`student_${id}`)}</b>
            <small>{t('personal_sub')}</small>
         </div>
         <div className={s.srS}>
            {mine ? (
               <span className={s.fchip}>
                  <FileTile type='pdf' icon='doc' />
                  <span>{t('file_1')}</span>
               </span>
            ) : (
               <span className={s.tlock}>
                  <Lock className={s.ic} aria-hidden='true' />
                  {t('locked')}
               </span>
            )}
         </div>
      </li>
   )

   const scene = (i: number, className: string, children: ReactNode, extra?: Record<string, string | number>) => (
      <div
         ref={el => {
            sceneRefs.current[i] = el
         }}
         className={cx(s.scene, className)}
         aria-hidden='true'
         {...extra}
      >
         {children}
      </div>
   )

   return (
      <section className={s.how} id='how' aria-labelledby='sl-how-h'>
         <div className={s.howIn}>
            <div className={s.howTrack} ref={trackRef}>
               <div className={s.pin}>
                  <h2 id='sl-how-h'>{t('how_title')}</h2>
                  <ol className={s.ths}>
                     {thesis(
                        0,
                        scene(
                           0,
                           cx(s.sc1, s1Pre && s.pre),
                           <>
                              <div className={s.scTop}>
                                 <FolderTile color='#f2b134' />
                                 <b>{t('folder_3')}</b>
                              </div>
                              <ul>
                                 {lockedRow('anna', true)}
                                 {lockedRow('ilya')}
                                 {lockedRow('maria')}
                                 {lockedRow('kirill')}
                              </ul>
                           </>
                        )
                     )}
                     {thesis(
                        1,
                        scene(
                           1,
                           cx(s.sc2, s2Closed && s.closed),
                           <>
                              <div className={s.scTop}>
                                 <FolderTile color='#8b6cf6' />
                                 <b>{t('folder_2')}</b>
                                 <span className={cx(s.pill, s.pOpen)}>
                                    <Eye className={s.ic} aria-hidden='true' />
                                    {t('pill_open')}
                                 </span>
                                 <span className={cx(s.pill, s.pClosed)}>
                                    <Lock className={s.ic} aria-hidden='true' />
                                    {t('pill_closed')}
                                 </span>
                              </div>
                              <div className={s.week}>
                                 {[1, 2, 3, 4, 5, 6, 7].map(d => (
                                    <div key={d} className={cx(s.wd, d <= 4 && s.wdOn)}>
                                       {t(`wd${d}`)}
                                       <i />
                                    </div>
                                 ))}
                              </div>
                              <div className={s.sc2Foot}>
                                 <div className={s.miniStack}>
                                    <div className={s.row}>
                                       <span className={s.ava}>
                                          <Ava id='anna' />
                                       </span>
                                       <span className={s.ava}>
                                          <Ava id='ilya' />
                                       </span>
                                       <span className={s.ava}>
                                          <Ava id='maria' />
                                       </span>
                                    </div>
                                    {t('access')}
                                 </div>
                                 <span className={cx(s.btnS, s2Press && s.press)}>
                                    <span className={s.bClose}>
                                       <Lock className={s.ic} aria-hidden='true' />
                                       {t('close_access')}
                                    </span>
                                    <span className={s.bOpen}>
                                       <Eye className={s.ic} aria-hidden='true' />
                                       {t('open_access')}
                                    </span>
                                 </span>
                              </div>
                           </>
                        )
                     )}
                     {thesis(
                        2,
                        scene(
                           2,
                           s.sc3,
                           <>
                              <div className={s.scTop}>
                                 <FolderTile color='#2fb67a' />
                                 <b>{t('folder_2')}</b>
                                 <span className={cx(s.pill, s.pD)}>
                                    <Clock className={s.ic} aria-hidden='true' />
                                    {t('deadline')}
                                 </span>
                              </div>
                              <div className={s.hrow}>
                                 <span className={s.ava}>
                                    <Ava id='maria' />
                                 </span>
                                 <div>
                                    <b>{t('student_maria')}</b>
                                    <div className={s.hcell}>
                                       <span className={s.fchip}>
                                          <FileTile type='docx' icon='doc' />
                                          <span>{t('file_3')}</span>
                                       </span>
                                    </div>
                                 </div>
                                 <span className={cx(s.ss, s.ss2, s.ssStatic)}>
                                    <Check className={s.ic} aria-hidden='true' />
                                    {t('st_checked')}
                                 </span>
                              </div>
                              <div className={s.hrow}>
                                 <span className={s.ava}>
                                    <Ava id='kirill' />
                                 </span>
                                 <div>
                                    <b>{t('student_kirill')}</b>
                                    <div className={s.hcell}>
                                       <span className={s.slot}>
                                          <Upload className={s.ic} aria-hidden='true' />
                                          {t('upload_work')}
                                       </span>
                                       <span className={s.fchip}>
                                          <FileTile type='docx' icon='doc' />
                                          <span>{t('file_3')}</span>
                                       </span>
                                    </div>
                                 </div>
                                 <span className={cx(s.ss, s.ss0)}>{t('st_wait')}</span>
                                 <span className={cx(s.ss, s.ss1)}>{t('st_sent')}</span>
                                 <span className={cx(s.ss, s.ss2)}>
                                    <Check className={s.ic} aria-hidden='true' />
                                    {t('st_checked')}
                                 </span>
                              </div>
                           </>,
                           { 'data-st': s3St }
                        )
                     )}
                     {thesis(
                        3,
                        scene(
                           3,
                           cx(s.sc4, s4Pre && s.pre),
                           <>
                              <div className={s.sfield}>
                                 <Search className={s.ic} aria-hidden='true' />
                                 <span>
                                    <span>{typed}</span>
                                    <i className={s.caret} />
                                 </span>
                              </div>
                              <div className={s.res}>
                                 <div className={s.rrow}>
                                    <FileTile type='pdf' icon='doc' />
                                    <div>
                                       <b>{t('file_1')}</b>
                                       <p>{t.rich('res1', { m: c => <mark className={s.mark}>{c}</mark> })}</p>
                                    </div>
                                 </div>
                                 <div className={s.rrow}>
                                    <FileTile type='xlsx' icon='table' />
                                    <div>
                                       <b>{t('file_4')}</b>
                                       <p>{t.rich('res2', { m: c => <mark className={s.mark}>{c}</mark> })}</p>
                                    </div>
                                 </div>
                              </div>
                           </>
                        )
                     )}
                  </ol>
                  <div className={s.howCta}>
                     <CtaLink />
                  </div>
               </div>
            </div>
         </div>
      </section>
   )
}
