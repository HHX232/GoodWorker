'use client'

import { DotsMenuProps, UserHeaderCardProps } from '@/shared/types'
import Image from 'next/image'
import Link from 'next/link'
import { FC, useState } from 'react'
import UserRole from '../UserRole/UserRole'
import style from './UserHeaderCard.module.scss'

const DOTS_IMAGE = '/icons/base/threeDats.svg'
const USER_STUB = '/stubs/stub-4.jpg'

export const DotsMenu: FC<DotsMenuProps> = ({activeMenu, toggleMenu, handleShareClick, maxWidth = '24'}) => {
  return (
    <div className={style.dots_menu_box}>
      <Image
        src={DOTS_IMAGE}
        alt='menu'
        width={Number(maxWidth)}
        height={Number(maxWidth)}
        style={{width: `${maxWidth}px`, height: 'auto'}}
        onClick={toggleMenu}
        className={style.dots_image}
      />
      {activeMenu && (
        <ul style={{bottom: `-${Number(maxWidth) * 2.8}px`}} className={style.dots_menu}>
          <li className={style.dots_menu_item}>
            <p className={style.report}>Пожаловаться</p>
          </li>
          <li onClick={handleShareClick} className={style.dots_menu_item}>
            <p className={style.share_item}>Поделиться</p>
          </li>
        </ul>
      )}
    </div>
  )
}

const UserHeaderCard: FC<UserHeaderCardProps> = ({
  image,
  userID,
  cardID,
  colorTitle = '141416',
  accentColor = '868897',
  blurBg = false,
  BlurDots = false,
  role,
  dateActivity,
  name,
  useLink = true,
  size = 'lg'
}) => {
  const [activeMenu, setActiveMenu] = useState(false)

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setActiveMenu((prev) => !prev)
  }

  const handleShareClick = (e: React.MouseEvent<HTMLLIElement>) => {
    if (typeof window === 'undefined') return
    e.stopPropagation()
    const urlToCopy = `https://goodworker.com/posts/${cardID}`
    navigator.clipboard
      .writeText(urlToCopy)
      .then(() => console.log('Ссылка скопирована!'))
      .catch((err) => console.error('Ошибка копирования:', err))
  }

  return (
    <div className={style.user_box}>
      {useLink ? (
        <Link href={`/users/${userID}`}>
          <Image
            className={`${style.user_image} ${size === 'sm' && style.little_image}`}
            src={image ?? USER_STUB}
            alt='User avatar'
            width={42}
            height={42}
          />
        </Link>
      ) : (
        <Image
          className={`${style.user_image} ${size === 'sm' && style.little_image}`}
          src={image ?? USER_STUB}
          alt='User avatar'
          width={42}
          height={42}
        />
      )}

      <div className={style.user_data_box}>
        {useLink ? (
          <Link href={`/users/${userID}`} className={style.some_text_box}>
            <p
              style={{color: `#${colorTitle}`}}
              className={`${style.user_name} ${size === 'sm' && style.user__little_name}`}
            >
              {name}
            </p>
            <div className={style.user_subdata_box}>
              <p
                style={{color: `#${accentColor}`}}
                className={`${style.user_active} ${dateActivity === 'Online' ? style.user_active_online : ''} ${size === 'sm' && style.user__little_online}`}
              >
                {dateActivity}
              </p>
              <div
                className={`${style.user_active_pin} ${dateActivity === 'Online' ? style.user_active_pin_online : ''}`}
              />
              <UserRole
                fontSize={size === 'sm' ? '10px' : '12px'}
                accentColor={accentColor}
                blurBg={blurBg}
                userRole={role ?? 'User'}
              />
            </div>
          </Link>
        ) : (
          <div className={style.some_text_box}>
            <p
              style={{color: `#${colorTitle}`}}
              className={`${style.user_name} ${size === 'sm' && style.user__little_name}`}
            >
              {name}
            </p>
            <div className={style.user_subdata_box}>
              <p
                style={{color: `#${accentColor}`}}
                className={`${style.user_active} ${dateActivity === 'Online' ? style.user_active_online : ''} ${size === 'sm' && style.user__little_online}`}
              >
                {dateActivity}
              </p>
              <div
                className={`${style.user_active_pin} ${dateActivity === 'Online' ? style.user_active_pin_online : ''}`}
              />
              <UserRole
                fontSize={size === 'sm' ? '10px' : '12px'}
                accentColor={accentColor}
                blurBg={blurBg}
                userRole={role ?? 'User'}
              />
            </div>
          </div>
        )}

        {!BlurDots && <DotsMenu activeMenu={activeMenu} toggleMenu={toggleMenu} handleShareClick={handleShareClick} />}
      </div>
    </div>
  )
}

export default UserHeaderCard
