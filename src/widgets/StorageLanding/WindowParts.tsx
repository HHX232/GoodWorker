'use client'

import { AudioLines, Check, ChevronRight, Eye, FileText, Folder, Lock, Plus, Table, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useLayoutEffect, useRef, type Dispatch } from 'react'
import {
   FILES,
   FOLDER_DEFS,
   GENDER,
   ORDER,
   activeIds,
   type Action,
   type Entry,
   type FileIconName,
   type FileType,
   type FolderState,
   type PopWhere,
   type StudentId,
   type ToastItem
} from './heroModel'
import { animate, cx, reduced, type CssVars } from './motion'
import s from './StorageLanding.module.scss'

const SPRING = 'cubic-bezier(.34,1.3,.64,1)'
const EASE = 'cubic-bezier(.16,1,.3,1)'

export function Ava({ id, className }: { id: StudentId; className?: string }) {
   return (
      <svg className={className ?? s.av} viewBox='0 0 40 40' aria-hidden='true'>
         <use href={`#sl-av-${id}`} />
      </svg>
   )
}

export function FileIcon({ icon }: { icon: FileIconName }) {
   const Icon = icon === 'wave' ? AudioLines : icon === 'table' ? Table : FileText
   return <Icon className={s.ic} aria-hidden='true' />
}

const FT_CLASS: Record<FileType, string> = { pdf: s.ftPdf, mp3: s.ftMp3, docx: s.ftDocx, xlsx: s.ftXlsx }

export function FileTile({ type, icon }: { type: FileType; icon: FileIconName }) {
   return (
      <span className={cx(s.ft, FT_CLASS[type])}>
         <FileIcon icon={icon} />
      </span>
   )
}

export function FolderTile({ color }: { color: string }) {
   return (
      <span className={s.fic} style={{ '--c': color } as CssVars}>
         <Folder className={s.ic} aria-hidden='true' />
      </span>
   )
}

/** «открыт» / «закрыт»: при смене состояния «выпрыгивает». */
export function Badge({ open }: { open: boolean }) {
   const t = useTranslations('StorageLanding')
   const ref = useRef<HTMLSpanElement>(null)
   const prev = useRef(open)
   useEffect(() => {
      if (prev.current !== open) {
         animate(
            ref.current,
            [
               { transform: 'scale(.5)', opacity: 0 },
               { transform: 'scale(1.12)', opacity: 1, offset: 0.6 },
               { transform: 'scale(1)' }
            ],
            { duration: 520, easing: SPRING }
         )
      }
      prev.current = open
   }, [open])
   return (
      <span ref={ref} className={cx(s.bd, open ? s.bdOpen : s.bdLock)}>
         {open ? <Eye className={s.ic} aria-hidden='true' /> : <Lock className={s.ic} aria-hidden='true' />}
         {open ? t('badge_open') : t('badge_closed')}
      </span>
   )
}

/** Аватар в стопке «Доступ»: при выдаче вырастает с кольцом, при снятии схлопывается. */
export function Sav({
   entry,
   dispatch,
   plain
}: {
   entry: Pick<Entry, 'id'> & Partial<Entry>
   dispatch?: Dispatch<Action>
   plain?: boolean
}) {
   const t = useTranslations('StorageLanding')
   const { id, fresh = false, leaving = false } = entry
   const ref = useRef<HTMLSpanElement>(null)
   const ringRef = useRef<HTMLElement>(null)
   const anim = useRef<Animation | null>(null)

   useLayoutEffect(() => {
      if (!fresh || leaving) return
      anim.current?.cancel()
      anim.current = null
      animate(
         ref.current,
         [
            { width: '0px', marginRight: '0px', transform: 'scale(0)', opacity: 0 },
            { width: '32px', marginRight: '-8px', transform: 'scale(1.14)', opacity: 1, offset: 0.6 },
            { width: '32px', marginRight: '-8px', transform: 'scale(1)', opacity: 1 }
         ],
         { duration: 560, easing: SPRING }
      )
      animate(
         ringRef.current,
         [
            { transform: 'scale(1)', opacity: 0.7 },
            { transform: 'scale(2)', opacity: 0 }
         ],
         { duration: 950, easing: 'ease-out' }
      )
   }, [fresh, leaving])

   useEffect(() => {
      if (!leaving || plain) return
      anim.current = animate(
         ref.current,
         [
            { width: '32px', marginRight: '-8px', transform: 'scale(1)', opacity: 1 },
            { width: '0px', marginRight: '0px', transform: 'scale(.3) translateY(-10px)', opacity: 0 }
         ],
         { duration: 420, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }
      )
      const tm = window.setTimeout(() => dispatch?.({ type: 'purge', id }), reduced() ? 0 : 440)
      return () => window.clearTimeout(tm)
   }, [leaving, plain, dispatch, id])

   return (
      <span ref={ref} className={s.sav} data-id={id} title={t(`student_${id}`)}>
         <Ava id={id} />
         <i ref={ringRef} className={s.ring} />
      </span>
   )
}

/** Плитка личной подпапки ученика (кнопка). */
export function SubTile({
   entry,
   color,
   onOpen
}: {
   entry: Entry
   color: string
   onOpen: (id: StudentId) => void
}) {
   const t = useTranslations('StorageLanding')
   const ref = useRef<HTMLButtonElement>(null)
   const { id, fresh, leaving } = entry

   useLayoutEffect(() => {
      if (!fresh || leaving) return
      animate(
         ref.current,
         [
            { opacity: 0, transform: 'scale(.92) translateY(8px)' },
            { opacity: 1, transform: 'scale(1.02)', offset: 0.6 },
            { opacity: 1, transform: 'none' }
         ],
         { duration: 520, easing: SPRING }
      )
   }, [fresh, leaving])

   useEffect(() => {
      if (!leaving) return
      const a = animate(
         ref.current,
         [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: 'scale(.92)' }
         ],
         { duration: 320, easing: 'ease-in', fill: 'forwards' }
      )
      return () => a?.cancel()
   }, [leaving])

   return (
      <button
         ref={ref}
         type='button'
         className={cx(s.sub, s.isOpen)}
         data-id={id}
         aria-label={t('open_sub_aria', { name: t(`student_${id}`) })}
         onClick={() => onOpen(id)}
      >
         <FolderTile color={color} />
         <div>
            <b>{t(`student_${id}`)}</b>
            <small>{t('personal_sub')}</small>
         </div>
         <ChevronRight className={cx(s.ic, s.chev)} aria-hidden='true' />
      </button>
   )
}

const TOAST_MS = 2600

export function ToastView({ toast, dispatch }: { toast: ToastItem; dispatch: Dispatch<Action> }) {
   const t = useTranslations('StorageLanding')
   const ref = useRef<HTMLDivElement>(null)
   const { id, who, kind } = toast

   useEffect(() => {
      animate(
         ref.current,
         [
            { opacity: 0, transform: 'translateY(14px) scale(.94)' },
            { opacity: 1, transform: 'none' }
         ],
         { duration: 480, easing: SPRING }
      )
      let t2 = 0
      const t1 = window.setTimeout(() => {
         animate(
            ref.current,
            [
               { opacity: 1, transform: 'none' },
               { opacity: 0, transform: 'translateY(6px) scale(.96)' }
            ],
            { duration: 260, easing: 'ease-in', fill: 'forwards' }
         )
         t2 = window.setTimeout(() => dispatch({ type: 'dismissToast', id }), reduced() ? 0 : 280)
      }, TOAST_MS)
      return () => {
         window.clearTimeout(t1)
         window.clearTimeout(t2)
      }
   }, [id, dispatch])

   const g = GENDER[who]
   const name = t(`student_${who}`)
   const gen = t(`gen_${who}`)
   const text =
      kind === 'granted'
         ? t(`toast_granted_${g}`, { name })
         : kind === 'revoked'
           ? t('toast_revoked', { name: gen })
           : kind === 'fileOpen'
             ? t('toast_file_open')
             : kind === 'fileClosed'
               ? t('toast_file_closed')
               : t(`toast_file_sub_${g}`, { name })

   return (
      <div ref={ref} className={s.toast}>
         <Ava id={who} className={s.ava} />
         <span>{text}</span>
      </div>
   )
}

/** Кнопка «Дать доступ» + поповер с учениками. */
export function AddAccess({
   where,
   pop,
   folder,
   dispatch
}: {
   where: PopWhere
   pop: PopWhere | null
   folder: FolderState
   dispatch: Dispatch<Action>
}) {
   const t = useTranslations('StorageLanding')
   const popRef = useRef<HTMLDivElement>(null)
   const isOpen = pop === where
   const have = activeIds(folder)

   useLayoutEffect(() => {
      if (!isOpen) return
      animate(
         popRef.current,
         [
            { opacity: 0, transform: 'translateY(-6px) scale(.97)' },
            { opacity: 1, transform: 'none' }
         ],
         { duration: 320, easing: EASE }
      )
   }, [isOpen])

   return (
      <>
         <button
            className={s.add}
            type='button'
            aria-haspopup='true'
            aria-expanded={isOpen}
            onClick={() => dispatch({ type: 'togglePop', where })}
         >
            <Plus className={s.ic} aria-hidden='true' />
            {t('give_access')}
         </button>
         {isOpen && (
            <div ref={popRef} className={s.pop} role='group' aria-label={t('students_aria')}>
               <div className={s.popH}>{t('whom_open')}</div>
               {ORDER.map(id => (
                  <button
                     key={id}
                     className={s.pi}
                     type='button'
                     aria-pressed={have.includes(id)}
                     onClick={() => dispatch({ type: 'toggleAccess', id })}
                  >
                     <span className={s.ava}>
                        <Ava id={id} />
                     </span>
                     <span className={s.nm}>{t(`student_${id}`)}</span>
                     <span className={s.tk}>
                        <Check className={s.ic} aria-hidden='true' />
                     </span>
                  </button>
               ))}
            </div>
         )}
      </>
   )
}

/** Правая панель файла: статус, доступ, кнопка открыть/закрыть. */
export function FilePanel({
   folderIdx,
   folder,
   k,
   sub,
   closing,
   pop,
   dispatch,
   onClose
}: {
   folderIdx: number
   folder: FolderState
   k: number
   sub: StudentId | null
   closing: boolean
   pop: PopWhere | null
   dispatch: Dispatch<Action>
   onClose: () => void
}) {
   const t = useTranslations('StorageLanding')
   const sheetRef = useRef<HTMLElement>(null)
   const stRef = useRef<HTMLElement>(null)
   const stackRef = useRef<HTMLDivElement>(null)
   const prevOpen = useRef<boolean | null>(null)

   const def = FILES[FOLDER_DEFS[folderIdx].f[k]]
   const open = folder.open[k]
   const folderName = t(`folder_${folderIdx + 1}`)
   const path = folderName + (sub ? ` › ${t(`student_${sub}`)}` : '')

   useEffect(() => {
      sheetRef.current?.focus({ preventScroll: true })
   }, [])

   // при смене статуса: бейдж «выпрыгивает», при открытии — аватары доступа пульсируют
   useEffect(() => {
      const was = prevOpen.current
      prevOpen.current = open
      if (was === null || was === open) return
      animate(
         stRef.current,
         [
            { transform: 'scale(.5)', opacity: 0 },
            { transform: 'scale(1.12)', opacity: 1, offset: 0.6 },
            { transform: 'scale(1)' }
         ],
         { duration: 520, easing: SPRING }
      )
      if (open) {
         stackRef.current?.querySelectorAll<HTMLElement>('[data-id]').forEach((n, i) => {
            animate(n, [{ transform: 'scale(.6)' }, { transform: 'scale(1.14)', offset: 0.6 }, { transform: 'scale(1)' }], {
               duration: 520,
               delay: i * 70,
               easing: SPRING
            })
            animate(
               n.querySelector('i'),
               [
                  { transform: 'scale(1)', opacity: 0.7 },
                  { transform: 'scale(2)', opacity: 0 }
               ],
               { duration: 950, delay: i * 70, easing: 'ease-out' }
            )
         })
      }
   }, [open])

   return (
      <div className={cx(s.pnl, closing && s.out)}>
         <button type='button' className={s.scrim} onClick={onClose} aria-label={t('close_panel_aria')} />
         <section ref={sheetRef} className={s.sheet} role='dialog' aria-modal='false' aria-labelledby='sl-pn-t' tabIndex={-1}>
            <div className={s.shH}>
               <FileTile type={def.t} icon={def.icon} />
               <div>
                  <h4 id='sl-pn-t'>{t(`file_${def.n}`)}</h4>
                  <p>
                     {t(`type_${def.t}`)} · {t(`size_${def.n}`)}
                  </p>
               </div>
               <button type='button' className={s.x} onClick={onClose} aria-label={t('close')}>
                  <X className={s.ic} aria-hidden='true' />
               </button>
            </div>
            <dl className={s.meta}>
               <div>
                  <dt>{t('panel_folder')}</dt>
                  <dd>{path}</dd>
               </div>
               <div>
                  <dt>{t('panel_status')}</dt>
                  <dd>
                     <span ref={stRef} className={cx(s.bd, open ? s.bdOpen : s.bdLock)}>
                        {open ? <Eye className={s.ic} aria-hidden='true' /> : <Lock className={s.ic} aria-hidden='true' />}
                        {open ? t('badge_open') : t('badge_closed')}
                     </span>
                  </dd>
               </div>
            </dl>
            <div className={s.pa}>
               <div className={s.paH}>
                  <span>{t('access')}</span>
               </div>
               <div className={s.acc} data-acc>
                  <div ref={stackRef} className={cx(s.stack, !open && s.isLocked)}>
                     {sub ? (
                        <Sav entry={{ id: sub }} plain />
                     ) : (
                        folder.access.map(e => <Sav key={e.id} entry={e} dispatch={dispatch} />)
                     )}
                  </div>
                  {!sub && <AddAccess where='panel' pop={pop} folder={folder} dispatch={dispatch} />}
               </div>
               <p className={s.pnote}>
                  {open ? (sub ? t('note_sub', { name: t(`student_${sub}`) }) : t('note_open')) : t('note_hidden')}
               </p>
            </div>
            <button type='button' className={cx(s.pb, !open && s.prim)} onClick={() => dispatch({ type: 'toggleFile' })}>
               {open ? <Lock className={s.ic} aria-hidden='true' /> : <Eye className={s.ic} aria-hidden='true' />}
               {open ? t('close_access') : t('open_access')}
            </button>
         </section>
      </div>
   )
}
