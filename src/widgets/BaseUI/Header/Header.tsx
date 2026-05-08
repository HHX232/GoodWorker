'use client'
import { LangSwitcher } from '../LangSwitcher/LangSwitcher'
import { ProfilePreview } from '@/widgets/ProfilePreview/ProfilePreview'
import { HeaderSearch } from './HeaderSearch'
import { NotificationBell } from './NotificationBell'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import styles from './Header.module.scss'

const LogoBigUrl = '/logos/BigLogo.svg'
const LogoMobileUrl = '/logos/MobileLogo.svg'

function Header() {
  const t = useTranslations('Header')

  return (
    <header className={styles.wrapper}>
      <div className={`${styles.inner} container`}>
        <Link href='/' className={styles.logo_big}>
          <Image className={styles.logo_big} width={100} height={100} alt={t('catalog')} src={LogoBigUrl} />
        </Link>
        <Link href='/' className={styles.logo_small}>
          <Image className={styles.logo_small} width={100} height={100} alt={t('catalog')} src={LogoMobileUrl} />
        </Link>

        <HeaderSearch />

        <div className={styles.right_group}>
          <LangSwitcher />
          <NotificationBell />
          <ProfilePreview />
        </div>
      </div>
    </header>
  )
}

export default Header
