'use client'
import Image from 'next/image'
import {useState} from 'react'

import styles from './StatsHeroCard.module.scss'
import {mockReceipts, Receipt} from '@/shared/types/Receipt/receipt.types'
import ModalWindowDefault from '../../Modals/ModalWindowDefault/ModalWindowDefault'
import {ReceiptFullPreview} from '../Receipt/ReceiptFullPreview'
import {ReceiptMiniPreview} from '../Receipt/ReceiptMiniPreview'

const mockTutor = {
  avatarUrl: 'https://i.pravatar.cc/200?img=47',
  name: 'Ekaterina Ivanova',
  minPrice: 800,
  currency: '₽',
  rating: 4.9,
  reviews: 134,
  experience: 5,
  receipts: mockReceipts
}

type ModalState = {type: 'none'} | {type: 'list'} | {type: 'receipt'; receipt: Receipt}

function ReceiptsListContent({receipts, onSelect}: {receipts: Receipt[]; onSelect: (r: Receipt) => void}) {
  return (
    <div className={styles.list_grid_container}>
      <div className={styles.list_grid}>
        {receipts.map((r, i) => (
          <div key={r.id} style={{animationDelay: `${i * 0.06}s`}}>
            <ReceiptMiniPreview receipt={r} onClick={() => onSelect(r)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function StatsHeroCard({extraClass}: {extraClass?: string}) {
  const [modal, setModal] = useState<ModalState>({type: 'none'})

  const isOpen = modal.type !== 'none'
  const closeAll = () => setModal({type: 'none'})
  const openList = () => setModal({type: 'list'})
  const openReceipt = (r: Receipt) => setModal({type: 'receipt', receipt: r})
  const backToList = () => setModal({type: 'list'})

  const modalTitle =
    modal.type === 'list'
      ? `Чеки (${mockTutor.receipts.length})`
      : modal.type === 'receipt'
      ? modal.receipt.subject
      : ''

  return (
    <>
      <div className={`${styles.avatar_card} ${extraClass ?? ''}`}>
        <div className={styles.avatar_img_wrap}>
          <Image
            width={300}
            height={300}
            src={mockTutor.avatarUrl}
            alt={mockTutor.name}
            className={styles.avatar_img}
          />
          <div className={styles.blur_box}>
            <div className={styles.left_name_text}>
              <h2 className={styles.avatar_name}>{mockTutor.name}</h2>
              <span>Стаж: {mockTutor.experience} лет</span>
            </div>
            <div className={styles.right_name_text}>
              от {mockTutor.minPrice} {mockTutor.currency}
            </div>
          </div>
        </div>

        <div className={styles.avatar_info}>
          <h2>Чеки</h2>
          <div className={styles.receipts_row}>
            {mockTutor.receipts.slice(0, 2).map((r) => (
              <button key={r.id} type='button' className={styles.receipt_mini} onClick={() => openReceipt(r)}>
                <p className={styles.rm_date}>{r.date.slice(0, 6)}</p>
                <p className={styles.rm_subj}>{r.subject}</p>
                <p className={styles.rm_amt}>
                  {r.amount.toLocaleString('ru')} {r.currency}
                </p>
              </button>
            ))}

            <button type='button' className={styles.arrow_btn} onClick={openList} aria-label='Все чеки'>
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

          <div className={styles.review_box}>
            <span className={styles.avatar_reviews}>{mockTutor.reviews} отзывов</span>
            <div className={styles.avatar_badge}>★ {mockTutor.rating}</div>
          </div>
        </div>
      </div>

      <ModalWindowDefault
        isOpen={isOpen}
        extraClass={styles.extra_modal}
        onClose={closeAll}
        additionalTitle={<p className={styles.modal_title}>{modalTitle}</p>}
      >
        {modal.type === 'list' && <ReceiptsListContent receipts={mockTutor.receipts} onSelect={openReceipt} />}
        {modal.type === 'receipt' && <ReceiptFullPreview receipt={modal.receipt} onBack={backToList} />}
      </ModalWindowDefault>
    </>
  )
}

export default StatsHeroCard
