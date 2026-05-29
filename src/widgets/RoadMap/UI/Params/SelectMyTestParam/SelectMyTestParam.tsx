'use client'

import TestService, {ITestItem} from '@/features/services/TestService.service'
import {BlockRoadParam} from '@/shared/types/RoadMap/RoadMap.types'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import TestPreview from '@/widgets/Tasks/TestPreview/TestPreview'
import {useQuery} from '@tanstack/react-query'
import {CheckIcon, SearchIcon, XIcon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useMemo, useState} from 'react'
import styles from './SelectMyTestParam.module.scss'

function SelectMyTestParam({
  param,
  value,
  updateNodeParamValue,
  disabled
}: {
  param: BlockRoadParam
  value: string
  updateNodeParamValue: (v: string) => void
  disabled?: boolean
  t?: (v: string) => string
}) {
  const t = useTranslations('roadMap')
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  const {data: tests = [], isLoading} = useQuery({
    queryKey: ['my-tests'],
    queryFn: () => TestService.getMyTests(),
    staleTime: 1000 * 60 * 5,
    enabled: modalOpen
  })

  const selectedTest = useMemo(() => tests.find((t) => t.id === value), [tests, value])

  const filtered = useMemo(() => {
    if (!search.trim()) return tests
    const q = search.toLowerCase()
    return tests.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.aiTopic ?? '').toLowerCase().includes(q)
    )
  }, [tests, search])

  const select = (test: ITestItem) => {
    updateNodeParamValue(test.id)
    setModalOpen(false)
  }

  const clear = () => {
    updateNodeParamValue('')
  }

  const getThemes = (test: ITestItem) =>
    test.testCategories?.map((tc) => tc.category.translations.find((tr) => tr.langCode === 'ru')?.name ?? tc.category.slug).slice(0, 3) ?? []

  return (
    <div className={styles.wrapper}>
      {!value ? (
        <button
          className={styles.selectBtn}
          disabled={disabled}
          onClick={() => !disabled && setModalOpen(true)}
        >
          <SearchIcon size={14} />
          <span>{t('selectTest')}</span>
        </button>
      ) : (
        <div className={styles.selectedWrap}>
          {selectedTest ? (
            <TestPreview
              useLink={false}
              useBorder={true}
              grayscale={false}
              testId={selectedTest.id}
              avatarUrl={selectedTest.teacher?.avatarUrl ?? 'https://i.pravatar.cc/88?img=1'}
              authorName={selectedTest.teacher?.name ?? ''}
              title={selectedTest.title}
              description={(selectedTest.content as any)?.description ?? ''}
              themes={getThemes(selectedTest)}
              createdAt={selectedTest.createdAt}
            />
          ) : (
            <p className={styles.hint}>{t('loadingTests')}</p>
          )}
          {!disabled && (
            <button className={styles.clearBtn} onClick={clear} title={t('clean')}>
              <XIcon size={12} />
            </button>
          )}
        </div>
      )}

      <ModalWindowDefault
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        additionalTitle={
          <p className={styles.modalTitle}>{t('selectTest')}</p>
        }
      >
        <div className={styles.searchWrap}>
          <SearchIcon size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder={t('searchTests')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && <p className={styles.hint}>{t('loadingTests')}</p>}
        {!isLoading && filtered.length === 0 && <p className={styles.hint}>{t('noTestsFound')}</p>}

        <div className={styles.grid}>
          {filtered.map((test) => {
            const isSelected = test.id === value
            return (
              <div
                key={test.id}
                className={`${styles.testCard} ${isSelected ? styles.testCardSelected : ''}`}
                onClick={() => select(test)}
              >
                <div className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
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
                  description={(test.content as any)?.description ?? ''}
                  themes={getThemes(test)}
                  createdAt={test.createdAt}
                />
              </div>
            )
          })}
        </div>
      </ModalWindowDefault>
    </div>
  )
}

export default SelectMyTestParam
