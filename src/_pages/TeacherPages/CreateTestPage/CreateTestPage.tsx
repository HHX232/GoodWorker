'use client'

import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {useSaveTest} from '@/features/hooks/Test/useSaveTest'
import {SaveTestButton} from '@/features/Tasks/UI/SaveTestButton'
import {TaskMenu} from '@/shared/ui'
import {TextAreaUI, TextInputUI} from '@/shared/ui/inputs'
import {CategorySelect} from '@/shared/ui/inputs/CategorySelect/CategorySelect'
import {InvalidTestBlocksContext} from '@/shared/ui/Tasks/providers/InvalidBlocksContext/InvalidBlocksContext'
import {NavBar} from '@/widgets/BaseUI'
import {TaskCanvas} from '@/widgets/Tasks/TaskCanvas/TaskCanvas'
import {PdfImportModal} from '@/widgets/Tests/PdfImportModal/PdfImportModal'
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {useTranslations} from 'next-intl'
import {useSearchParams} from 'next/navigation'
import {Suspense, useRef, useState} from 'react'
import styles from './CreateTestPage.module.scss'

function CreateTestPage() {
  const t = useTranslations('CreateTestPage')
  const {setTitle, setDescription, addBlocks} = useActions()
  const {description, title} = useTypedSelector((state) => state.tasks)
  const searchParams = useSearchParams()
  const existingId = searchParams.get('id') ?? undefined
  const {invalidBlockIds, errorsMap, clearInvalidBlock} = useSaveTest(existingId)
  const mainContentRef = useRef<HTMLDivElement>(null)
  const {setCategoryIds} = useActions()
  const {categoryIds} = useTypedSelector((s) => s.tasks)
  const [pdfModalOpen, setPdfModalOpen] = useState(false)

  return (
    <InvalidTestBlocksContext.Provider value={{ids: invalidBlockIds, errors: errorsMap, clear: clearInvalidBlock}}>
      <div className={`container default_content ${styles.content}`}>
        <NavBar />

        <div className={styles.main_content} ref={mainContentRef}>
          <div className={styles.page_header}>
            <h1>{t('title')}</h1>
            <button
              type='button'
              className={styles.pdf_import_btn}
              onClick={() => setPdfModalOpen(true)}
            >
              <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/>
                <polyline points='14 2 14 8 20 8'/>
                <line x1='12' y1='18' x2='12' y2='12'/>
                <polyline points='9 15 12 12 15 15'/>
              </svg>
              {t('pdfImportBtn')}
            </button>
          </div>

          <form className={styles.form}>
            <div className={styles.category_form}>
              <div className={styles.inputs_box}>
                <TextInputUI
                  helpTitle='name'
                  theme='newWhite'
                  placeholder={t('namePlaceholder')}
                  currentValue={title}
                  onSetValue={setTitle}
                />
              </div>
              <TextAreaUI
                helpTitle='description'
                maxRows={15}
                minRows={0}
                placeholder={t('descriptionPlaceholder')}
                currentValue={description}
                onSetValue={setDescription}
              />
              <CategorySelect
                placeholder={t('categoryPlaceholder')}
                canSelectMany={false}
                value={categoryIds}
                onChange={setCategoryIds}
              />{' '}
            </div>

            <Suspense fallback={<div>{t('loading')}</div>}>
              <TaskCanvas />
            </Suspense>
          </form>
          <SaveTestButton existingId={searchParams.get('id') ?? undefined} />
        </div>

        <Suspense>
          <TaskMenu mainContentRef={mainContentRef} />
        </Suspense>
      </div>

      {pdfModalOpen && (
        <PdfImportModal
          onClose={() => setPdfModalOpen(false)}
          onImport={(blocks) => addBlocks(blocks as TestBlock[])}
        />
      )}
    </InvalidTestBlocksContext.Provider>
  )
}

export default CreateTestPage
