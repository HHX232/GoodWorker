'use client'

import {ICard, ICardUser} from '@/shared/types'
import Card from '@/shared/ui/Posts/Card/Card'
import {useTranslations} from 'next-intl'
import {FC, useCallback, useEffect, useRef, useState} from 'react'
import {CardSkeleton} from '../../../shared/ui/Posts/CardSkeleton/CardSkeleton'
import style from './CardsCatalog.module.scss'

interface ICardsCatalog {
  initialCards: ICard[]
  onLoadMore?: (page: number) => Promise<ICard[]>
  hasMore?: boolean
}

const MOCK_USER: ICardUser = {
  id: '1',
  name: 'Алексей Смирнов',
  image: 'https://i.pravatar.cc/150?img=1',
  role: 'Teacher',
  dateActivity: 'Online'
}

export const MOCK_CARDS: ICard[] = [
  {
    cardId: 'card-1',
    title: 'Как стать Senior разработчиком',
    subTitle: 'Разбираем реальный путь роста от Junior до Senior',
    user: MOCK_USER,
    imagesArray: ['https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=600'],
    comments: '12',
    vues: '340',
    stars: '48',
    userId: '1'
  },
  {
    cardId: 'card-2',
    title: 'TypeScript: продвинутые паттерны',
    subTitle: 'Generic, Conditional Types и mapped types на примерах',
    user: {...MOCK_USER, id: '2', name: 'Мария Иванова', role: 'Admin', image: 'https://i.pravatar.cc/150?img=5'},
    imagesArray: [
      'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=600',
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600'
    ],
    comments: '7',
    vues: '210',
    stars: '31',
    userId: '2'
  },
  {
    cardId: 'card-3',
    title: 'Next.js App Router: полный гайд',
    subTitle: 'Server Components, layouts и streaming — всё что нужно знать',
    user: {...MOCK_USER, id: '3', name: 'Дмитрий Козлов', role: 'Student', image: 'https://i.pravatar.cc/150?img=8'},
    imagesArray: ['https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600'],
    comments: '23',
    vues: '512',
    stars: '76',
    userId: '3'
  },
  {
    cardId: 'card-4',
    title: 'CSS Grid vs Flexbox: когда что использовать',
    subTitle: 'Наглядное сравнение с реальными кейсами',
    user: {...MOCK_USER, id: '4', name: 'Анна Петрова', role: 'Teacher', image: 'https://i.pravatar.cc/150?img=9'},
    imagesArray: [],
    comments: '5',
    vues: '98',
    stars: '14',
    userId: '4'
  }
]

export const mockLoadMore = async (page: number): Promise<ICard[]> => {
  await new Promise((resolve) => setTimeout(resolve, 1200))
  if (page >= 4) return []
  return MOCK_CARDS.map((card) => ({
    ...card,
    cardId: `${card.cardId}-p${page}`,
    title: `[стр. ${page}] ${card.title}`
  }))
}

export const CardsCatalog: FC<ICardsCatalog> = ({initialCards, onLoadMore, hasMore = false}) => {
  const t = useTranslations('CardsCatalog')

  const [cards, setCards] = useState<ICard[]>(initialCards)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [canLoadMore, setCanLoadMore] = useState(hasMore)

  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (isLoading || !canLoadMore || !onLoadMore) return

    setIsLoading(true)
    try {
      const nextPage = page + 1
      const newCards = await onLoadMore(nextPage)

      if (newCards.length === 0) {
        setCanLoadMore(false)
      } else {
        setCards((prev) => [...prev, ...newCards])
        setPage(nextPage)
      }
    } catch (err) {
      // переведённое сообщение в консоль
      console.error(t('loadError'), err)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, canLoadMore, onLoadMore, page, t])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      {rootMargin: '500px', threshold: 0}
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  useEffect(() => {
    setCards(initialCards)
  }, [initialCards])

  return (
    <div className={style.catalog}>
      <div className={style.grid}>
        {cards.map((card) => (
          <Card
            key={card.cardId}
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
        ))}

        {isLoading && (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        )}
      </div>

      {canLoadMore && <div ref={sentinelRef} className={style.sentinel} aria-hidden='true' />}

      {!canLoadMore && cards.length > 0 && <p className={style.end_message}>{t('noMore')}</p>}
    </div>
  )
}
