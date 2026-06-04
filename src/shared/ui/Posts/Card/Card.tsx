'use client'

import {ICard} from '@/shared/types'
import {CardOwnerMenu} from '@/shared/ui/CardOwnerMenu/CardOwnerMenu'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {FC} from 'react'
import UserHeaderCard from '../../User/UserHeaderCard/UserHeaderCard'
import PostFooterMain from '../PostFooter/PostFooterMain'
import style from './Card.module.scss'

const Card: FC<ICard & {isOwner?: boolean; onDelete?: () => void}> = ({
  userId,
  comments = '0',
  cardId,
  vues = '0',
  stars = '0',
  title = 'undefined',
  subTitle = '',
  user,
  imagesArray = [],
  useLink = true,
  isOwner = false,
  onDelete,
}) => {
  const t = useTranslations('card')
  const tDash = useTranslations('dashboard')
  return (
    <div className={style.card_box} style={{ position: 'relative' }}>
      {isOwner && onDelete && (
        <CardOwnerMenu onDelete={onDelete} deleteLabel={tDash('deleteItem')} />
      )}
      <UserHeaderCard
        userID={userId}
        cardID={cardId}
        image={user.image}
        role={user.role}
        dateActivity={user.dateActivity}
        name={user.name}
        useLink={useLink}
      />

      {useLink ? (
        <Link href={`/post/${cardId}`} className={style.card_text_box}>
          <h5 className={style.card_title}>{title}</h5>
          <p className={style.card_subtitle}>{subTitle}</p>
        </Link>
      ) : (
        <div className={style.card_text_box}>
          <h5 className={style.card_title}>{title}</h5>
          <p className={style.card_subtitle}>{subTitle}</p>
        </div>
      )}

      <ul className={style.card_images_list}>
        {imagesArray.map((image, index) => {
          if (index > 1) return null
          return (
            <li
              key={`${cardId}-img-${index}`}
              className={`${index % 2 ? style.hidden_image : ''} ${style.card_images_item}`}
            >
              {useLink ? (
                <Link href={`/post/${cardId}`} className={style.image_link}>
                  <div style={{backgroundImage: `url(${image})`}} className={style.card_image} />
                </Link>
              ) : (
                <div className={style.image_link}>
                  <div style={{backgroundImage: `url(${image})`}} className={style.card_image} />
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <PostFooterMain parentPostID={cardId} comments={comments} vues={vues} stars={stars} postTitle={title} />

      <div className={style.bottom_row}>
        {useLink ? (
          <Link href={`/post/${cardId}`} className={style.link_button}>
            <p className={style.link_text}>{t('readFullPost')}</p>
            <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
              <path
                d='M1 8H15M15 8L8 1M15 8L8 15'
                stroke='#868897'
                strokeWidth='1.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </Link>
        ) : (
          <div className={style.link_button}>
            <p className={style.link_text}>{t('readFullPost')}</p>
            <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
              <path
                d='M1 8H15M15 8L8 1M15 8L8 15'
                stroke='#868897'
                strokeWidth='1.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </div>
        )}

        {isOwner && (
          <Link href={`/edit-post/${cardId}`} className={style.edit_btn} title={t('editPost')} onClick={(e) => e.stopPropagation()}>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
              <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
            </svg>
          </Link>
        )}
      </div>
    </div>
  )
}

export default Card
