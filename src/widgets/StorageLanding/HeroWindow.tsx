'use client'

import { ArrowLeft, ChevronRight, Folder, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
   useCallback,
   useEffect,
   useLayoutEffect,
   useReducer,
   useRef,
   useState,
   type KeyboardEvent,
   type PointerEvent
} from 'react'
import {
   FILES,
   FOLDER_DEFS,
   initialState,
   reducer,
   subKs,
   type Action,
   type FolderState,
   type StudentId
} from './heroModel'
import { animate, cx, reduced, useReducedMotion } from './motion'
import s from './StorageLanding.module.scss'
import { AddAccess, Ava, Badge, FilePanel, FileTile, FolderTile, Sav, SubTile, ToastView } from './WindowParts'

const EASE = 'cubic-bezier(.16,1,.3,1)'
const COOL_MS = 6000

/**
 * Hero: живое окно «Мои файлы». Состояние — в heroModel (редьюсер), анимации — в WindowParts
 * (по пропсам), здесь: навигация/ghost-переход, автоплей «выдача → снятие → следующая папка»
 * с паузой по hover/невидимости/клику, закрытие поповера и панели по клику вне / Esc.
 */
export function HeroWindow() {
   const t = useTranslations('StorageLanding')
   const [state, dispatch] = useReducer(reducer, initialState)
   const { cur, mode, subId, panel, pop, toasts } = state
   const folder = state.folders[cur]
   const folderName = t(`folder_${cur + 1}`)
   const reducedMotion = useReducedMotion()

   const winRef = useRef<HTMLDivElement>(null)
   const mainRef = useRef<HTMLDivElement>(null)
   const viewRef = useRef<HTMLDivElement>(null)
   const navRef = useRef<HTMLDivElement>(null)
   const indRef = useRef<HTMLSpanElement>(null)
   const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
   const rowRefs = useRef<(HTMLDivElement | null)[]>([])
   const stateRef = useRef(state)
   const outT = useRef(0)
   const coolT = useRef(0)
   const ghosts = useRef(new Map<HTMLElement, number>())

   const [hover, setHover] = useState(false)
   const [hidden, setHidden] = useState(false)
   const [off, setOff] = useState(false)
   const [cool, setCool] = useState(false)
   const [tick, setTick] = useState(0)

   useEffect(() => {
      stateRef.current = state
   })

   /* переход между экранами: кросс-фейд со «слепком» старого экрана */
   const swap = useCallback((action: Action) => {
      const view = viewRef.current
      const main = mainRef.current
      window.clearTimeout(outT.current)
      if (view && main && !reduced()) {
         const ghost = view.cloneNode(true) as HTMLElement
         const vr = view.getBoundingClientRect()
         const mr = main.getBoundingClientRect()
         ghost.removeAttribute('id')
         ghost.setAttribute('aria-hidden', 'true')
         ghost.inert = true
         ghost.style.cssText = `position:absolute;pointer-events:none;left:${vr.left - mr.left}px;top:${vr.top - mr.top}px;width:${vr.width}px;`
         main.appendChild(ghost)
         animate(
            ghost,
            [
               { opacity: 1, transform: 'none' },
               { opacity: 0, transform: 'translateX(-12px)' }
            ],
            { duration: 220, easing: 'ease-in', fill: 'forwards' }
         )
         ghosts.current.set(
            ghost,
            window.setTimeout(() => {
               ghost.remove()
               ghosts.current.delete(ghost)
            }, 300)
         )
      }
      dispatch(action)
   }, [])

   // вход нового экрана: элементы [data-a] выезжают каскадом (не на первом рендере)
   const viewKey = `${cur}|${mode}|${subId}`
   const prevKey = useRef(viewKey)
   useLayoutEffect(() => {
      if (prevKey.current === viewKey) return
      prevKey.current = viewKey
      viewRef.current?.querySelectorAll('[data-a]').forEach((el, i) => {
         animate(
            el,
            [
               { opacity: 0, transform: 'translateY(10px)' },
               { opacity: 1, transform: 'none' }
            ],
            { duration: 520, delay: i * 55, easing: EASE, fill: 'backwards' }
         )
      })
   }, [viewKey])

   // отпустившие аватары/плитки больше не нужны в списках — «свежесть» гасим после первого коммита
   useEffect(() => {
      if (state.folders.some(f => f.access.some(e => e.fresh))) dispatch({ type: 'settle' })
   }, [state.folders])

   /* индикатор активной папки в сайдбаре */
   const moveInd = useCallback(() => {
      const b = btnRefs.current[cur]
      const ind = indRef.current
      const nav = navRef.current
      if (!b || !ind) return
      ind.style.opacity = mode === 'root' ? '0' : '1'
      ind.style.width = `${b.offsetWidth}px`
      ind.style.height = `${b.offsetHeight}px`
      ind.style.transform = `translate(${b.offsetLeft}px,${b.offsetTop}px)`
      if (mode !== 'root' && nav && nav.scrollWidth > nav.clientWidth) {
         nav.scrollTo({ left: Math.max(0, b.offsetLeft - 12), behavior: reduced() ? 'auto' : 'smooth' })
      }
   }, [cur, mode])
   useLayoutEffect(() => {
      moveInd()
   }, [moveInd])
   useEffect(() => {
      window.addEventListener('resize', moveInd)
      window.addEventListener('load', moveInd)
      document.fonts?.ready.then(moveInd)
      return () => {
         window.removeEventListener('resize', moveInd)
         window.removeEventListener('load', moveInd)
      }
   }, [moveInd])

   /* панель файла */
   const closePanel = useCallback(() => {
      const p = stateRef.current.panel
      if (!p) return
      window.clearTimeout(outT.current)
      rowRefs.current[p.k]?.focus({ preventScroll: true })
      dispatch({ type: 'panelClosing' })
      outT.current = window.setTimeout(() => dispatch({ type: 'panelDone' }), reduced() ? 0 : 260)
   }, [])

   /* клик вне блока доступа закрывает поповер; Esc: поповер, затем панель */
   useEffect(() => {
      const onClick = (e: MouseEvent) => {
         if (!(e.target as Element).closest('[data-acc]')) dispatch({ type: 'closePop' })
      }
      const onKey = (e: globalThis.KeyboardEvent) => {
         if (e.key !== 'Escape') return
         const st = stateRef.current
         if (st.pop) dispatch({ type: 'closePop' })
         else if (st.panel && !st.panel.closing) closePanel()
      }
      document.addEventListener('click', onClick)
      document.addEventListener('keydown', onKey)
      return () => {
         document.removeEventListener('click', onClick)
         document.removeEventListener('keydown', onKey)
      }
   }, [closePanel])

   /* автоплей: пауза по hover / вкладке в фоне / вне экрана / «кулдауну» после касания / глубокому экрану */
   const deep = mode !== 'folder' || panel !== null
   const running = !reducedMotion && !hover && !hidden && !off && !cool && !deep
   useEffect(() => {
      if (!running) return
      const ids = [
         window.setTimeout(() => dispatch({ type: 'autoGrant' }), 1600),
         window.setTimeout(() => dispatch({ type: 'autoRevoke' }), 4400),
         window.setTimeout(() => {
            swap({ type: 'nextFolder' })
            setTick(n => n + 1)
         }, 7800)
      ]
      return () => ids.forEach(window.clearTimeout)
   }, [running, tick, swap])

   const touch = useCallback(() => {
      window.clearTimeout(coolT.current)
      setCool(true)
      coolT.current = window.setTimeout(() => setCool(false), COOL_MS)
   }, [])

   useEffect(() => {
      const onVis = () => setHidden(document.hidden)
      document.addEventListener('visibilitychange', onVis)
      const win = winRef.current
      let io: IntersectionObserver | undefined
      if (win && 'IntersectionObserver' in window) {
         io = new IntersectionObserver(en => setOff(!en[0].isIntersecting), { threshold: 0.25 })
         io.observe(win)
      }
      const outTimer = outT
      const coolTimer = coolT
      const ghostMap = ghosts.current
      return () => {
         document.removeEventListener('visibilitychange', onVis)
         io?.disconnect()
         window.clearTimeout(outTimer.current)
         window.clearTimeout(coolTimer.current)
         ghostMap.forEach((tm, g) => {
            window.clearTimeout(tm)
            g.remove()
         })
         ghostMap.clear()
      }
   }, [])

   const onPointerEnter = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') setHover(true)
   }
   const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
         setHover(false)
         touch()
      }
   }

   const select = (i: number) => {
      if (i === cur && mode === 'folder') return
      swap({ type: 'select', i })
   }
   const openPanel = (k: number) => dispatch({ type: 'openPanel', k })
   const onRowKey = (e: KeyboardEvent<HTMLDivElement>, k: number) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
         e.preventDefault()
         touch()
         openPanel(k)
      }
   }

   const filesWord = (n: number) => t('files_count', { count: n })

   const fileRow = (f: FolderState, k: number) => {
      const def = FILES[FOLDER_DEFS[cur].f[k]]
      const name = t(`file_${def.n}`)
      return (
         <div
            key={k}
            ref={el => {
               rowRefs.current[k] = el
            }}
            className={s.fr}
            role='button'
            tabIndex={0}
            data-a
            aria-label={t('open_file_aria', { name })}
            onClick={() => openPanel(k)}
            onKeyDown={e => onRowKey(e, k)}
         >
            <FileTile type={def.t} icon={def.icon} />
            <span className={s.fn}>{name}</span>
            <span className={s.fs}>{t(`size_${def.n}`)}</span>
            <span className={s.bdw}>
               <Badge open={f.open[k]} />
            </span>
         </div>
      )
   }

   const sep = <ChevronRight className={cx(s.ic, s.sep)} aria-hidden='true' />
   const crumbs = (
      <nav className={s.crumbs} data-a aria-label={t('crumbs_aria')}>
         {mode === 'root' ? (
            <span className={cx(s.cr, s.cur)} aria-current='page'>
               {t('crumb_root')}
            </span>
         ) : (
            <>
               <button type='button' className={s.cr} onClick={() => swap({ type: 'goRoot' })}>
                  {t('crumb_root')}
               </button>
               {sep}
               {mode === 'folder' ? (
                  <span className={cx(s.cr, s.cur)} aria-current='page'>
                     {folderName}
                  </span>
               ) : (
                  <>
                     <button type='button' className={s.cr} onClick={() => swap({ type: 'goFolder' })}>
                        {folderName}
                     </button>
                     {sep}
                     <span className={cx(s.cr, s.cur)} aria-current='page'>
                        {t(`student_${subId as StudentId}`)}
                     </span>
                  </>
               )}
            </>
         )}
      </nav>
   )

   let view
   if (mode === 'root') {
      view = (
         <>
            {crumbs}
            <div className={s.fh} data-a>
               <div className={s.fhL}>
                  <FolderTile color='#5b4df0' />
                  <div>
                     <h3>{t('folders_heading')}</h3>
                     <p>{t('folders_count', { count: FOLDER_DEFS.length })}</p>
                  </div>
               </div>
            </div>
            <div className={s.cards}>
               {FOLDER_DEFS.map((g, i) => (
                  <button
                     key={i}
                     type='button'
                     className={s.fcard}
                     data-a
                     aria-label={t('open_folder_aria', { name: t(`folder_${i + 1}`) })}
                     onClick={() => select(i)}
                  >
                     <FolderTile color={g.c} />
                     <div>
                        <b>{t(`folder_${i + 1}`)}</b>
                        <small>{filesWord(g.f.length)}</small>
                     </div>
                     <span className={s.mst}>
                        {state.folders[i].access
                           .filter(e => !e.leaving)
                           .map(e => (
                              <span key={e.id} className={s.ava}>
                                 <Ava id={e.id} />
                              </span>
                           ))}
                     </span>
                  </button>
               ))}
            </div>
         </>
      )
   } else if (mode === 'sub' && subId) {
      const ks = subKs(cur, subId)
      view = (
         <>
            {crumbs}
            <div className={s.fh} data-a>
               <div className={s.fhL}>
                  <button
                     type='button'
                     className={s.back}
                     aria-label={t('back_aria', { name: folderName })}
                     onClick={() => swap({ type: 'goFolder' })}
                  >
                     <ArrowLeft className={s.ic} aria-hidden='true' />
                  </button>
                  <span className={s.avl}>
                     <Ava id={subId} />
                  </span>
                  <div>
                     <h3>{t(`student_${subId}`)}</h3>
                     <p>{t('personal_sub_files', { files: filesWord(ks.length) })}</p>
                  </div>
               </div>
               <div className={s.acc} data-acc>
                  <span className={s.accL}>{t('access')}</span>
                  <div className={s.stack}>
                     <Sav entry={{ id: subId }} plain />
                  </div>
               </div>
            </div>
            <div className={s.files}>{ks.map(k => fileRow(folder, k))}</div>
         </>
      )
   } else {
      view = (
         <>
            {crumbs}
            <div className={s.fh} data-a>
               <div className={s.fhL}>
                  <FolderTile color={FOLDER_DEFS[cur].c} />
                  <div>
                     <h3>{folderName}</h3>
                     <p>{filesWord(FOLDER_DEFS[cur].f.length)}</p>
                  </div>
               </div>
               <div className={s.acc} data-acc>
                  <span className={s.accL}>{t('access')}</span>
                  <div className={s.stack}>
                     {folder.access.map(e => (
                        <Sav key={e.id} entry={e} dispatch={dispatch} />
                     ))}
                  </div>
                  <AddAccess where='view' pop={pop} folder={folder} dispatch={dispatch} />
               </div>
            </div>
            <div className={s.subs} data-a>
               {folder.access.map(e => (
                  <SubTile key={e.id} entry={e} color={FOLDER_DEFS[cur].c} onOpen={id => swap({ type: 'openSub', id })} />
               ))}
            </div>
            <div className={s.files}>{FOLDER_DEFS[cur].f.map((_, k) => fileRow(folder, k))}</div>
         </>
      )
   }

   return (
      <div
         ref={winRef}
         className={cx(s.win, panel && s.pnlOn)}
         role='group'
         aria-label={t('win_aria')}
         onPointerEnter={onPointerEnter}
         onPointerLeave={onPointerLeave}
         onClick={touch}
      >
         <div className={s.winBar}>
            <i className={s.dot} />
            <i className={s.dot} />
            <i className={s.dot} />
            <span className={s.winTitle}>{t('win_title')}</span>
         </div>
         <div className={s.winBody}>
            <aside className={s.side}>
               <div ref={navRef} className={s.nav} role='group' aria-label={t('folders_aria')}>
                  <span ref={indRef} className={s.ind} />
                  {FOLDER_DEFS.map((f, i) => (
                     <button
                        key={i}
                        ref={el => {
                           btnRefs.current[i] = el
                        }}
                        type='button'
                        className={s.fbtn}
                        aria-current={mode !== 'root' && cur === i ? 'true' : undefined}
                        onClick={() => select(i)}
                     >
                        <FolderTile color={f.c} />
                        <span className={s.nm}>{t(`folder_${i + 1}`)}</span>
                        <span className={s.ct}>{f.f.length}</span>
                     </button>
                  ))}
               </div>
               <div className={s.me}>
                  <span className={s.brandMark}>
                     <Folder className={s.ic} aria-hidden='true' />
                  </span>
                  GoodWorker
               </div>
            </aside>
            <div ref={mainRef} className={s.main}>
               <div className={s.tb}>
                  <div className={s.search} aria-hidden='true'>
                     <Search className={s.ic} />
                     {t('search_label')}
                  </div>
                  <div className={s.quota}>
                     <span>{t('quota')}</span>
                     <i className={s.qbar}>
                        <b />
                     </i>
                  </div>
               </div>
               <div ref={viewRef} className={s.view}>
                  {view}
               </div>
               {panel && (
                  <FilePanel
                     folderIdx={cur}
                     folder={folder}
                     k={panel.k}
                     sub={mode === 'sub' ? subId : null}
                     closing={panel.closing}
                     pop={pop}
                     dispatch={dispatch}
                     onClose={closePanel}
                  />
               )}
            </div>
         </div>
         <div className={s.toasts} role='status' aria-live='polite'>
            {toasts.map(ti => (
               <ToastView key={ti.id} toast={ti} dispatch={dispatch} />
            ))}
         </div>
      </div>
   )
}
