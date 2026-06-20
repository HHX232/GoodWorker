'use client'
import { LangSwitcher } from '../LangSwitcher/LangSwitcher'
import { ProfilePreview } from '@/widgets/ProfilePreview/ProfilePreview'
import { HeaderSearch } from './HeaderSearch'
import { NotificationBell } from './NotificationBell'
import { PomodoroButton } from '@/widgets/Pomodoro/PomodoroButton'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useThemeCtx } from '@/app/providers/ThemeContext'
import styles from './Header.module.scss'

const LogoBigUrl = '/logos/BigLogo.svg'
const LogoMobileUrl = '/logos/MobileLogo.svg'

const NAV_LINKS = [
  { href: '/teachers', key: 'sub_teachers' },
  { href: '/posts', key: 'sub_posts' },
] as const

function Header() {
  const t = useTranslations('Header')
  const tLanding = useTranslations('LandingPage')
  const pathname = usePathname()
  const { isDark, toggleTheme } = useThemeCtx()

  if (pathname === '/call' || pathname.startsWith('/call/')) return null

  const isProfilePage = pathname.startsWith('/profile')

  return (
    <header className={styles.wrapper}>
      <div className={`${styles.inner} container`}>
        <Link href='/' className={styles.logo_big}>
          <Image className={styles.logo_big} width={100} height={100} alt={t('catalog')} src={LogoBigUrl} />
        </Link>
        <Link href='/' className={styles.logo_small}>
          <Image className={styles.logo_small} width={100} height={100} alt={t('catalog')} src={LogoMobileUrl} />
        </Link>

        {isProfilePage ? (
          <nav className={styles.center_nav}>
            {NAV_LINKS.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className={`${styles.center_nav_link} ${pathname.startsWith(href) ? styles.center_nav_link_active : ''}`}
              >
                {tLanding(key)}
              </Link>
            ))}
          </nav>
        ) : (
          <HeaderSearch />
        )}

        <div className={styles.right_group}>
          <button
            className={`${styles.theme_btn} ${isDark ? styles.theme_btn_active : ''}`}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          <PomodoroButton />
          <LangSwitcher />
          <NotificationBell />
          <ProfilePreview />
        </div>
      </div>
    </header>
  )
}

export default Header
