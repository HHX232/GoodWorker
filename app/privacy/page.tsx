'use client'
import Link from 'next/link'
import styles from './privacy.module.css'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

// export async function generateMetadata(): Promise<Metadata> {
//   const t = await getTranslations('PageTitles')
//   return { title: t('privacy') }
// }

export default  function PrivacyPage() {
  const t =  useTranslations('PrivacyPage')

  useEffect(() => {
    // Сохраняем исходное значение overflow
    const originalOverflow = document.body.style.overflow
    
    // Устанавливаем overflow: auto !important
    document.body.style.setProperty('overflow', 'auto', 'important')
    
    // Очистка при размонтировании
    return () => {
      if (originalOverflow) {
        document.body.style.overflow = originalOverflow
      } else {
        document.body.style.removeProperty('overflow')
      }
    }
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.back}>{t('back')}</Link>

        <h1 className={styles.h1}>{t('title')}</h1>
        <p className={styles.updated}>{t('updated')}</p>

        {/* 1 */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section1Title')}</h2>
          <p dangerouslySetInnerHTML={{ __html: t('section1p1') }} />
          <p>{t('section1p2')}</p>
        </section>

        {/* 2 */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section2Title')}</h2>
          <ul className={styles.list}>
            <li dangerouslySetInnerHTML={{ __html: t('section2item1') }} />
            <li dangerouslySetInnerHTML={{ __html: t('section2item2') }} />
            <li dangerouslySetInnerHTML={{ __html: t('section2item3') }} />
            <li dangerouslySetInnerHTML={{ __html: t('section2item4') }} />
            <li dangerouslySetInnerHTML={{ __html: t('section2item5') }} />
          </ul>
        </section>

        {/* 3 */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section3Title')}</h2>
          <ul className={styles.list}>
            <li>{t('section3item1')}</li>
            <li>{t('section3item2')}</li>
            <li>{t('section3item3')}</li>
            <li>{t('section3item4')}</li>
            <li>{t('section3item5')}</li>
          </ul>
        </section>

        {/* 4 */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section4Title')}</h2>
          <p>{t('section4p1')}</p>
          <ul className={styles.list}>
            <li>{t('section4item1')}</li>
            <li>{t('section4item2')}</li>
            <li>{t('section4item3')}</li>
          </ul>
        </section>

        {/* 5 */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section5Title')}</h2>
          <p>{t('section5p1')}</p>
          <p>{t('section5p2')}</p>
        </section>

        {/* 6 */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section6Title')}</h2>
          <p>{t('section6p1')}</p>
        </section>

        {/* 7 */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section7Title')}</h2>
          <p>{t('section7p1')}</p>
          <ul className={styles.list}>
            <li>{t('section7item1')}</li>
            <li>{t('section7item2')}</li>
            <li>{t('section7item3')}</li>
            <li>{t('section7item4')}</li>
          </ul>
          <p>{t('section7p2')}</p>
        </section>

        {/* 8 */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section8Title')}</h2>
          <p>{t('section8p1')}</p>
        </section>

        {/* 9 */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section9Title')}</h2>
          <p>{t('section9p1')}</p>
        </section>

        {/* 10 */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section10Title')}</h2>
          <p>{t('section10p1')}</p>
          <ul className={styles.list}>
            <li>
              {t.rich('section10item1', {
                feedbackLink: (chunks) => (
                  <Link href="/feedback" className={styles.inlineLink}>{chunks}</Link>
                ),
              })}
            </li>
            <li>
              {t.rich('section10item2', {
                complaintsLink: (chunks) => (
                  <Link href="/complaints" className={styles.inlineLink}>{chunks}</Link>
                ),
              })}
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}