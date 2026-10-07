'use client'

import { ArrowRight } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { cx } from './motion'
import s from './StorageLanding.module.scss'

/**
 * «Попробовать бесплатно»: гость → регистрация, залогиненный → само хранилище (/files).
 * (/register для залогиненного редиректит на главную, а /files для гостя — на /login.)
 */
export function CtaLink({ inverted }: { inverted?: boolean }) {
   const t = useTranslations('StorageLanding')
   const { status } = useSession()
   return (
      <Link className={cx(s.btn, inverted && s.inv)} href={status === 'authenticated' ? '/files' : '/register'}>
         {t('hero_cta1')}
         <span className={s.arr} aria-hidden='true'>
            <ArrowRight className={s.ic} />
         </span>
      </Link>
   )
}
