'use client'

import {useRouter, useSearchParams} from 'next/navigation'
import {useState} from 'react'
import {CheckboxUI, TextInputUI} from '../../inputs'
import {CategorySelect} from '../../inputs/CategorySelect/CategorySelect'
import SelectInput from '../../inputs/SelectInput/SelectInput'
import ModalWindowDefault from '../ModalWindowDefault/ModalWindowDefault'
import styles from './FilterModal.module.scss'

interface FilterModalProps {
  isOpen: boolean
  onClose: (e: React.MouseEvent) => void
}

const VISIBILITY_OPTIONS = [
  {label: 'Все', value: 'any'},
  {label: 'Публичные', value: 'PUBLIC'},
  {label: 'Для учеников', value: 'STUDENTS'},
  {label: 'Избранные', value: 'SELECTED'},
  {label: 'Приватные', value: 'PRIVATE'}
]

export const FilterModal = ({isOpen, onClose}: FilterModalProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [teacherId, setTeacherId] = useState(searchParams.get('teacherId') ?? '')
  const [categoryIds, setCategoryIds] = useState<string[]>(
    searchParams.get('categoryId') ? [searchParams.get('categoryId')!] : []
  )
  const [visibility, setVisibility] = useState(searchParams.get('visibility') ?? 'any')
  const [onlyVip, setOnlyVip] = useState(searchParams.get('onlyVip') === 'true')

  const activeCount = [
    search,
    teacherId,
    categoryIds.length > 0 ? 'cat' : '',
    visibility !== 'any' ? visibility : '',
    onlyVip ? 'vip' : ''
  ].filter(Boolean).length

  const handleApply = (e: React.MouseEvent) => {
    const params = new URLSearchParams()
    params.set('page', '1')
    if (search) params.set('search', search)
    if (teacherId) params.set('teacherId', teacherId)
    if (categoryIds[0]) params.set('categoryId', categoryIds[0])
    if (visibility !== 'any') params.set('visibility', visibility)
    if (onlyVip) params.set('onlyVip', 'true')
    router.push(`?${params.toString()}`)
    onClose(e)
  }

  const handleReset = (e: React.MouseEvent) => {
    setSearch('')
    setTeacherId('')
    setCategoryIds([])
    setVisibility('any')
    setOnlyVip(false)
    router.push('?')
    onClose(e)
  }

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={onClose}
      additionalTitle={
        <p className={styles.title}>
          Фильтры
          {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
        </p>
      }
      modalFooter={
        <div className={styles.footer}>
          <button className={styles.reset_btn} onClick={handleReset}>
            Сбросить
          </button>
          <button className={styles.apply_btn} onClick={handleApply}>
            Применить
          </button>
        </div>
      }
    >
      <div className={styles.body}>
        <TextInputUI
          theme='newWhite'
          placeholder='Название поста...'
          currentValue={search}
          onSetValue={setSearch}
          title='Поиск'
        />

        <TextInputUI
          theme='newWhite'
          placeholder='ID учителя...'
          currentValue={teacherId}
          onSetValue={setTeacherId}
          title='Учитель'
        />

        <div className={styles.field}>
          <span className={styles.label}>Категория</span>
          <CategorySelect
            value={categoryIds}
            onChange={setCategoryIds}
            canSelectMany={true}
            placeholder='Выберите категорию'
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Видимость</span>
          <SelectInput options={VISIBILITY_OPTIONS} value={visibility} onChange={setVisibility} placeholder='Любая' />
        </div>

        <CheckboxUI
          label='Только VIP посты'
          description='Показывать только активные VIP материалы'
          checked={onlyVip}
          onChange={setOnlyVip}
        />
      </div>
    </ModalWindowDefault>
  )
}
