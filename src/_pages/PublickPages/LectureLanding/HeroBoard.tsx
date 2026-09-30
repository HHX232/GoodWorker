'use client'

import { CameraIcon, CheckIcon, CopyCheckIcon, CornerDownRightIcon, PlusIcon, RotateCcwIcon, SparklesIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { DocBlocks, type Block } from './Doc'
import { HeroCopy, useReducedMotion } from './shared'
import s from './LectureLanding.module.scss'

type Action = 'duplicate' | 'continuation' | 'new'
interface PlanItem { action: Action; where: string; reason: string; blocks: Block[] }
interface Shot { name: string; chalk: string[]; notes: Block[]; plan: PlanItem[] }
type Stage = 'idle' | 'scanning' | 'plan' | 'applied'

const ICON = { duplicate: CopyCheckIcon, continuation: CornerDownRightIcon, new: PlusIcon } as const

/**
 * Hero C — «Фото доски»: pick a board, «Разобрать фото» — a flash, a scan, then
 * the AI's plan exactly as the real dialog shows it (already there /
 * continuation after … / new), and «Применить» puts each piece in its place.
 */
export function HeroBoard() {
  const t = useTranslations('lectureLanding')
  const shots = t.raw('board.shots') as Shot[]
  const reduced = useReducedMotion()
  const [pick, setPick] = useState(0)
  const [stage, setStage] = useState<Stage>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const shot = shots[pick]

  const choose = (i: number) => { if (timer.current) clearTimeout(timer.current); setPick(i); setStage('idle') }
  const snap = () => {
    setStage('scanning')
    timer.current = setTimeout(() => setStage('plan'), reduced ? 0 : 1800)
  }

  // Applied: continuations right after the notes they continue, new pieces at the end.
  const after: Block[] = [...shot.notes]
  const fresh = new Set<number>()
  if (stage === 'applied') {
    for (const item of shot.plan.filter(p => p.action === 'continuation')) for (const b of item.blocks) { fresh.add(after.length); after.push(b) }
    for (const item of shot.plan.filter(p => p.action === 'new')) for (const b of item.blocks) { fresh.add(after.length); after.push(b) }
  }

  return (
    <section className={s.hero}>
      <div className={`${s.wrap} ${s.heroGrid}`}>
        <HeroCopy hint={t('board.hint')} />
        <div>
          <div className={s.boardStage}>
            <div>
              <div className={s.photo} role="img" aria-label={shot.chalk.join('. ')}>
                <div className={s.chalk}>{shot.chalk.map((c, i) => <span key={i}>{c}</span>)}</div>
                {stage === 'scanning' && <><div className={s.flash} /><div className={s.scan} /></>}
              </div>
              <div className={s.shots} role="tablist" aria-label={t('board.pick')}>
                {shots.map((sh, i) => (
                  <button key={sh.name} type="button" role="tab" aria-selected={pick === i} className={`${s.shot} ${pick === i ? s.shotOn : ''}`} onClick={() => choose(i)}>{sh.name}</button>
                ))}
              </div>
              {stage === 'idle' && <button type="button" className={`${s.cta} ${s.snapBtn}`} onClick={snap}><CameraIcon size={18} /> {t('board.snap')}</button>}
              {stage === 'applied' && <button type="button" className={`${s.ghost} ${s.snapBtn}`} onClick={() => choose((pick + 1) % shots.length)}><RotateCcwIcon size={16} /> {t('board.again')}</button>}
            </div>

            <div className={s.planCard}>
              {stage === 'plan' ? (
                <>
                  <div className={s.paneLabel}><SparklesIcon size={12} /> {t('board.found')}</div>
                  {shot.plan.map((item, i) => {
                    const Icon = ICON[item.action]
                    return (
                      <div key={i} className={s.planItem} style={{ animationDelay: `${i * 0.12}s` }}>
                        <div className={s.planHead}>
                          <span className={`${s.tag} ${s[`tag_${item.action}`]}`}><Icon size={12} /> {t(`board.tags.${item.action}`)}</span>
                          <span className={s.planWhere}>{item.where}</span>
                        </div>
                        <div className={s.planReason}>{item.reason}</div>
                        {item.blocks.length > 0 && <DocBlocks blocks={item.blocks} />}
                      </div>
                    )
                  })}
                  <button type="button" className={s.cta} style={{ justifyContent: 'center' }} onClick={() => setStage('applied')}><CheckIcon size={17} /> {t('board.apply')}</button>
                </>
              ) : (
                <>
                  <div className={s.paneLabel}>{stage === 'applied' ? <><CheckIcon size={12} /> {t('board.applied')}</> : stage === 'scanning' ? <><SparklesIcon size={12} /> {t('board.scanning')}</> : t('board.notesTitle')}</div>
                  <div className={s.planNotes}><DocBlocks blocks={after} fresh={fresh} /></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
