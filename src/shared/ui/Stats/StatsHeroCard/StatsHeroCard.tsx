'use client'
import Image from 'next/image'
import {useState} from 'react'
import {useLocale, useTranslations} from 'next-intl'

import styles from './StatsHeroCard.module.scss'
import {Receipt} from '@/shared/types/Receipt/receipt.types'
import ModalWindowDefault from '../../Modals/ModalWindowDefault/ModalWindowDefault'
import {ReceiptFullPreview} from '../Receipt/ReceiptFullPreview'
import {ReceiptMiniPreview} from '../Receipt/ReceiptMiniPreview'
import {getDisplayName} from '@/shared/utils/transliterate'

interface TeacherInfo {
  name: string
  avatarUrl?: string | null
}

type ListTab = 'current' | 'upcoming'
type ModalState = {type: 'none'} | {type: 'list'; tab: ListTab} | {type: 'receipt'; receipt: Receipt}

function ReceiptsListContent({
  tab, onTabChange, receipts, upcomingReceipts, onSelect, t,
}: {
  tab: ListTab
  onTabChange: (tab: ListTab) => void
  receipts: Receipt[]
  upcomingReceipts: Receipt[]
  onSelect: (r: Receipt) => void
  t: ReturnType<typeof useTranslations>
}) {
  const active = tab === 'current' ? receipts : upcomingReceipts

  return (
    <div className={styles.list_grid_container}>
      <div className={styles.list_tabs}>
        <button
          type='button'
          className={`${styles.list_tab} ${tab === 'current' ? styles.list_tab_active : ''}`}
          onClick={() => onTabChange('current')}
        >
          {t('tabCurrent')}
        </button>
        <button
          type='button'
          className={`${styles.list_tab} ${tab === 'upcoming' ? styles.list_tab_active : ''}`}
          onClick={() => onTabChange('upcoming')}
        >
          {t('tabUpcoming')} {upcomingReceipts.length > 0 && `(${upcomingReceipts.length})`}
        </button>
      </div>

      {active.length === 0 ? (
        <p className={styles.list_empty}>{t('noReceipts')}</p>
      ) : (
        <div className={styles.list_grid}>
          {active.map((r, i) => (
            <div key={r.id} style={{animationDelay: `${i * 0.06}s`}}>
              <ReceiptMiniPreview receipt={r} onClick={() => onSelect(r)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatsHeroCard({
  extraClass, teacher, receipts = [], upcomingReceipts = [],
}: {
  extraClass?: string
  teacher?: TeacherInfo
  receipts?: Receipt[]
  upcomingReceipts?: Receipt[]
}) {
  const [modal, setModal] = useState<ModalState>({type: 'none'})
  const locale = useLocale()
  const t = useTranslations('statsPage.heroCard')

  const rawName = teacher?.name ?? t('teacher')
  const displayName = getDisplayName(rawName, locale)
  const displayAvatar = teacher?.avatarUrl ?? null

  const isOpen = modal.type !== 'none'
  const closeAll = () => setModal({type: 'none'})
  const openList = (tab: ListTab) => setModal({type: 'list', tab})
  const openReceipt = (r: Receipt) => setModal({type: 'receipt', receipt: r})
  const backToList = () => setModal({type: 'list', tab: 'current'})

  const modalTitle =
    modal.type === 'list'
      ? t('receiptsCount', {count: modal.tab === 'current' ? receipts.length : upcomingReceipts.length})
      : modal.type === 'receipt'
      ? modal.receipt.subject
      : ''

  return (
    <>
      <div className={`${styles.avatar_card} ${extraClass ?? ''}`}>
        <div className={styles.avatar_img_wrap}>
          {displayAvatar ? (
            <Image
              width={300}
              height={300}
              src={displayAvatar}
              alt={displayName}
              className={styles.avatar_img}
            />
          ) : (
            <div className={styles.avatar_img} style={{background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, color: '#ccc'}}>
              {displayName.charAt(0)}
            </div>
          )}
          <div className={styles.blur_box}>
            <div className={styles.left_name_text}>
              <h2 className={styles.avatar_name}>{displayName}</h2>
              <span>{t('teacher')}</span>
            </div>
          </div>
        </div>

        <div className={styles.avatar_info}>
          <h2>{t('receipts')}</h2>
          {receipts.length === 0 ? (
            <p className={styles.no_receipts_hint}>{t('noReceipts')}</p>
          ) : (
            <div className={styles.receipts_row}>
              {receipts.slice(0, 2).map((r) => (
                <button key={r.id} type='button' className={styles.receipt_mini} onClick={() => openReceipt(r)}>
                  <p className={styles.rm_date}>{r.date ? r.date.slice(0, 6) : ''}</p>
                  <p className={styles.rm_subj}>{r.subject}</p>
                  <p className={styles.rm_amt}>
                    {r.amount.toLocaleString('ru')} {r.currency}
                  </p>
                </button>
              ))}

              <button type='button' className={styles.arrow_btn} onClick={() => openList('current')} aria-label={t('allReceipts')}>
                <svg viewBox='0 0 13 13' fill='none'>
                  <path
                    d='M2 6.5h9M7.5 3 11 6.5 7.5 10'
                    stroke='currentColor'
                    strokeWidth='1.3'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </button>
            </div>
          )}

          {upcomingReceipts.length > 0 && (
            <button type='button' className={styles.upcoming_link} onClick={() => openList('upcoming')}>
              {t('upcomingHint', {count: upcomingReceipts.length})}
            </button>
          )}

          <div className={styles.review_box}>
            <span className={styles.avatar_reviews}>{t('profile')}</span>
            <div className={styles.avatar_badge}>★ 5.0</div>
          </div>
        </div>
      </div>

      <ModalWindowDefault
        isOpen={isOpen}
        extraClass={styles.extra_modal}
        onClose={closeAll}
        additionalTitle={<p className={styles.modal_title}>{modalTitle}</p>}
      >
        {modal.type === 'list' && (
          <ReceiptsListContent
            tab={modal.tab}
            onTabChange={(tab) => setModal({type: 'list', tab})}
            receipts={receipts}
            upcomingReceipts={upcomingReceipts}
            onSelect={openReceipt}
            t={t}
          />
        )}
        {modal.type === 'receipt' && <ReceiptFullPreview receipt={modal.receipt} onBack={backToList} />}
      </ModalWindowDefault>
    </>
  )
}

export default StatsHeroCard
