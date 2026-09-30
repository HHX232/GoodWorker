'use client'

import { BoxIcon, CameraIcon, ChevronLeftIcon, Grid3x3Icon, LineChartIcon, RotateCcwIcon, SigmaIcon, SparklesIcon, XIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { DocBlocks, type Block } from './Doc'
import { HeroCopy } from './shared'
import s from './LectureLanding.module.scss'

type Compression = 'none' | 'medium' | 'strong'
type Added = { key: number; blocks: Block[] }

/**
 * Hero B — «Рабочий стол»: the real three-column page in miniature, and all of
 * it clickable — compression, «Спросить ИИ» on a paragraph (a table or a
 * simpler explanation, inserted after it or replacing it), tools that drop a
 * graph / board / matrix / formula into the notes, a board photo.
 */
export function HeroDesk() {
  const t = useTranslations('lectureLanding')
  const notes = t.raw('desk.notes') as Record<Compression, Block[]>
  const [compression, setCompression] = useState<Compression>('none')
  const [selected, setSelected] = useState<number | null>(null)
  const [askAfter, setAskAfter] = useState(true)
  const [thinking, setThinking] = useState(false)
  const [after, setAfter] = useState<Record<number, Added[]>>({})
  const [replaced, setReplaced] = useState<Record<number, Added>>({})
  const [tail, setTail] = useState<Added[]>([])
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const base = notes[compression]
  const reset = () => { setAfter({}); setReplaced({}); setTail([]); setSelected(null) }
  const pickCompression = (c: Compression) => { setCompression(c); reset() }
  const add = (blocks: Block[]) => setTail(prev => [...prev, { key: ++seq.current, blocks }])

  const ask = (kind: 'table' | 'explain') => {
    if (selected === null || thinking) return
    const idx = selected
    const blocks: Block[] = kind === 'table' ? [{ t: 'table', v: t.raw('desk.table') as string[][] }] : [{ t: 'p', v: t('desk.explain') }]
    setThinking(true)
    timer.current = setTimeout(() => {
      setThinking(false)
      setSelected(null)
      if (askAfter) setAfter(prev => ({ ...prev, [idx]: [...(prev[idx] ?? []), { key: ++seq.current, blocks }] }))
      else setReplaced(prev => ({ ...prev, [idx]: { key: ++seq.current, blocks } }))
    }, 900)
  }

  const tools = [
    { id: 'graph', icon: <LineChartIcon size={17} />, blocks: [{ t: 'graph' }] as Block[] },
    { id: 'board', icon: <BoxIcon size={17} />, blocks: [{ t: 'board' }] as Block[] },
    { id: 'matrix', icon: <Grid3x3Icon size={17} />, blocks: [{ t: 'math', v: t.raw('desk.matrix') as string }] as Block[] },
    { id: 'formula', icon: <SigmaIcon size={17} />, blocks: [{ t: 'math', v: t.raw('desk.formula') as string }] as Block[] },
  ]

  return (
    <section className={s.hero}>
      <div className={s.wrap}>
        <HeroCopy center hint={t('desk.hint')} />
        <div className={s.desk}>
          {/* Left rail: recording + AI control */}
          <div className={s.rail}>
            <div className={`${s.panel} ${s.deskOrb}`}>
              <span className={`${s.orbBtn} ${s.orbRec}`} aria-hidden><i /><i /><b /></span>
              <div className={s.clock} style={{ alignItems: 'center' }}><strong>00:41:07</strong><small>{t('desk.state')}</small></div>
            </div>
            <div className={s.panel}>
              <div className={s.panelTitle}><SparklesIcon size={12} /> {t('desk.aiControl')}</div>
              <button type="button" className={s.photoBtn} onClick={() => add([{ t: 'board' }, { t: 'p', v: (t.raw('board.shots') as { chalk: string[] }[])[0].chalk[1] }])}>
                <CameraIcon size={18} /> {t('desk.photo')}
              </button>
              <div className={s.tabs} style={{ display: 'flex', marginTop: 12 }} role="tablist" aria-label={t('live.compression')}>
                {(['none', 'medium', 'strong'] as const).map(c => (
                  <button key={c} type="button" role="tab" aria-selected={compression === c} className={compression === c ? s.tabOn : ''} style={{ flex: 1 }} onClick={() => pickCompression(c)}>{t(`live.${c}`)}</button>
                ))}
              </div>
              <div className={s.switchRow} style={{ marginTop: 12 }}>{t('desk.auto')} <span className={s.toggle} aria-hidden /></div>
            </div>
          </div>

          {/* The document */}
          <div className={s.deskDoc}>
            <div className={s.deskFile}><span><ChevronLeftIcon size={13} style={{ verticalAlign: -2 }} /> {t('desk.allLectures')} / <strong>{t('desk.file')}</strong></span></div>
            {base.map((b, i) => {
              const rep = replaced[i]
              return (
                <div key={`${compression}-${i}`}>
                  <div
                    className={`${s.clickable} ${selected === i ? s.selected : ''} ${rep ? s.fresh : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(selected === i ? null : i)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(selected === i ? null : i) } }}
                  >
                    <DocBlocks key={rep?.key ?? 'base'} blocks={rep?.blocks ?? [b]} />
                  </div>
                  {selected === i && (
                    <div className={s.askPop} style={{ position: 'relative', left: 0, right: 0, margin: '4px 0 12px' }}>
                      <div className={s.askHead}>
                        <span className={s.aiChip}><SparklesIcon size={12} /> {t('desk.ask')}</span>
                        {thinking ? <span className={s.thinking} aria-hidden><span /><span /><span /></span> : <button type="button" className={s.chip} style={{ height: 26, padding: '0 8px' }} onClick={() => setSelected(null)} aria-label="×"><XIcon size={13} /></button>}
                      </div>
                      <div className={s.chips}>
                        <button type="button" className={s.chip} disabled={thinking} onClick={() => ask('table')}>{t('desk.askTable')}</button>
                        <button type="button" className={s.chip} disabled={thinking} onClick={() => ask('explain')}>{t('desk.askExplain')}</button>
                      </div>
                      <label className={s.askAfter}><input type="checkbox" checked={askAfter} onChange={e => setAskAfter(e.target.checked)} /> {t('desk.askAfter')}</label>
                    </div>
                  )}
                  {(after[i] ?? []).map(a => <div key={a.key} className={s.fresh}><DocBlocks blocks={a.blocks} /></div>)}
                </div>
              )
            })}
            {tail.map(a => <div key={a.key} className={s.fresh}><DocBlocks blocks={a.blocks} /></div>)}
          </div>

          {/* Right rail: tools */}
          <div className={s.rail}>
            <div className={s.panel}>
              <div className={s.panelTitle}>{t('desk.text')}</div>
              <div className={s.tools}>
                {tools.map(tool => (
                  <button key={tool.id} type="button" className={s.tool} onClick={() => add(tool.blocks)}>
                    <span>{tool.icon}</span>{t(`desk.tools.${tool.id}`)}
                  </button>
                ))}
              </div>
              <button type="button" className={s.replay} style={{ position: 'static', width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={reset}>
                <RotateCcwIcon size={13} /> {t('desk.tools.reset')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
