'use client'

import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {useSaveTest} from '@/features/hooks/Test/useSaveTest'
import {SaveTestButton} from '@/features/Tasks/UI/SaveTestButton'
import {TaskMenu} from '@/shared/ui'
import {TextAreaUI, TextInputUI} from '@/shared/ui/inputs'
import {InvalidTestBlocksContext} from '@/shared/ui/Tasks/providers/InvalidBlocksContext/InvalidBlocksContext'
import {NavBar} from '@/widgets/BaseUI'
import {TaskCanvas} from '@/widgets/Tasks/TaskCanvas/TaskCanvas'
import {useTranslations} from 'next-intl'
import {useSearchParams} from 'next/navigation'
import {Suspense} from 'react'
import styles from './CreateTestPage.module.scss'

function CreateTestPage() {
  const t = useTranslations('CreateTestPage')
  const {setTitle, setDescription, setTheme} = useActions()
  const {description, theme, title} = useTypedSelector((state) => state.tasks)
  const searchParams = useSearchParams()
  const existingId = searchParams.get('id') ?? undefined
  const {save, status, invalidBlockIds, errorsMap, clearInvalidBlock} = useSaveTest(existingId)

  return (
    <InvalidTestBlocksContext.Provider value={{ids: invalidBlockIds, errors: errorsMap, clear: clearInvalidBlock}}>
      <div className={`container default_content ${styles.content}`}>
        <NavBar />

        <div className={styles.main_content}>
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
                <TextInputUI
                  helpTitle='theme'
                  theme='newWhite'
                  placeholder={t('themePlaceholder')}
                  currentValue={theme}
                  onSetValue={setTheme}
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
            </div>

            <Suspense fallback={<div>{t('loading')}</div>}>
              <TaskCanvas />
            </Suspense>
          </form>
          <SaveTestButton existingId={searchParams.get('id') ?? undefined} />
        </div>

        <Suspense>
          <TaskMenu />
        </Suspense>
      </div>
    </InvalidTestBlocksContext.Provider>
  )
}

export default CreateTestPage
