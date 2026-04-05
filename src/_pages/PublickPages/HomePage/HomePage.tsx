'use client'
import {NavBar} from '@/widgets/BaseUI'
import {MOCK_CARDS, mockLoadMore} from '@/widgets/Cards/CardsCatalog/CardsCatalog'

import {CardsCatalog, HighlightedSlider} from '@/widgets/Cards'
import styles from './HomePage.module.scss'

function HomePage() {
  return (
    <div className={`container default_content ${styles.content}`}>
      <NavBar />
      <div className={`${styles.main_content}`}>
        <HighlightedSlider />
        <div className={styles.title_box}>
          <h1>All posts</h1>
          <div className={styles.decor_line}></div>
        </div>
        <CardsCatalog initialCards={MOCK_CARDS} onLoadMore={mockLoadMore} hasMore={true} />
      </div>
      <div className='mobile_padding'></div>
    </div>
  )
}

export default HomePage
