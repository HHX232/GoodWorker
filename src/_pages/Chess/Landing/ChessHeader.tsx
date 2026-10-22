'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { LangSwitcher } from '@/widgets/BaseUI/LangSwitcher/LangSwitcher'
import { useMe } from '@/features/hooks/User/useMe'
import { useThemeCtx } from '@/app/providers/ThemeContext'
import { getSkin } from '@/widgets/Chess/Board'
import s from './ChessHeader.module.scss'

// GoodChess bar for /info-chess: transparent over the night stage, turns to dark glass once the page scrolls,
// so it stays readable over the warm field below. The site's own header is hidden on this page (see the scss).

const Knight = getSkin('classic').pieces.wN

export const BRAND = 'GoodChess'

const ANCHORS = [
  { href: '#gwl-top', key: 'nav_game' },
  { href: '#gwl-features', key: 'nav_features' },
  { href: '#gwl-faq', key: 'nav_faq' },
] as const

export function ChessHeader() {
  const t = useTranslations('chess.landing')
  const { data: user } = useMe()
  const { isDark, toggleTheme } = useThemeCtx()
  const [solid, setSolid] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  const profile = user ? (user.role === 'TEACHER' ? '/teacher-profile' : '/student-profile') : '/login'
  const account = user ? (
    <Link href={profile} className={s.me} aria-label={user.name}>
      {user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={32} height={32} /> : <span>{user.name.slice(0, 2).toUpperCase()}</span>}
    </Link>
  ) : (
    <Link href="/login" className={s.login}>
      {t('nav_login')}
    </Link>
  )

  return (
    <header className={s.bar} data-gc-header="" data-solid={solid || open ? '' : undefined}>
      <div className={s.inner}>
        <a href="#gwl-top" className={s.brand} aria-label={BRAND}>
          <span className={s.mark} aria-hidden="true">
            <Knight className={s.markPiece} />
          </span>
          <span className={s.word}>
            Good<b>Chess</b>
          </span>
        </a>

        <nav className={s.nav} aria-label={t('nav_label')}>
          {ANCHORS.map((a) => (
            <a key={a.href} href={a.href}>
              {t(a.key)}
            </a>
          ))}
        </nav>

        <div className={s.tools}>
          <button type="button" className={s.icon} onClick={toggleTheme} aria-label={t('nav_theme')}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <LangSwitcher extraClass={s.lang} />
          {account}
          <Link href="/chess/play" className={s.play}>
            {t('nav_play')}
          </Link>
        </div>

        <div className={s.mobile}>
          <Link href="/chess/play" className={s.play}>
            {t('nav_play')}
          </Link>
          <button type="button" className={s.icon} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="gc-menu" aria-label={t('nav_menu')}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div id="gc-menu" className={s.sheet}>
          {ANCHORS.map((a) => (
            <a key={a.href} href={a.href} onClick={() => setOpen(false)}>
              {t(a.key)}
            </a>
          ))}
          <div className={s.sheetRow}>
            <button type="button" className={s.icon} onClick={toggleTheme} aria-label={t('nav_theme')}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <LangSwitcher extraClass={s.lang} />
            {account}
          </div>
        </div>
      )}
    </header>
  )
}
