import { ICard } from '@/shared/types';
import Link from 'next/link';
import { FC } from 'react';
import UserHeaderCard from '../../User/UserHeaderCard/UserHeaderCard';
import PostFooterMain from '../PostFooter/PostFooterMain';
import style from './Card.module.scss';

const Card: FC<ICard> = ({
  userId,
  comments = '0',
  cardId,
  vues = '0',
  stars = '0',
  title = 'undefined',
  subTitle = '',
  user,
  imagesArray = [],
}) => {
  return (
    <div className={style.card_box}>
      <UserHeaderCard
        userID={userId}
        cardID={cardId}
        image={user.image}
        role={user.role}
        dateActivity={user.dateActivity}
        name={user.name}
      />

      <Link href={`/post/${cardId}`} className={style.card_text_box}>
        <h5 className={style.card_title}>{title}</h5>
        <p className={style.card_subtitle}>{subTitle}</p>
      </Link>

      <ul className={style.card_images_list}>
        {imagesArray.map((image, index) => {
          if (index > 1) return null;
          return (
            <li
              key={`${cardId}-img-${index}`}
              className={`${index % 2 ? style.hidden_image : ''} ${style.card_images_item}`}
            >
              <Link href={`/post/${cardId}`} className={style.image_link}>
                <div
                  style={{ backgroundImage: `url(${image})` }}
                  className={style.card_image}
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <PostFooterMain
        parentPostID={cardId}
        comments={comments}
        vues={vues}
        stars={stars}
      />

      <Link href={`/post/${cardId}`} className={style.link_button}>
        <p className={style.link_text}>Read full post</p>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M1 8H15M15 8L8 1M15 8L8 15"
            stroke="#868897"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </div>
  );
};

export default Card;