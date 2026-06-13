'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import styles from './vip.module.scss'

const BENEFITS = [
  {
    title: 'Монетизация курсов',
    desc: 'Устанавливайте цену на свои курсы и получайте оплату напрямую.',
    bg: '#F5F4FF', stroke: '#534AB7',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    title: 'Приоритет в каталоге',
    desc: 'Ваши материалы отображаются выше в поиске и рекомендациях.',
    bg: '#F0FDF4', stroke: '#22C55E',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    title: 'Расширенная аналитика',
    desc: 'Детальная статистика просмотров, прохождений и оценок студентов.',
    bg: '#EFF6FF', stroke: '#3B82F6',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    title: 'VIP-значок на профиле',
    desc: 'Заметный знак качества, который выделяет вас среди других авторов.',
    bg: '#FFFBEB', stroke: '#F59E0B',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    title: 'Уведомления об отзывах',
    desc: 'Мгновенные оповещения об оценках и комментариях к вашим курсам.',
    bg: '#FFF1F2', stroke: '#F43F5E',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    title: 'Больше форматов контента',
    desc: 'Расширенный набор блоков — аудио, видео, интерактивные задания.',
    bg: '#F0FDFA', stroke: '#14B8A6',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
]

const PROMO_ERRORS: Record<string, string> = {
  INVALID_PROMO: 'Промокод не найден или неактивен',
  PROMO_EXPIRED: 'Срок действия промокода истёк',
  PROMO_EXHAUSTED: 'Лимит использований исчерпан',
}

function CrownIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20M4 20L2 8l5 4 5-6 5 6 5-4-2 12" />
    </svg>
  )
}

export default function VipClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activated, setActivated] = useState(false)
  const [vipUntil, setVipUntil] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoError, setPromoError] = useState('')

  const handleActivate = async () => {
    setPromoError('')
    setLoading(true)
    try {
      const res = await fetch('/api/teacher/vip/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: promoCode.trim() || undefined }),
      })
      const data = await res.json()

      if (!res.ok) {
        const promoErr = PROMO_ERRORS[data.error]
        if (promoErr) { setPromoError(promoErr); return }
        if (data.error === 'Unauthorized') {
          toast.error('Войдите в аккаунт, чтобы получить VIP')
          return
        }
        throw new Error(data.error)
      }

      setActivated(true)
      setVipUntil(data.vipUntil ? new Date(data.vipUntil).toLocaleDateString('ru-RU') : null)
      toast.success(data.promoDescription ? `🎉 ${data.promoDescription}` : 'VIP активирован!')
    } catch {
      toast.error('Не удалось активировать VIP. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.page}>

      {/* ── Hero card ── */}
      <div className={styles.heroCard}>
        <div className={styles.heroBand}>
          <div className={styles.crownWrap}><CrownIcon /></div>
          <div className={styles.vipBadge}>VIP</div>
        </div>

        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Откройте полный доступ</h1>
          <p className={styles.heroSub}>
            Монетизируйте курсы, получайте расширенную аналитику и выделяйтесь в каталоге.
          </p>

          {activated ? (
            <div className={styles.successBlock}>
              <div className={styles.successIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div className={styles.successTitle}>VIP активирован!</div>
                {vipUntil && <div className={styles.successSub}>Действует до {vipUntil}</div>}
              </div>
              <button className={styles.goBtn} onClick={() => router.push('/create-road-map')}>
                Создать курс
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          ) : (
            <div className={styles.promoBlock}>
              <div className={styles.promoRow}>
                <div className={styles.promoInputWrap}>
                  <svg className={styles.promoIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                  <input
                    className={`${styles.promoInput} ${promoError ? styles.promoInputError : ''}`}
                    type="text"
                    placeholder="Промокод (необязательно)"
                    value={promoCode}
                    onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleActivate()}
                    maxLength={32}
                  />
                </div>
                <button className={styles.activateBtn} onClick={handleActivate} disabled={loading}>
                  {loading ? <span className={styles.spinner} /> : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 20L2 8l5 4 5-6 5 6 5-4-2 12" />
                    </svg>
                  )}
                  {loading ? 'Активируем...' : 'Получить VIP'}
                </button>
              </div>
              {promoError && <p className={styles.promoError}>{promoError}</p>}
              <p className={styles.promoHint}>
                Введите промокод для бесплатной активации, или нажмите «Получить VIP» для тестового доступа.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Benefits ── */}
      <section className={styles.benefits}>
        <div className={styles.benefitsHeader}>
          <h2 className={styles.benefitsTitle}>Что входит в VIP</h2>
          <p className={styles.benefitsSub}>Инструменты для профессиональных преподавателей</p>
        </div>
        <div className={styles.grid}>
          {BENEFITS.map(b => (
            <div key={b.title} className={styles.card}>
              <div className={styles.cardIcon} style={{ background: b.bg, color: b.stroke }}>
                {b.icon}
              </div>
              <div className={styles.cardText}>
                <h3 className={styles.cardTitle}>{b.title}</h3>
                <p className={styles.cardDesc}>{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      {!activated && (
        <div className={styles.bottomCta}>
          <p className={styles.bottomCtaText}>Готовы начать?</p>
          <button className={styles.activateBtn} onClick={handleActivate} disabled={loading} style={{ margin: '0 auto' }}>
            {loading ? <span className={styles.spinner} /> : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 20L2 8l5 4 5-6 5 6 5-4-2 12" />
              </svg>
            )}
            {loading ? 'Активируем...' : 'Получить VIP бесплатно'}
          </button>
        </div>
      )}

    </main>
  )
}
