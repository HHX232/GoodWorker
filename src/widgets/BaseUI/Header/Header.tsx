'use client'
import { PAGES_WITH_POSTS, PAGES_WITH_ROAD_MAPS } from '@/shared/constants/pages/pages.constants'
import { SearchInputUI } from '@/shared/ui'
import { FilterModal } from '@/shared/ui/Modals/FilterModal/FilterModal'
import { ProfilePreview } from '@/widgets/ProfilePreview/ProfilePreview'
import { SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LangSwitcher } from '../LangSwitcher/LangSwitcher'
import styles from './Header.module.scss'

const LogoBigUrl = '/logos/BigLogo.svg'
const LogoMobileUrl = '/logos/MobileLogo.svg'
const matchPath = (patterns: string[], pathname: string) => {
  return patterns.some(pattern => {
    const regexPattern = pattern
      .replace(/{id}/g, '\\d+') 
      .replace(/\//g, '\\/');  

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(pathname);
  });
};
function Header() {
  const t = useTranslations('Header')
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  return (
    <header className={styles.wrapper}>
      <div className={`${styles.inner} container`}>
        {/* Logo */}
        <Link href='/' className={styles.logo_big}>
          <Image className={styles.logo_big} width={100} height={100} alt={t('catalog')} src={LogoBigUrl} />
        </Link>
        <Link href='/' className={styles.logo_small}>
          <Image className={styles.logo_small} width={100} height={100} alt={t('catalog')} src={LogoMobileUrl} />
        </Link>

       {matchPath(PAGES_WITH_POSTS, pathname) && <div className={styles.search_box}>
          <SearchInputUI placeholder={t('search')} />
          <button className={styles.btn} onClick={() => setIsOpen(true)}>
            <SlidersHorizontal size={16} />
            Фильтры
          </button>
          <FilterModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </div>}
       {matchPath(PAGES_WITH_ROAD_MAPS, pathname) && <div className={styles.search_box}>
          <SearchInputUI placeholder={t('search')} />
          <button className={styles.btn} onClick={() => setIsOpen(true)}>
            <SlidersHorizontal size={16} />
            Фильтры RM
          </button>
          <FilterModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </div>}

        <LangSwitcher  extraClass={!matchPath(PAGES_WITH_POSTS, pathname) ? styles.extra_switcher : ''}/>
        <ProfilePreview />
      </div>
    </header>
  )
}

export default Header
