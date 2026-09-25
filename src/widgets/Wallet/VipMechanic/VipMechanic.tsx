'use client'

import { useTranslations } from 'next-intl'
import { Gift, Sparkles, Wallet } from 'lucide-react'
import styles from './VipMechanic.module.scss'

const STEP_ICONS = [<Wallet key="0" size={16} />, <Gift key="1" size={16} />, <Sparkles key="2" size={16} />]

// The "how top-up → VIP works" explainer from /vip (TopUpSection in
// app/(road-map)/vip/VipClientPage.tsx) — same copy (namespace 'vip':
// mechanic.* / steps), restyled on the wallet tokens.
export function VipMechanic() {
  const t = useTranslations('vip')
  const steps = t.raw('steps') as { title: string; desc: string }[]

  return (
    <section className={styles.wrap}>
      <div className={styles.banner}>
        <div className={styles.bannerIcon}><Gift size={20} /></div>
        <div>
          <p className={styles.bannerTitle}>{t('mechanic.title')}</p>
          <p className={styles.bannerSub}>{t('mechanic.sub')}</p>
        </div>
      </div>

      <div className={styles.steps}>
        {steps.map((s, i) => (
          <div key={s.title} className={styles.step}>
            <div className={styles.stepIcon}>{STEP_ICONS[i]}</div>
            <div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
