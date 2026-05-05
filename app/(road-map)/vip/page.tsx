'use client'

import { TextInputUI } from '@/shared/ui/inputs/TextInputUI/TextInputUI'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import styles from './vip.module.scss'

const BENEFITS = [
  { icon: '💰', title: 'Монетизация роадмапов', desc: 'Устанавливайте цену на свои курсы и получайте оплату.' },
  { icon: '🚀', title: 'Приоритет в каталоге', desc: 'Ваши роадмапы показываются выше в поиске.' },
  { icon: '📊', title: 'Расширенная аналитика', desc: 'Детальная статистика просмотров, прохождений и оценок.' },
  { icon: '🏷️', title: 'VIP-значок на профиле', desc: 'Выделяйтесь среди других преподавателей.' },
  { icon: '🔔', title: 'Уведомления об отзывах', desc: 'Мгновенные уведомления об оценках и комментариях.' },
  { icon: '🎨', title: 'Расширенная кастомизация', desc: 'Больше блоков и медиа-форматов в конструкторе.' },
]

const PROMO_ERRORS: Record<string, string> = {
  INVALID_PROMO: 'Промокод не найден или неактивен',
  PROMO_EXPIRED: 'Срок действия промокода истёк',
  PROMO_EXHAUSTED: 'Промокод уже использован максимальное количество раз',
}

export default function VipPage() {
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
        if (promoErr) {
          setPromoError(promoErr)
          return
        }
        if (data.error === 'Unauthorized') {
          toast.error('Войдите в аккаунт, чтобы получить VIP')
          return
        }
        throw new Error(data.error)
      }

      setActivated(true)
      setVipUntil(data.vipUntil ? new Date(data.vipUntil).toLocaleDateString('ru-RU') : null)

      if (data.promoDescription) {
        toast.success(`🎉 ${data.promoDescription}`)
      } else {
        toast.success('VIP активирован! 🎉')
      }
    } catch {
      toast.error('Не удалось активировать VIP. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.crown}>👑</div>
        <h1 className={styles.hero_title}>Получите VIP-доступ</h1>
        <p className={styles.hero_sub}>
          Откройте монетизацию, приоритетное размещение и расширенные инструменты для преподавателей.
        </p>

        {!activated ? (
          <div className={styles.activate_wrap}>
            <TextInputUI
              placeholder="Промокод (необязательно)"
              currentValue={promoCode}
              onSetValue={(v) => { setPromoCode(v); setPromoError('') }}
              errorValue={promoError}
              theme="newWhite"
              extraClass={styles.promo_input}
            />
            <button
              className={styles.cta_btn}
              onClick={handleActivate}
              disabled={loading}
            >
              {loading ? <span className={styles.spinner} /> : <span>👑</span>}
              {loading ? 'Активируем...' : 'Активировать VIP'}
            </button>
          </div>
        ) : (
          <div className={styles.success_wrap}>
            <div className={styles.success_badge}>✓ VIP активирован!</div>
            {vipUntil && <p className={styles.vip_until}>Действует до: {vipUntil}</p>}
            <button className={styles.goto_btn} onClick={() => router.push('/create-road-map')}>
              Создать роадмап →
            </button>
          </div>
        )}

        <p className={styles.stub_note}>
          ⚠️ Это тестовая заглушка. В продакшене здесь будет оплата.
        </p>
      </section>

      {/* Benefits grid */}
      <section className={styles.benefits}>
        <h2 className={styles.benefits_title}>Что входит в VIP</h2>
        <div className={styles.benefits_grid}>
          {BENEFITS.map((b) => (
            <div key={b.title} className={styles.benefit_card}>
              <span className={styles.benefit_icon}>{b.icon}</span>
              <h3 className={styles.benefit_name}>{b.title}</h3>
              <p className={styles.benefit_desc}>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
