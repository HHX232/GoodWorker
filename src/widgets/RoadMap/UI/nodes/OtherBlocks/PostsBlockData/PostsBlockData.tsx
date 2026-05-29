/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import MeService from '@/features/services/me.service'
import PostService, {IPostResponse} from '@/features/services/PostService.service'
import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import Card from '@/shared/ui/Posts/Card/Card'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {useReactFlow, useStore} from '@xyflow/react'
import {useQuery} from '@tanstack/react-query'
import {CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon, Trash2Icon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useMemo, useState} from 'react'
import 'swiper/css'
import 'swiper/css/navigation'
import {Navigation} from 'swiper/modules'
import {Swiper, SwiperSlide} from 'swiper/react'
import styles from './PostsBlockData.module.scss'

type PostsBlockData = RoadNodeData & {
  selectedPostIds?: string[]
}

export default function PostsBlock({nodeId}: {nodeId: string}) {
  const viewOnly = useViewMode() === 'view'
  const t = useTranslations('roadMap')

  const {updateNodeData} = useReactFlow()
  const [modalOpen, setModalOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [search, setSearch] = useState('')

  const selectedIds = useStore(
    (s) => ((s.nodeLookup.get(nodeId)?.data as PostsBlockData)?.selectedPostIds ?? []) as string[]
  )

  const {data: me} = useQuery({
    queryKey: ['me'],
    queryFn: () => MeService.getMe(),
    staleTime: 1000 * 60 * 5
  })

  const {data: postsData, isLoading: postsLoading} = useQuery({
    queryKey: ['my-posts-modal', me?.id],
    queryFn: () => PostService.getList({teacherId: me!.id, limit: 100}),
    enabled: !!me?.id && modalOpen,
    staleTime: 1000 * 30
  })

  const allPosts = postsData?.posts ?? []

  const filteredPosts = useMemo(() => {
    if (!search.trim()) return allPosts
    const q = search.toLowerCase()
    return allPosts.filter(
      (p) => p.title.toLowerCase().includes(q) || (p.additionalTitle ?? '').toLowerCase().includes(q)
    )
  }, [allPosts, search])

  const selectedPosts = useMemo(
    () => selectedIds.map((id) => allPosts.find((p) => p.id === id)).filter(Boolean) as IPostResponse[],
    [selectedIds, allPosts]
  )

  const toggle = (postId: string) => {
    const next = selectedIds.includes(postId)
      ? selectedIds.filter((id) => id !== postId)
      : [...selectedIds, postId]
    updateNodeData(nodeId, {selectedPostIds: next} as any)
  }

  const removePost = (postId: string) => {
    const next = selectedIds.filter((id) => id !== postId)
    updateNodeData(nodeId, {selectedPostIds: next} as any)
    setActiveIndex(Math.min(activeIndex, next.length - 1))
  }

  const toCard = (p: IPostResponse) => ({
    cardId: p.id,
    title: p.title,
    subTitle: p.additionalTitle ?? '',
    user: {id: p.teacher.id, name: p.teacher.name, image: p.teacher.avatarUrl ?? undefined, role: 'Teacher'},
    imagesArray: p.mediaUrls ?? [],
    comments: String(p._count?.comments ?? 0),
    vues: '0',
    stars: String(Math.round(p.avgRating ?? 0)),
    userId: p.teacher.id
  })

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
                  <SwiperSlide key={post.id} className={styles.slide}>
                    <SlideCard canRemove={!viewOnly} card={toCard(post)} onRemove={() => removePost(post.id)} />
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          ) : (
            <SlideCard canRemove={!viewOnly} card={toCard(selectedPosts[0])} onRemove={() => removePost(selectedPosts[0].id)} />
          )}

          {!viewOnly && (
            <button className={styles.addMoreBtn} onClick={() => setModalOpen(true)}>
              <PlusIcon size={12} />
              {t('addPost')}
            </button>
          )}
        </div>
      )}

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
        <div className={styles.searchWrap}>
          <SearchIcon size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder={t('searchPosts')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {postsLoading && <p className={styles.hint}>{t('loadingPosts')}</p>}
        {!postsLoading && filteredPosts.length === 0 && <p className={styles.hint}>{t('noPostsFound')}</p>}

        <div className={styles.modalGrid}>
          {filteredPosts.map((post) => {
            const isSelected = selectedIds.includes(post.id)
            return (
              <div
                key={post.id}
                className={`${styles.modalCard} ${isSelected ? styles.modalCardSelected : ''}`}
                onClick={() => toggle(post.id)}
              >
                <div className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
                  {isSelected && <CheckIcon size={10} />}
                </div>
                <Card
                  useLink={false}
                  cardId={post.id}
                  title={post.title}
                  subTitle={post.additionalTitle ?? ''}
                  user={{id: post.teacher.id, name: post.teacher.name, image: post.teacher.avatarUrl ?? undefined, role: 'Teacher'}}
                  imagesArray={post.mediaUrls ?? []}
                  comments={String(post._count?.comments ?? 0)}
                  vues='0'
                  stars={String(Math.round(post.avgRating ?? 0))}
                  userId={post.teacher.id}
                />
              </div>
            )
          })}
        </div>
      </ModalWindowDefault>
    </div>
  )
}

function SlideCard({card, onRemove, canRemove}: {card: ReturnType<typeof Object.assign>; onRemove: () => void; canRemove: boolean}) {
  const t = useTranslations('roadMap')
  return (
    <div className={styles.slideCard}>
      {canRemove && (
        <button className={styles.removeBtn} onClick={onRemove} title={t('removePost')}>
          <Trash2Icon size={12} />
        </button>
      )}
      <Card
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
}
