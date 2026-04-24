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
import {useLocale, useTranslations} from 'next-intl'
import {useSearchParams} from 'next/navigation'
import {Suspense, useRef} from 'react'
import styles from './CreateTestPage.module.scss'

function CreateTestPage() {
  const t = useTranslations('CreateTestPage')
  const {setTitle, setDescription, setTheme} = useActions()
  const {description, theme, title} = useTypedSelector((state) => state.tasks)
  const searchParams = useSearchParams()
  const existingId = searchParams.get('id') ?? undefined
  const {save, status, invalidBlockIds, errorsMap, clearInvalidBlock} = useSaveTest(existingId)
  const locale = useLocale()
  const mainContentRef = useRef<HTMLDivElement>(null)
  const {setCategoryIds} = useActions()
  const {categoryIds} = useTypedSelector((s) => s.tasks)
  return (
    <InvalidTestBlocksContext.Provider value={{ids: invalidBlockIds, errors: errorsMap, clear: clearInvalidBlock}}>
      <div className={`container default_content ${styles.content}`}>
        <NavBar />

        <div className={styles.main_content} ref={mainContentRef}>
          <h1>{t('title')}</h1>

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
                placeholder='Выберите категорию теста'
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
    </InvalidTestBlocksContext.Provider>
  )
}

export default CreateTestPage
