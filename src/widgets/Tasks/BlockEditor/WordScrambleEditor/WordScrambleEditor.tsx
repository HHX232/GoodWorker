'use client'
import {useActions} from '@/features/hooks/store/useActions'
import {WordScrambleMode, WordScramblePayload} from '@/shared/types/Tasks/TaskPayload.type'
import {CaseSensitiveIcon, EyeIcon, LetterTextIcon, PencilIcon, ShuffleIcon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useMemo, useState} from 'react'
import styles from './WordScrambleEditor.module.scss'
import {getShuffledItems, StudentViewWordScramble} from './StudentViewWordScramble/StudentViewWordScramble'

interface Props {
  blockId: string
  payload: WordScramblePayload
}

export const WordScrambleEditor = ({blockId, payload}: Props) => {
  const t = useTranslations('TaskEditors')
  const {updateBlockPayload} = useActions()
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  const update = (patch: Partial<WordScramblePayload>) =>
    updateBlockPayload({id: blockId, payload: {...payload, ...patch}})

  const shuffledItems = useMemo(
    () => (payload.source ? getShuffledItems(payload.source, payload.mode) : []),
    [payload.source, payload.mode]
  )

  const canPreview = !!payload.source?.trim()

  return (
    <div className={styles.box}>
      <div className={styles.mode_bar}>
        <button
          type='button'
          className={`${styles.mode_btn} ${mode === 'edit' ? styles.mode_btn_active : ''}`}
          onClick={() => setMode('edit')}
        >
          <PencilIcon size={13} /> {t('editor')}
        </button>
        <button
          type='button'
          className={`${styles.mode_btn} ${mode === 'preview' ? styles.mode_btn_active : ''}`}
          onClick={() => setMode('preview')}
          disabled={!canPreview}
          title={!canPreview ? t('enterWordOrSentence') : undefined}
        >
          <EyeIcon size={13} /> {t('studentPreview')}
        </button>
      </div>

      {mode === 'edit' && (
        <>
          <div className={styles.field}>
            <span className={styles.label}>{t('wordMode')}</span>
            <div className={styles.mode_tabs}>
              {(['letters', 'words'] as WordScrambleMode[]).map((m) => (
                <button
                  key={m}
                  type='button'
                  className={`${styles.mode_tab} ${payload.mode === m ? styles.mode_tab_active : ''}`}
                  onClick={() => update({mode: m, source: null})}
                >
                  {m === 'letters'
                    ? <><CaseSensitiveIcon size={14} /> {t('modeLetters')}</>
                    : <><LetterTextIcon size={14} /> {t('modeWords')}</>}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{payload.mode === 'letters' ? t('wordLabel') : t('sentenceLabel')}</label>
            <input
              className={styles.input}
              placeholder={payload.mode === 'letters' ? t('exampleWord') : t('exampleSentence')}
              value={payload.source ?? ''}
              onChange={(e) => update({source: e.target.value || null})}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('hintLabel')}</label>
            <input
              className={styles.input}
              placeholder={t('hintPlaceholder')}
              value={payload.hint ?? ''}
              onChange={(e) => update({hint: e.target.value || null})}
            />
          </div>

          {shuffledItems.length > 0 && (
            <div className={styles.editor_preview}>
              <div className={styles.editor_preview_header}>
                <ShuffleIcon size={12} />
                <span className={styles.label}>{t('shuffledView')}</span>
              </div>
              <div className={styles.tiles_row}>
                {shuffledItems.map((item, i) => (
                  <div key={i} className={`${styles.tile} ${styles.tile_static}`}>
                    {item}
                  </div>
                ))}
              </div>
              <div className={styles.answer_row}>
                <span className={styles.answer_label}>{t('correctAnswer')}</span>
                <span className={styles.answer_value}>{payload.source}</span>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'preview' && canPreview && (
        <div className={styles.preview_wrap}>
          <div className={styles.preview_label}>
            <EyeIcon size={13} /> {t('studentSees')}
          </div>
          <StudentViewWordScramble
            source={payload.source!}
            mode={payload.mode}
            hint={payload.hint}
            shuffledItems={shuffledItems}
          />
        </div>
      )}
    </div>
  )
}
