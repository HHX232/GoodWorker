'use client'

import TestService, {ITestItem} from '@/features/services/TestService.service'
import {useActions} from '@/features/hooks/store/useActions'
import {PostMiniTestPayload} from '@/shared/types/Post/Post.type'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import TestPreview from '@/widgets/Tasks/TestPreview/TestPreview'
import {useQuery} from '@tanstack/react-query'
import {CheckIcon, ClipboardCheckIcon, SearchIcon, XIcon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useMemo, useState} from 'react'
import styles from './PostBlockEditors.module.scss'

interface Props {
  blockId: string
  payload: PostMiniTestPayload
}

export function PostMiniTestBlockEditor({blockId, payload}: Props) {
  const t = useTranslations('PostBlockEditor')
  const {updatePostBlockPayload} = useActions()
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  const {data: tests = [], isLoading} = useQuery({
    queryKey: ['my-tests'],
    queryFn: () => TestService.getMyTests(),
    staleTime: 1000 * 60 * 5,
    enabled: modalOpen
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return tests
    const q = search.toLowerCase()
    return tests.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.aiTopic ?? '').toLowerCase().includes(q)
    )
  }, [tests, search])

  const select = (test: ITestItem) => {
    updatePostBlockPayload({id: blockId, payload: {testId: test.id, title: test.title}})
    setModalOpen(false)
  }

  const clear = () => {
    updatePostBlockPayload({id: blockId, payload: {testId: null, title: null}})
  }

  const getThemes = (test: ITestItem) =>
    test.testCategories
      ?.map((tc) => tc.category.translations.find((tr) => tr.langCode === 'ru')?.name ?? tc.category.slug)
      .slice(0, 3) ?? []

  const selectedTest = tests.find((t) => t.id === payload.testId)

  if (payload.testId) {
    return (
      <div className={styles.mini_test_selected}>
        <div className={styles.mini_test_badge}>
          <ClipboardCheckIcon size={14} />
          <span>Мини-тест</span>
        </div>
        {selectedTest ? (
          <TestPreview
            useLink={false}
            useBorder={true}
            testId={selectedTest.id}
            avatarUrl={selectedTest.teacher?.avatarUrl ?? 'https://i.pravatar.cc/88?img=1'}
            authorName={selectedTest.teacher?.name ?? ''}
            title={selectedTest.title}
            description={(selectedTest.content as Record<string, unknown>)?.description as string ?? ''}
            themes={getThemes(selectedTest)}
            createdAt={selectedTest.createdAt}
          />
        ) : (
          <p className={styles.test_link_id}>{payload.title ?? payload.testId}</p>
        )}
        <p className={styles.mini_test_hint}>
          При просмотре поста читатели смогут пройти этот тест прямо здесь — результат сохранится в статистику.
        </p>
        <button type='button' className={styles.test_link_clear} onClick={clear}>
          <XIcon size={12} />
          {t('testLinkChange')}
        </button>
      </div>
    )
  }

  return (
    <>
      <button type='button' className={styles.mini_test_stub} onClick={() => setModalOpen(true)}>
        <ClipboardCheckIcon size={20} className={styles.mini_test_stub_icon} />
        <div>
          <p className={styles.stub_text}>Выбрать тест для встройки</p>
          <p className={styles.stub_sub}>Читатели пройдут тест прямо в посте. Результат сохраняется в статистику.</p>
        </div>
      </button>

      <ModalWindowDefault
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        additionalTitle={<p className={styles.modal_title}>Выбрать тест (мини-тест)</p>}
      >
        <div className={styles.modal_search_wrap}>
          <SearchIcon size={14} className={styles.modal_search_icon} />
          <input
            className={styles.modal_search_input}
            placeholder={t('testLinkSearch')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && <p className={styles.modal_hint}>{t('testLinkLoading')}</p>}
        {!isLoading && filtered.length === 0 && <p className={styles.modal_hint}>{t('testLinkNoTests')}</p>}

        <div className={styles.modal_grid}>
          {filtered.map((test) => {
            const isSelected = test.id === payload.testId
            return (
              <div
                key={test.id}
                className={`${styles.modal_test_card} ${isSelected ? styles.modal_test_card_selected : ''}`}
                onClick={() => select(test)}
              >
                <div className={`${styles.modal_checkbox} ${isSelected ? styles.modal_checkbox_checked : ''}`}>
                  {isSelected && <CheckIcon size={10} />}
                </div>
                <TestPreview
                  useLink={false}
                  useBorder={false}
                  grayscale={!isSelected}
                  testId={test.id}
                  avatarUrl={test.teacher?.avatarUrl ?? 'https://i.pravatar.cc/88?img=1'}
                  authorName={test.teacher?.name ?? ''}
                  title={test.title}
                  description={(test.content as Record<string, unknown>)?.description as string ?? ''}
                  themes={getThemes(test)}
                  createdAt={test.createdAt}
                />
              </div>
            )
          })}
        </div>
      </ModalWindowDefault>
    </>
  )
}
