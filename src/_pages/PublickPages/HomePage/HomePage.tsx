'use client'
import PostService, {IPostResponse, IPostsQuery, IPostsResponse} from '@/features/services/PostService.service'
import {NavBar} from '@/widgets/BaseUI'
import {CardsCatalog, HighlightedSlider, type ISliderPost} from '@/widgets/Cards'
import {PostCatalogFilters, type PostFiltersValue} from '@/widgets/Cards/PostCatalogFilters/PostCatalogFilters'
import {NotificationsPanel} from '@/widgets/NotificationsPanel/NotificationsPanel'
import {HomeTutorial} from '@/widgets/Tutorial/HomeTutorial'
import {useTranslations} from 'next-intl'
import {useCallback, useEffect, useState} from 'react'
import styles from './HomePage.module.scss'

interface HomePageProps {
  initialData: IPostsResponse
  initialQuery: IPostsQuery
  vipPosts?: IPostResponse[]
}

const mapPost = (post: IPostsResponse['posts'][number]) => ({
  cardId: post.id,
  title: post.title,
  subTitle: '',
  user: {
    id: post.teacher.id,
    name: post.teacher.name,
    image: post.teacher.avatarUrl ?? '',
    role: 'Teacher' as const,
    dateActivity: ''
  },
  imagesArray: post.mediaUrls,
  comments: String(post._count?.comments ?? 0),
  vues: String(post.viewCount ?? 0),
  stars: post.avgRating > 0 ? post.avgRating.toFixed(1) : '0',
  userId: post.teacher.id
})

const mapVipPost = (post: IPostResponse): ISliderPost => ({
  id: post.id,
  title: post.title,
  subtitle: post.additionalTitle ?? '',
  backgroundImage: post.mediaUrls[0],
  author: {
    id: post.teacher.id,
    username: post.teacher.name,
    avatar: post.teacher.avatarUrl ?? undefined,
    role: 'Teacher',
  },
})

function sortQueryParam(sort: PostFiltersValue['sort']): Partial<IPostsQuery> {
  if (sort === 'popular') return {visibility: 'any'}
  if (sort === 'rated') return {visibility: 'any'}
  return {}
}

function HomePage({initialData, initialQuery, vipPosts}: HomePageProps) {
  const t = useTranslations('HomePage')

  const [filters, setFilters] = useState<PostFiltersValue>({
    categoryId: initialQuery.categoryId ?? '',
    sort: 'newest',
    ratingMin: 0,
    ratingMax: 5,
  })

  const [cards, setCards] = useState(initialData.posts.map(mapPost))
  const [hasMore, setHasMore] = useState(initialData.pagination.page < initialData.pagination.totalPages)
  const [currentQuery, setCurrentQuery] = useState<IPostsQuery>({...initialQuery, page: 1})

  const fetchPage = useCallback(async (query: IPostsQuery) => {
    const res = await PostService.getList(query)
    return res
  }, [])

  // Re-fetch when filters change
  useEffect(() => {
    const query: IPostsQuery = {
      ...initialQuery,
      page: 1,
      limit: initialQuery.limit ?? 12,
      categoryId: filters.categoryId || undefined,
      ...sortQueryParam(filters.sort),
    }
    setCurrentQuery(query)
    fetchPage(query).then(res => {
      setCards(res.posts.map(mapPost))
      setHasMore(res.pagination.page < res.pagination.totalPages)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const handleLoadMore = async (page: number) => {
    const res = await PostService.getList({...currentQuery, page})
    return res.posts.map(mapPost)
  }

  const sliderPosts = vipPosts && vipPosts.length > 0 ? vipPosts.map(mapVipPost) : undefined

  return (
    <div className={`container default_content ${styles.content}`}>
      <NavBar />

      <div className={styles.main_content} id="posts-catalog">
        <HighlightedSlider posts={sliderPosts} />
        <div className={styles.title_box}>
          <h1>{t('title')}</h1>
          <div className={styles.decor_line}></div>
        </div>
        <PostCatalogFilters value={filters} onChange={setFilters} />
        <CardsCatalog
          initialCards={cards}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
        />
      </div>

      <div className={styles.sidebar}>
        <NotificationsPanel />
      </div>

      <div className='mobile_padding'></div>
      <HomeTutorial />
    </div>
  )
}

export default HomePage
