'use client';

import Tooltip from '@mui/material/Tooltip';
import Image from 'next/image';
import Link from 'next/link';
import { FC, useState } from 'react';
import { PostComplaintModal } from '../PostComplaintModal/PostComplaintModal';
import style from './PostFooterMain.module.scss';

interface TPostFooter {
  comments: string;
  vues: string;
  stars: string;
  parentPostID: string;
  postTitle?: string;
}

const PostFooterMain: FC<TPostFooter> = ({ comments, parentPostID, vues, stars, postTitle }) => {
  const [copyMessage, setCopyMessage] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);

  const handleShareClick = (e: React.MouseEvent<HTMLDivElement>) => {
   if(typeof window === 'undefined') return
    e.stopPropagation();
    setCopyMessage(true);
    setTimeout(() => setCopyMessage(false), 2500);
    const urlToCopy = `https://goodworker.com/posts/${parentPostID}`;
    navigator.clipboard
      .writeText(urlToCopy)
      .then(() => console.log('Ссылка скопирована!'))
      .catch((err) => console.error('Ошибка копирования:', err));
  };

  return (
    <>
      <div className={style.post_box}>

        <Link href={`/post/${parentPostID}`} className={style.comm_box}>
          <div className={style.img_comm_box}>
            <Image
              src="/icons/base/comments_mini.svg"
              alt="comments"
              width={24}
              height={24}
              className={style.comm_img}
            />
          </div>
          <span className={style.comm_count}>{comments}</span>
        </Link>

        <div className={`${style.comm_box} ${style.comm_box_2}`}>
          <Tooltip title={copyMessage ? 'Скопировано!' : 'Поделиться'}>
            <div onClick={handleShareClick} className={style.img_comm_box}>
              <Image
                src="/icons/base/share.svg"
                alt="share"
                width={24}
                height={24}
                className={style.comm_img}
              />
            </div>
          </Tooltip>
        </div>

        <Link href={`/post/${parentPostID}`} className={style.vues_box}>
          <Image
            src="/icons/base/vues.svg"
            alt="views"
            width={24}
            height={24}
            className={style.vues_img}
          />
          <span className={style.vues_count}>{vues}</span>
        </Link>

        <Link href={`/post/${parentPostID}`} className={style.stars_box}>
          <Image
            src="/icons/base/gold-star.svg"
            alt="stars"
            width={24}
            height={24}
            className={style.star_image}
          />
          <span className={style.star_count}>{stars}</span>
        </Link>

        <Tooltip title='Пожаловаться'>
          <button
            className={style.report_btn}
            onClick={(e) => { e.stopPropagation(); setComplaintOpen(true) }}
            aria-label='Пожаловаться на пост'
          >
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' />
              <line x1='4' y1='22' x2='4' y2='15' />
            </svg>
          </button>
        </Tooltip>

      </div>

      <PostComplaintModal
        isOpen={complaintOpen}
        onClose={() => setComplaintOpen(false)}
        postId={parentPostID}
        postTitle={postTitle}
      />
    </>
  );
};

export default PostFooterMain;
