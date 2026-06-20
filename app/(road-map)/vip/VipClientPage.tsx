'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  Tag, Video, FileText, FileUp, MessageSquare,
  Star, ArrowRight, CheckCircle, Zap, Users, BookOpen,
} from 'lucide-react'
import Link from 'next/link'
import styles from './vip.module.scss'

// ── Starfield ──────────────────────────────────────────────

const STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  top: Math.random() * 100,
  left: Math.random() * 100,
  size: 1 + Math.random() * 2,
  delay: Math.random() * 6,
  dur: 2.5 + Math.random() * 3,
}))

function Starfield() {
  return (
    <div className={styles.starfield} aria-hidden>
      {STARS.map(s => (
        <motion.div
          key={s.id}
          style={{
            position: 'absolute',
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: '#fff',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.7, 0] }}
          transition={{ duration: s.dur, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

// ── Features ───────────────────────────────────────────────

const FEATURES = [
  {
    icon: <Video size={18} />,
    bg: '#eff6ff', color: '#2563eb',
    title: 'Видеозвонки без ограничений',
    desc: 'Приглашайте любое количество участников. У обычных пользователей — лимит 3 человека.',
    tag: null,
  },
  {
    icon: <Tag size={18} />,
    bg: '#f0fdf4', color: '#16a34a',
    title: 'Платные курсы и роадмапы',
    desc: 'Устанавливайте цену и монетизируйте свои материалы напрямую через платформу.',
    tag: null,
  },
  {
    icon: <FileText size={18} />,
    bg: '#fdf4ff', color: '#9333ea',
    title: 'PDF → тест: до 50 страниц',
    desc: 'Загружайте объёмные документы. Без VIP — только 5 страниц за раз.',
    tag: '10× больше',
  },
  {
    icon: <FileUp size={18} />,
    bg: '#fff7ed', color: '#ea580c',
    title: 'DOCX, TXT, RTF, ODT',
    desc: 'Создавайте тесты из документов Word, текстовых файлов и других форматов.',
    tag: 'Только VIP',
  },
  {
    icon: <Zap size={18} />,
    bg: '#fefce8', color: '#ca8a04',
    title: 'До 20 вопросов в тесте',
    desc: 'ИИ генерирует полноценный тест. Гости и обычные пользователи получают не больше 5.',
    tag: '4× больше',
  },
  {
    icon: <Star size={18} />,
    bg: '#fdf2f8', color: '#db2777',
    title: 'VIP-значок на профиле',
    desc: 'Заметный знак качества, который выделяет вас среди других авторов в каталоге.',
    tag: null,
  },
  {
    icon: <Users size={18} />,
    bg: '#f0fdfa', color: '#0d9488',
    title: 'Приоритет в каталоге',
    desc: 'Ваши материалы и профиль отображаются выше в поиске и рекомендациях.',
    tag: null,
  },
  {
    icon: <BookOpen size={18} />,
    bg: '#f8fafc', color: '#475569',
    title: 'VIP-посты',
    desc: 'Доступ к эксклюзивным материалам, доступным только VIP пользователям.',
    tag: null,
  },
  {
    icon: <MessageSquare size={18} />,
    bg: '#fff1f2', color: '#e11d48',
    title: 'Приоритетная поддержка',
    desc: 'Ваши обращения обрабатываются в первую очередь.',
    tag: null,
  },
]

// ── Errors ─────────────────────────────────────────────────

const PROMO_ERRORS: Record<string, string> = {
  INVALID_PROMO: 'Промокод не найден или неактивен',
  PROMO_EXPIRED: 'Срок действия промокода истёк',
  PROMO_EXHAUSTED: 'Лимит использований исчерпан',
  ALREADY_USED: 'Вы уже использовали этот промокод',
}

// ── Page ───────────────────────────────────────────────────

export default function VipClientPage() {
  const router = useRouter()

  useEffect(() => {
    document.body.style.setProperty('overflow', 'auto', 'important')
    document.documentElement.classList.add('vip-dark')
    return () => {
      document.body.style.removeProperty('overflow')
      document.documentElement.classList.remove('vip-dark')
    }
  }, [])

  const [loading, setLoading] = useState(false)
  const [activated, setActivated] = useState(false)
  const [vipUntil, setVipUntil] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoError, setPromoError] = useState('')

  const handleActivate = async () => {
    setPromoError('')
    if (!promoCode.trim()) {
      setPromoError('Введите промокод')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/teacher/vip/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: promoCode.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        const promoErr = PROMO_ERRORS[data.error]
        if (promoErr) { setPromoError(promoErr); return }
        if (data.error === 'Unauthorized') {
          toast.error('Войдите в аккаунт, чтобы активировать VIP')
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

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <Starfield />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={styles.heroBadge}
        >
          <Star size={11} fill="currentColor" />
          GOODWORKER VIP
        </motion.div>

        <motion.h1
          className={styles.heroTitle}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Раскройте полный<br />потенциал платформы
        </motion.h1>

        <motion.p
          className={styles.heroSub}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Больше инструментов, больше контента, больше возможностей для монетизации.
        </motion.p>
      </section>

      <div className={styles.content}>

        {/* ── Features ── */}
        <section>
          <p className={styles.sectionLabel}>Что входит в VIP</p>
          <div className={styles.grid}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                className={styles.featureCard}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <div className={styles.featureIcon} style={{ background: f.bg, color: f.color }}>
                  {f.icon}
                </div>
                <div>
                  <h3 className={styles.featureTitle}>{f.title}</h3>
                  <p className={styles.featureDesc}>{f.desc}</p>
                  {f.tag && (
                    <span
                      className={styles.featureTag}
                      style={{ background: f.bg, color: f.color }}
                    >
                      {f.tag}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── How to get VIP ── */}
        <section>
          <p className={styles.sectionLabel}>Как получить VIP</p>
          <div className={styles.getSection}>

            {/* Promo code card */}
            <motion.div
              className={styles.getCard}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <div className={styles.getCardHeader}>
                <div className={styles.getCardNum}>1</div>
                <div>
                  <p className={styles.getCardTitle}>Активировать промокод</p>
                  <p className={styles.getCardSub}>Введите промокод — VIP начнёт работать сразу</p>
                </div>
              </div>
              <div className={styles.getCardBody}>
                {activated ? (
                  <div className={styles.successBlock}>
                    <div className={styles.successIconWrap}>
                      <CheckCircle size={20} />
                    </div>
                    <div>
                      <div className={styles.successTitle}>VIP активирован!</div>
                      {vipUntil && <div className={styles.successSub}>Действует до {vipUntil}</div>}
                    </div>
                    <Link href="/create-road-map" className={styles.goBtn}>
                      Создать курс
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className={styles.promoRow}>
                      <div className={styles.promoInputWrap}>
                        <span className={styles.promoIconWrap}>
                          <Tag size={14} />
                        </span>
                        <input
                          className={`${styles.promoInput} ${promoError ? styles.promoInputError : ''}`}
                          type="text"
                          placeholder="Введите промокод"
                          value={promoCode}
                          onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError('') }}
                          onKeyDown={e => e.key === 'Enter' && handleActivate()}
                          maxLength={32}
                        />
                      </div>
                      <button className={styles.activateBtn} onClick={handleActivate} disabled={loading}>
                        {loading ? <span className={styles.spinner} /> : <Star size={14} />}
                        {loading ? 'Активируем…' : 'Активировать'}
                      </button>
                    </div>
                    {promoError && <p className={styles.promoError}>{promoError}</p>}
                    <p className={styles.promoHint}>Промокоды чувствительны к регистру — вводите заглавными буквами.</p>
                  </>
                )}
              </div>
            </motion.div>

            {/* Free hint: first feedback */}
            <motion.div
              className={styles.freeHintCard}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className={styles.freeHintIcon}>
                <MessageSquare size={17} />
              </div>
              <div className={styles.freeHintText}>
                <p>
                  <strong>Оставьте первый отзыв</strong> о платформе — и получите промокод на&nbsp;
                  <strong>7 дней VIP автоматически</strong> в уведомлениях.
                </p>
                <Link href="/feedback" className={styles.freeHintLink}>
                  Оставить отзыв
                  <ArrowRight size={12} />
                </Link>
              </div>
            </motion.div>

          </div>
        </section>

      </div>
    </main>
  )
}
