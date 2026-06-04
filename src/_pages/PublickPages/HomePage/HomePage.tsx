'use client'
import PostService, {IPostResponse, IPostsQuery, IPostsResponse} from '@/features/services/PostService.service'
import {NavBar} from '@/widgets/BaseUI'
import {CardsCatalog, HighlightedSlider, type ISliderPost} from '@/widgets/Cards'
import {NotificationsPanel} from '@/widgets/NotificationsPanel/NotificationsPanel'
import {HomeTutorial} from '@/widgets/Tutorial/HomeTutorial'
import {useTranslations} from 'next-intl'
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

function HomePage({initialData, initialQuery, vipPosts}: HomePageProps) {
  const t = useTranslations('HomePage')
  const handleLoadMore = async (page: number) => {
    const res = await PostService.getList({...initialQuery, page})
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
        <CardsCatalog
          initialCards={initialData.posts.map(mapPost)}
          onLoadMore={handleLoadMore}
          hasMore={initialData.pagination.page < initialData.pagination.totalPages}
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
