'use client'
import Link from 'next/link'
import styles from './terms.module.css'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'



export default  function TermsPage() {
  const t = useTranslations('TermsPage')
useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.setProperty('overflow', 'auto', 'important')
    
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

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section1Title')}</h2>
          <p dangerouslySetInnerHTML={{ __html: t('section1p1') }} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section2Title')}</h2>
          <p>{t('section2p1')}</p>
          <ul className={styles.list}>
            <li>{t('section2item1')}</li>
            <li>{t('section2item2')}</li>
            <li>{t('section2item3')}</li>
            <li>{t('section2item4')}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section3Title')}</h2>
          <p>{t('section3p1')}</p>
          <ul className={styles.list}>
            <li>{t('section3item1')}</li>
            <li>{t('section3item2')}</li>
            <li>{t('section3item3')}</li>
            <li>{t('section3item4')}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section4Title')}</h2>
          <p>{t('section4p1')}</p>
          <ul className={styles.list}>
            <li>{t('section4item1')}</li>
            <li>{t('section4item2')}</li>
            <li>{t('section4item3')}</li>
            <li>{t('section4item4')}</li>
            <li>{t('section4item5')}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section5Title')}</h2>
          <p>{t('section5p1')}</p>
          <ul className={styles.list}>
            <li>{t('section5item1')}</li>
            <li>{t('section5item2')}</li>
            <li>{t('section5item3')}</li>
          </ul>
          <p>{t('section5p2')}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section6Title')}</h2>
          <p>{t('section6p1')}</p>
          <p>{t('section6p2')}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section7Title')}</h2>
          <p>{t('section7p1')}</p>
          <p>{t('section7p2')}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section8Title')}</h2>
          <p>{t('section8p1')}</p>
          <ul className={styles.list}>
            <li>{t('section8item1')}</li>
            <li>{t('section8item2')}</li>
            <li>{t('section8item3')}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section9Title')}</h2>
          <p>{t('section9p1')}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section10Title')}</h2>
          <p>{t('section10p1')}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section11Title')}</h2>
          <p>{t('section11p1')}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section12Title')}</h2>
          <p>{t('section12p1')}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>{t('section13Title')}</h2>
          <p>{t('section13p1')}</p>
          <ul className={styles.list}>
            <li>
              <Link href="/feedback" className={styles.inlineLink}>
                {t('section13item1')}
              </Link>
            </li>
            <li>
              {t.rich('section13item2', {
                privacyLink: (chunks) => (
                  <Link href="/privacy" className={styles.inlineLink}>
                    {chunks}
                  </Link>
                ),
              })}
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}