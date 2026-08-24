'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import {
  Tag, Video, FileText, FileUp, MessageSquare,
  Star, ArrowRight, CheckCircle, Zap, Users, BookOpen, X, Copy, Gift,
} from 'lucide-react'
import Link from 'next/link'
import styles from './vip.module.scss'

// ── Starfield ──────────────────────────────────────────────

function makeStars() {
  return Array.from({ length: 80 }, (_, i) => ({
    id: i,
    top: Math.random() * 100,
    left: Math.random() * 100,
    size: 1 + Math.random() * 2,
    delay: Math.random() * 6,
    dur: 2.5 + Math.random() * 3,
  }))
}

function Starfield() {
  // Random star positions can't be rendered during SSR without mismatching what the client
  // re-generates on hydration — render nothing until mounted, then fill in client-side.
  const [stars, setStars] = useState<ReturnType<typeof makeStars>>([])
  useEffect(() => { setStars(makeStars()) }, [])

  return (
    <div className={styles.starfield} aria-hidden>
      {stars.map(s => (
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
    desc: 'ИИ генерирует полноценный тест, а VIP при загрузке документа может одной галочкой снять лимит в 20 вопросов, если материала хватает на больше.',
    tag: 'Без лимита для VIP',
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

// ── Promo activation form (shared between the inline "How to get VIP" card and the buy modal) ──

interface PromoFormProps {
  activated: boolean
  vipUntil: string | null
  promoCode: string
  setPromoCode: (v: string) => void
  promoError: string
  setPromoError: (v: string) => void
  loading: boolean
  onActivate: () => void
}

function PromoForm({ activated, vipUntil, promoCode, setPromoCode, promoError, setPromoError, loading, onActivate }: PromoFormProps) {
  if (activated) {
    return (
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
    )
  }
  return (
    <>
      <div className={styles.promoRow}>
        <div className={styles.promoInputWrap}>
          <span className={styles.promoIconWrap}>
            <Tag size={14} />
          </span>
          <input
            className={`${styles.promoInput} ${promoError ? styles.promoInputError : ''}`}
            type="text"
            aria-label="Промокод"
            aria-invalid={!!promoError}
            placeholder="Введите промокод"
            value={promoCode}
            onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError('') }}
            onKeyDown={e => e.key === 'Enter' && onActivate()}
            maxLength={32}
          />
        </div>
        <button className={styles.activateBtn} onClick={onActivate} disabled={loading}>
          {loading ? <span className={styles.spinner} /> : <Star size={14} />}
          {loading ? 'Активируем…' : 'Активировать'}
        </button>
      </div>
      {promoError && <p className={styles.promoError}>{promoError}</p>}
      <p className={styles.promoHint}>Промокоды чувствительны к регистру — вводите заглавными буквами.</p>
    </>
  )
}

// ── Referral card (invite friends → free VIP for both sides) ──

interface ReferralData {
  link: string
  rewardDays: number
  isUnlimited: boolean
  maxFreeInvites: number
  invitesUsed: number
  remaining: number | null
}

function ReferralCard() {
  const { status } = useSession()
  const [data, setData] = useState<ReferralData | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    fetch('/api/referral/me')
      .then(res => { if (!res.ok) throw new Error('failed'); return res.json() })
      .then(json => { if (!cancelled) setData(json) })
      .catch(() => { if (!cancelled) setLoadFailed(true) })
    return () => { cancelled = true }
  }, [status])

  async function handleCopy() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.link)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = data.link
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
    }
    setCopied(true)
    toast.success('Ссылка скопирована')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      id="referral-card"
      className={styles.getCard}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: 0.05 }}
    >
      <div className={styles.getCardHeader}>
        <div className={styles.getCardNum}><Gift size={14} /></div>
        <div>
          <p className={styles.getCardTitle}>Получить бесплатный VIP — позвать друзей</p>
          <p className={styles.getCardSub}>
            {status === 'authenticated' && data
              ? `Друг регистрируется по вашей ссылке — вы получаете +${data.rewardDays} дн. VIP, и друг тоже`
              : 'Пригласите друга по личной ссылке — бонус получите оба'}
          </p>
        </div>
      </div>
      <div className={styles.getCardBody}>
        {status === 'loading' && <p className={styles.promoHint}>Загрузка…</p>}

        {status === 'unauthenticated' && (
          <p className={styles.promoHint}>
            <Link href="/login" className={styles.freeHintLink}>Войдите в аккаунт</Link>
            {' '}чтобы получить свою реферальную ссылку.
          </p>
        )}

        {status === 'authenticated' && loadFailed && (
          <p className={styles.promoError}>Не удалось загрузить реферальную ссылку. Попробуйте позже.</p>
        )}

        {status === 'authenticated' && data && (
          <>
            <div className={styles.promoRow}>
              <div className={styles.promoInputWrap}>
                <span className={styles.promoIconWrap}>
                  <Users size={14} />
                </span>
                <input
                  className={styles.promoInput}
                  type="text"
                  aria-label="Реферальная ссылка"
                  readOnly
                  value={data.link}
                  onFocus={e => e.currentTarget.select()}
                />
              </div>
              <button className={styles.activateBtn} onClick={handleCopy}>
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
            <p className={styles.promoHint}>
              Приглашено по ссылке: {data.invitesUsed}
              {data.isUnlimited ? ' · без лимита' : ` из ${data.maxFreeInvites}`}
            </p>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ── Buy modal (placeholder: opens straight to promo activation until real checkout exists) ──

function BuyModal({ open, onClose, ...promoProps }: { open: boolean; onClose: () => void } & PromoFormProps) {
  useEffect(() => {
    if (!open) return
    function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeydown)
    document.body.style.setProperty('overflow', 'hidden', 'important')
    return () => {
      document.removeEventListener('keydown', onKeydown)
      document.body.style.removeProperty('overflow')
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className={styles.buyModalBackdrop} onClick={onClose}>
      <motion.div
        className={styles.buyModalCard}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Купить VIP"
      >
        <button className={styles.buyModalClose} onClick={onClose} aria-label="Закрыть">
          <X size={16} />
        </button>
        <div className={styles.buyModalHeader}>
          <div className={styles.getCardNum}><Star size={14} fill="currentColor" /></div>
          <div>
            <p className={styles.getCardTitle}>Активировать промокод</p>
            <p className={styles.getCardSub}>Оплата картой скоро — пока VIP включается по промокоду</p>
          </div>
        </div>
        <PromoForm {...promoProps} />
      </motion.div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────

export default function VipClientPage() {

  useEffect(() => {
    document.body.style.setProperty('overflow', 'auto', 'important')
    document.documentElement.classList.add('vip-dark')
    return () => {
      document.body.style.removeProperty('overflow')
      document.documentElement.classList.remove('vip-dark')
    }
  }, [])

  const [buyModalOpen, setBuyModalOpen] = useState(false)
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
      <Starfield />

      {/* ── Hero ── */}
      <section className={styles.hero}>
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

        <motion.button
          className={styles.heroBuyBtn}
          onClick={() => setBuyModalOpen(true)}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Star size={15} fill="currentColor" />
          Купить VIP
        </motion.button>

        <motion.a
          href="#referral-card"
          className={styles.heroFreeBtn}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.38 }}
        >
          <Gift size={14} />
          Получить бесплатный VIP — позвать друзей
        </motion.a>
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
                <PromoForm
                  activated={activated}
                  vipUntil={vipUntil}
                  promoCode={promoCode}
                  setPromoCode={setPromoCode}
                  promoError={promoError}
                  setPromoError={setPromoError}
                  loading={loading}
                  onActivate={handleActivate}
                />
              </div>
            </motion.div>

            <ReferralCard />

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

      <BuyModal
        open={buyModalOpen}
        onClose={() => setBuyModalOpen(false)}
        activated={activated}
        vipUntil={vipUntil}
        promoCode={promoCode}
        setPromoCode={setPromoCode}
        promoError={promoError}
        setPromoError={setPromoError}
        loading={loading}
        onActivate={handleActivate}
      />
    </main>
  )
}
