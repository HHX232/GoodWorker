'use client';

import Tooltip from '@mui/material/Tooltip';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FC, useState } from 'react';
import style from '../FullPost.module.scss';

interface IHeaderFullPost {
  postId: string;

}

const HeaderFullPost: FC<IHeaderFullPost> = ({ postId }) => {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const handleShareClick = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    navigator.clipboard
      .writeText(`https://goodworker.com/posts/${postId}`)
      .catch((err) => console.error('Ошибка копирования:', err));
  };

  return (
    <nav className={style.header_post}>
      
      <button
        className={style.arrowBack}
        onClick={() => router.back()}
        aria-label="Назад"
      >
        <Image
          src="/icons/base/leftArrowBlack.svg"
          alt="назад"
          width={24}
          height={24}
        />
      </button>

      
      <Tooltip title={copied ? 'Скопировано!' : 'Поделиться'}>
        <button
          className={style.img_comm_box_2}
          onClick={handleShareClick}
          aria-label="Поделиться"
        >
          <Image
            src="/icons/base/share.svg"
            alt="поделиться"
            width={24}
            height={24}
          />
        </button>
      </Tooltip>

      {/* Предупреждение */}
      <button className={style.warrSvg2} aria-label="Пожаловаться">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 7.75V13"
            stroke="#868897"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21.0802 8.58003V15.42C21.0802 16.54 20.4802 17.58 19.5102 18.15L13.5702 21.58C12.6002 22.14 11.4002 22.14 10.4202 21.58L4.48016 18.15C3.51016 17.59 2.91016 16.55 2.91016 15.42V8.58003C2.91016 7.46003 3.51016 6.41999 4.48016 5.84999L10.4202 2.42C11.3902 1.86 12.5902 1.86 13.5702 2.42L19.5102 5.84999C20.4802 6.41999 21.0802 7.45003 21.0802 8.58003Z"
            stroke="#868897"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 16.2002V16.3002"
            stroke="#868897"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </nav>
  );
};

export default HeaderFullPost;