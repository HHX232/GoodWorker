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
import {CreateTestTutorial} from '@/widgets/Tutorial/CreateTestTutorial'
import {PdfImportModal} from '@/widgets/Tests/PdfImportModal/PdfImportModal'
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {useTranslations} from 'next-intl'
import {useSearchParams} from 'next/navigation'
import {Suspense, useEffect, useRef, useState} from 'react'
import styles from './CreateTestPage.module.scss'

function CreateTestPage() {
  const t = useTranslations('CreateTestPage')
  const {setTitle, setDescription, setTheme, addBlocks, setCategoryIds, resetConstructor} = useActions()
  const {description, title} = useTypedSelector((state) => state.tasks)
  const searchParams = useSearchParams()
  const existingId = searchParams.get('id') ?? undefined
  const {save, status, invalidBlockIds, errorsMap, clearInvalidBlock} = useSaveTest(existingId)
  const mainContentRef = useRef<HTMLDivElement>(null)
  const {categoryIds} = useTypedSelector((s) => s.tasks)
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [loadingTest, setLoadingTest] = useState(!!existingId)

  useEffect(() => {
    if (!existingId) return
    resetConstructor()
    fetch(`/api/tests/${existingId}`)
      .then(r => r.json())
      .then(data => {
        if (data.title) setTitle(data.title)
        if (data.aiTopic) setTheme(data.aiTopic)
        const content = data.content as {description?: string; blocks?: TestBlock[]}
        if (content?.description) setDescription(content.description)
        if (Array.isArray(content?.blocks) && content.blocks.length > 0) addBlocks(content.blocks)
        const ids = (data.testCategories ?? []).map((tc: {categoryId: string}) => tc.categoryId)
        if (ids.length > 0) setCategoryIds(ids)
      })
      .catch(() => {})
      .finally(() => setLoadingTest(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingId])

  if (loadingTest) {
    return (
      <div className={styles.loadingWrap}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" className={styles.loadingSpinner}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span>{t('loading')}</span>
      </div>
    )
  }

  return (
    <InvalidTestBlocksContext.Provider value={{ids: invalidBlockIds, errors: errorsMap, clear: clearInvalidBlock}}>
      <div className={`container default_content ${styles.content}`}>
        <CreateTestTutorial />
        <NavBar />

        <div className={styles.main_content} ref={mainContentRef}>
          <div className={styles.page_header} id="test-header">
            <h1>{existingId ? t('titleEdit') : t('title')}</h1>
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
            <div className={styles.category_form} id="test-form-fields">
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
              <div style={{ marginTop: '16px' }}>
                <CategorySelect
                  placeholder={t('categoryPlaceholder')}
                  canSelectMany={false}
                  value={categoryIds}
                  onChange={setCategoryIds}
                />
              </div>
            </div>

            <Suspense fallback={<div>{t('loading')}</div>}>
              <TaskCanvas />
            </Suspense>
          </form>
          <SaveTestButton save={save} status={status} />
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
