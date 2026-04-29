'use client'
import PostService, {IPostsQuery, IPostsResponse} from '@/features/services/PostService.service'
import {NavBar} from '@/widgets/BaseUI'
import {CardsCatalog, HighlightedSlider} from '@/widgets/Cards'
import styles from './HomePage.module.scss'

interface HomePageProps {
  initialData: IPostsResponse
  initialQuery: IPostsQuery
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
  stars: '0',
  userId: post.teacher.id
})

function HomePage({initialData, initialQuery}: HomePageProps) {
  const handleLoadMore = async (page: number) => {
    const res = await PostService.getList({...initialQuery, page})
    return res.posts.map(mapPost)
  }

  return (
    <div className={`container default_content ${styles.content}`}>
      <NavBar />
      <div className={styles.main_content}>
        <HighlightedSlider />
        <div className={styles.title_box}>
          <h1>All posts</h1>
          <div className={styles.decor_line}></div>
        </div>
        <CardsCatalog
          initialCards={initialData.posts.map(mapPost)}
          onLoadMore={handleLoadMore}
          hasMore={initialData.pagination.page < initialData.pagination.totalPages}
        />
      </div>
      <div className='mobile_padding'></div>
    </div>
  )
}

export default HomePage
