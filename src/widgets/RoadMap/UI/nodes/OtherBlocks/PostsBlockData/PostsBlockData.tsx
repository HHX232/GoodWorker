/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {ICard} from '@/shared/types'
import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import Card from '@/shared/ui/Posts/Card/Card'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {MOCK_CARDS} from '@/widgets/Cards/CardsCatalog/CardsCatalog'
import {useReactFlow, useStore} from '@xyflow/react'
import {CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, Trash2Icon} from 'lucide-react'
import {useState} from 'react'
import 'swiper/css'
import 'swiper/css/navigation'
import {Navigation} from 'swiper/modules'
import {Swiper, SwiperSlide} from 'swiper/react'
import styles from './PostsBlockData.module.scss'
import {useTranslations} from 'next-intl'

type PostsBlockData = RoadNodeData & {
  selectedPostIds?: string[]
}

export default function PostsBlock({nodeId}: {nodeId: string}) {
  const viewOnly = useViewMode() === 'view'
  const t = useTranslations('roadMap')

  const {updateNodeData} = useReactFlow()
  const [modalOpen, setModalOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const selectedIds = useStore(
    (s) => ((s.nodeLookup.get(nodeId)?.data as PostsBlockData)?.selectedPostIds ?? []) as string[]
  )

  const selectedPosts = selectedIds.map((id) => MOCK_CARDS.find((c) => c.cardId === id)).filter(Boolean) as ICard[]

  const toggle = (cardId: string) => {
    const next = selectedIds.includes(cardId) ? selectedIds.filter((id) => id !== cardId) : [...selectedIds, cardId]
    updateNodeData(nodeId, {selectedPostIds: next} as any)
  }

  const removePost = (cardId: string) => {
    const next = selectedIds.filter((id) => id !== cardId)
    updateNodeData(nodeId, {selectedPostIds: next} as any)
    setActiveIndex(Math.min(activeIndex, next.length - 1))
  }

  const hasMultiple = selectedPosts.length > 1

  return (
    <div className={`${styles.block} nodrag nopan`}>
      {selectedPosts.length === 0 && !viewOnly && (
        <button className={styles.addBtn} onClick={() => setModalOpen(true)}>
          <PlusIcon size={16} />
          <span>{t('choosePosts')}</span>
        </button>
      )}
      {selectedPosts.length === 0 && viewOnly && <p>{t('noPostsSelected')}</p>}
      {/* ── Слайдер / одиночный пост ── */}
      {selectedPosts.length > 0 && (
        <div className={styles.sliderSection}>
          {hasMultiple ? (
            <div className={styles.swiperWrap}>
              <button className={`${styles.arrow} ${styles.arrowLeft} posts-prev`}>
                <ChevronLeftIcon size={16} />
              </button>
              <button className={`${styles.arrow} ${styles.arrowRight} posts-next`}>
                <ChevronRightIcon size={16} />
              </button>
              <Swiper
                modules={[Navigation]}
                navigation={{prevEl: '.posts-prev', nextEl: '.posts-next'}}
                onSlideChange={(s) => setActiveIndex(s.activeIndex)}
                className={styles.swiper}
              >
                {selectedPosts.map((post) => (
                  <SwiperSlide key={post.cardId} className={styles.slide}>
                    <SlideCard canRemove={!viewOnly} post={post} onRemove={() => removePost(post.cardId)} />
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          ) : (
            <SlideCard
              canRemove={!viewOnly}
              post={selectedPosts[0]}
              onRemove={() => removePost(selectedPosts[0].cardId)}
            />
          )}

          {/* Добавить ещё */}
          {!viewOnly && (
            <button className={styles.addMoreBtn} onClick={() => setModalOpen(true)}>
              <PlusIcon size={12} />
              {t('addPost')}
            </button>
          )}
        </div>
      )}
      {/* ── Модальное окно ── */}
      <ModalWindowDefault
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        additionalTitle={
          <p className={styles.modalTitle}>
            {t('selectPosts')}
            {selectedIds.length > 0 && (
              <span className={styles.modalCount}>{t('selectedCount', {count: selectedIds.length})}</span>
            )}
          </p>
        }
      >
        <div className={styles.modalGrid}>
          {MOCK_CARDS.map((card) => {
            const isSelected = selectedIds.includes(card.cardId)
            return (
              <div
                key={card.cardId}
                className={`${styles.modalCard} ${isSelected ? styles.modalCardSelected : ''}`}
                onClick={() => toggle(card.cardId)}
              >
                {/* Чекбокс */}
                <div className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
                  {isSelected && <CheckIcon size={10} />}
                </div>

                <Card
                  useLink={false}
                  cardId={card.cardId}
                  title={card.title}
                  subTitle={card.subTitle}
                  user={card.user}
                  imagesArray={card.imagesArray}
                  comments={card.comments}
                  vues={card.vues}
                  stars={card.stars}
                  userId={card.userId}
                />
              </div>
            )
          })}
        </div>
      </ModalWindowDefault>
    </div>
  )
}

// ── Слайд с постом ────────────────────────────────────────────────────────────

function SlideCard({post, onRemove, canRemove}: {post: ICard; onRemove: () => void; canRemove: boolean}) {
  const t = useTranslations('roadMap')
  return (
    <div className={styles.slideCard}>
      {canRemove && (
        <button className={styles.removeBtn} onClick={onRemove} title={t('removePost')}>
          <Trash2Icon size={12} />
        </button>
      )}
      <Card
        cardId={post.cardId}
        title={post.title}
        subTitle={post.subTitle}
        user={post.user}
        imagesArray={post.imagesArray}
        comments={post.comments}
        vues={post.vues}
        stars={post.stars}
        userId={post.userId}
      />
    </div>
  )
}
