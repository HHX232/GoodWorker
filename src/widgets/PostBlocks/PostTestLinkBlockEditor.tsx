'use client'

import TestService, {ITestItem} from '@/features/services/TestService.service'
import {useActions} from '@/features/hooks/store/useActions'
import {PostTestLinkPayload, getPostTestLinks} from '@/shared/types/Post/Post.type'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import TestPreview from '@/widgets/Tasks/TestPreview/TestPreview'
import {useQuery} from '@tanstack/react-query'
import {CheckIcon, SearchIcon, XIcon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useMemo, useState} from 'react'
import styles from './PostBlockEditors.module.scss'

interface Props {
  blockId: string
  payload: PostTestLinkPayload
}

export function PostTestLinkBlockEditor({blockId, payload}: Props) {
  const t = useTranslations('PostBlockEditor')
  const {updatePostBlockPayload} = useActions()
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = getPostTestLinks(payload)
  const selectedIds = new Set(selected.map(s => s.id))

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

  const toggle = (test: ITestItem) => {
    const isOn = selectedIds.has(test.id)
    const next = isOn
      ? selected.filter(s => s.id !== test.id)
      : [...selected, {id: test.id, title: test.title}]
    updatePostBlockPayload({id: blockId, payload: {tests: next}})
  }

  const remove = (id: string) => {
    updatePostBlockPayload({id: blockId, payload: {tests: selected.filter(s => s.id !== id)}})
  }

  const getThemes = (test: ITestItem) =>
    test.testCategories
      ?.map((tc) => tc.category.translations.find((tr) => tr.langCode === 'ru')?.name ?? tc.category.slug)
      .slice(0, 3) ?? []

  return (
    <>
      {/* Selected tests list */}
      {selected.length > 0 && (
        <div className={styles.test_link_selected}>
          {selected.map(s => {
            const full = tests.find(t => t.id === s.id)
            return (
              <div key={s.id} className={styles.test_link_row}>
                {full ? (
                  <TestPreview
                    useLink={false}
                    useBorder={true}
                    testId={full.id}
                    avatarUrl={full.teacher?.avatarUrl ?? 'https://i.pravatar.cc/88?img=1'}
                    authorName={full.teacher?.name ?? ''}
                    title={full.title}
                    description={(full.content as Record<string, unknown>)?.description as string ?? ''}
                    themes={getThemes(full)}
                    createdAt={full.createdAt}
                  />
                ) : (
                  <p className={styles.test_link_id}>{s.title || s.id}</p>
                )}
                <button type='button' className={styles.test_link_clear} onClick={() => remove(s.id)}>
                  <XIcon size={12} />
                  {t('testLinkChange')}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / open modal */}
      <button type='button' className={styles.test_link_stub} onClick={() => setModalOpen(true)}>
        <span className={styles.stub_icon}>
          <SearchIcon size={18} />
        </span>
        <div>
          <p className={styles.stub_text}>
            {selected.length > 0 ? t('testLinkAddMore') : t('testLinkSelectTest')}
          </p>
          <p className={styles.stub_sub}>{t('testLinkNoTests')}</p>
        </div>
        {selected.length > 0 && (
          <span className={styles.test_link_count}>{selected.length}</span>
        )}
      </button>

      <ModalWindowDefault
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        additionalTitle={<p className={styles.modal_title}>{t('testLinkSelectTest')}</p>}
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

        {selectedIds.size > 0 && (
          <p className={styles.modal_selected_hint}>
            {t('testLinkSelectedCount', {count: selectedIds.size})}
          </p>
        )}

        {isLoading && <p className={styles.modal_hint}>{t('testLinkLoading')}</p>}
        {!isLoading && filtered.length === 0 && <p className={styles.modal_hint}>{t('testLinkNoTests')}</p>}

        <div className={styles.modal_grid}>
          {filtered.map((test) => {
            const isSelected = selectedIds.has(test.id)
            return (
              <div
                key={test.id}
                className={`${styles.modal_test_card} ${isSelected ? styles.modal_test_card_selected : ''}`}
                onClick={() => toggle(test)}
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

        <button
          type='button'
          className={styles.modal_done_btn}
          onClick={() => setModalOpen(false)}
        >
          {t('testLinkDone')} {selectedIds.size > 0 && `(${selectedIds.size})`}
        </button>
      </ModalWindowDefault>
    </>
  )
}
