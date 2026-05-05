'use client'

import {useOnlineStatus} from '@/features/hooks/User/useOnlineStatus'
import {formatActivity} from '@/shared/helpers/formatActivity'
import {DotsMenuProps, UserHeaderCardProps} from '@/shared/types'
import Image from 'next/image'
import Link from 'next/link'
import {FC, useState} from 'react'
import UserRole from '../UserRole/UserRole'
import style from './UserHeaderCard.module.scss'

const DOTS_IMAGE = '/icons/base/threeDats.svg'
const USER_STUB = '/stubs/stub-4.jpg'
const PALETTES = [
  {bg: '#1d4ed8', text: '#93c5fd'},
  {bg: '#7c3aed', text: '#c4b5fd'},
  {bg: '#0f766e', text: '#99f6e4'},
  {bg: '#b45309', text: '#fde68a'},
  {bg: '#be123c', text: '#fda4af'},
  {bg: '#15803d', text: '#86efac'},
  {bg: '#c2410c', text: '#fed7aa'},
  {bg: '#1d4ed8', text: '#bfdbfe'}
]

export function getAvatarColor(name: string): {bg: string; text: string} {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PALETTES[Math.abs(hash) % PALETTES.length]
}
const AvatarFallback: FC<{name: string; size?: 'lg' | 'sm'}> = ({name, size = 'lg'}) => {
  const letter = name?.trim()?.[0]?.toUpperCase() ?? '?'
  const {bg, text} = getAvatarColor(name ?? '')
  const px = size === 'sm' ? 28 : 42

  return (
    <div
      className={`${style.user_image} ${size === 'sm' ? style.little_image : ''}`}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        backgroundColor: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size === 'sm' ? 12 : 18,
        fontWeight: 600,
        color: text,
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      {letter}
    </div>
  )
}
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
  const {online, lastSeenAt} = useOnlineStatus(userID)
  const computedDateActivity = dateActivity || formatActivity(online, lastSeenAt)
  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setActiveMenu((prev) => !prev)
  }
  const [imgError, setImgError] = useState(false)
  const showFallback = !image || imgError
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
          {showFallback ? (
            <AvatarFallback name={name ?? ''} size={size} />
          ) : (
            <Image
              className={`${style.user_image} ${size === 'sm' && style.little_image}`}
              src={image!}
              alt='User avatar'
              width={42}
              height={42}
              onError={() => setImgError(true)}
            />
          )}
        </Link>
      ) : showFallback ? (
        <AvatarFallback name={name ?? ''} size={size} />
      ) : (
        <Image
          className={`${style.user_image} ${size === 'sm' && style.little_image}`}
          src={image!}
          alt='User avatar'
          width={42}
          height={42}
          onError={() => setImgError(true)}
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
                className={`${style.user_active} ${computedDateActivity === 'Online' ? style.user_active_online : ''} ${size === 'sm' && style.user__little_online}`}
              >
                {computedDateActivity}
              </p>
              <div
                className={`${style.user_active_pin} ${computedDateActivity === 'Online' ? style.user_active_pin_online : ''}`}
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
                className={`${style.user_active} ${computedDateActivity === 'Online' ? style.user_active_online : ''} ${size === 'sm' && style.user__little_online}`}
              >
                {computedDateActivity}
              </p>
              <div
                className={`${style.user_active_pin} ${computedDateActivity === 'Online' ? style.user_active_pin_online : ''}`}
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
