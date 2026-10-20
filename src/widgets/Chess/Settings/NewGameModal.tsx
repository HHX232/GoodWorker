'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bot as BotIcon, Check, Copy, Globe, Link2, Lock, LogIn, Shuffle, Users } from 'lucide-react'
import { BOTS, OPENINGS, botUnlocked, getBot, type Bot } from '@/shared/lib/chess/data'
import { badgeText, useMyChessProgress } from '@/widgets/Chess/Progress'
import { ChessDialog } from './ChessDialog'
import { BotAvatar } from './BotAvatar'
import styles from './Settings.module.scss'

export type NewGameTab = 'bot' | 'online' | 'friend' | 'duo'
/** `level` is the bot's engine level (points and badges count by it) */
export type BotChoice = { botId: string; level: number; color: 'w' | 'b'; coach: boolean }
type ColorPick = 'w' | 'random' | 'b'

/** Time controls of online games (T12 contract: `/chess/online?tc=`, `POST /api/chess/games {timeControl}`). */
export const TIME_CONTROLS = [
  { tc: '1+0', kind: 'bullet' },
  { tc: '3+2', kind: 'blitz' },
  { tc: '10+0', kind: 'rapid' },
] as const

const TABS: { id: NewGameTab; icon: typeof BotIcon }[] = [
  { id: 'bot', icon: BotIcon },
  { id: 'online', icon: Globe },
  { id: 'friend', icon: Link2 },
  { id: 'duo', icon: Users },
]

const pickColor = (c: ColorPick): 'w' | 'b' => (c === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : c)

export type NewGameModalProps = {
  open: boolean
  onClose: () => void
  /** tab shown on open */
  tab?: NewGameTab
  /** a bot game with these settings; the modal closes itself */
  onBot: (c: BotChoice) => void
  /** two players on one board */
  onDuo: () => void
  /** current bot settings, preselected */
  bot?: Partial<BotChoice>
  /** the engine did not load: the bot tab is locked */
  botDisabled?: boolean
}

/** "New game" as on chess.com: bot · online · friend by link · two on one board. */
export function NewGameModal(props: NewGameModalProps) {
  const t = useTranslations('chess.play')
  return (
    <ChessDialog open={props.open} onClose={props.onClose} title={t('ng_title')} wide>
      {/* keyed by tab: reopening starts from the requested tab with fresh fields */}
      <NewGameBody key={props.tab ?? 'bot'} {...props} />
    </ChessDialog>
  )
}

function NewGameBody({ onClose, tab: initialTab = 'bot', onBot, onDuo, bot, botDisabled }: NewGameModalProps) {
  const t = useTranslations('chess.play')
  const tc = useTranslations('chess.core')
  const router = useRouter()
  const [tab, setTab] = useState<NewGameTab>(botDisabled && initialTab === 'bot' ? 'online' : initialTab)
  const [botId, setBotId] = useState(getBot(bot?.botId)?.id ?? BOTS.find((b) => !b.unlock && b.level === (bot?.level ?? 3))!.id)
  const [color, setColor] = useState<ColorPick>(bot?.color ?? 'w')
  const [coach, setCoach] = useState(bot?.coach ?? true)
  const [friendTc, setFriendTc] = useState<string>('10+0')
  const [friendColor, setFriendColor] = useState<ColorPick>('random')
  const [link, setLink] = useState<{ state: 'idle' | 'busy' | 'login' | 'error' } | { state: 'ready'; id: string }>({ state: 'idle' })
  const [copied, setCopied] = useState(false)

  const go = (href: string) => {
    onClose()
    router.push(href)
  }

  const createLink = async () => {
    setLink({ state: 'busy' })
    try {
      const r = await fetch('/api/chess/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeControl: friendTc, ...(friendColor === 'random' ? {} : { color: friendColor }) }),
      })
      if (r.status === 401) return setLink({ state: 'login' })
      const b = r.ok ? ((await r.json()) as { id?: string }) : null
      setLink(b?.id ? { state: 'ready', id: b.id } : { state: 'error' })
    } catch {
      setLink({ state: 'error' })
    }
  }

  const url = link.state === 'ready' ? `${location.origin}/chess/game/${link.id}` : ''
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {} // the link stays selectable in the field
  }

  const colorSeg = (value: ColorPick, set: (c: ColorPick) => void, label: string) => (
    <Field label={label}>
      <div className={styles.seg} role="group" aria-label={label}>
        {(['w', 'random', 'b'] as const).map((c) => (
          <button key={c} type="button" aria-pressed={value === c} onClick={() => set(c)}>
            {c === 'random' ? <Shuffle size={14} strokeWidth={2} aria-hidden="true" /> : <span className={styles.swatch} data-side={c} aria-hidden="true" />}
            {t(c === 'w' ? 'white' : c === 'b' ? 'black' : 'ng_random')}
          </button>
        ))}
      </div>
    </Field>
  )

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label={t('ng_title')}>
        {TABS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`ng-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`ng-panel-${id}`}
            className={styles.tab}
            disabled={id === 'bot' && botDisabled}
            onClick={() => setTab(id)}
          >
            <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
            <span>{t(`ng_tab_${id}`)}</span>
          </button>
        ))}
      </div>

      <div className={styles.panel} role="tabpanel" id={`ng-panel-${tab}`} aria-labelledby={`ng-tab-${tab}`}>
        {tab === 'bot' && (
          <BotPicker
            botId={botId}
            onPick={setBotId}
            footer={(picked, open) => (
              <>
                {colorSeg(color, setColor, t('ng_color'))}
                <Field label={tc('coach_title')} hint={t(coach ? 'ng_coach_on_hint' : 'ng_coach_off_hint')}>
                  <div className={styles.seg} role="group" aria-label={tc('coach_title')}>
                    <button type="button" aria-pressed={coach} onClick={() => setCoach(true)}>{t('ng_coach_on')}</button>
                    <button type="button" aria-pressed={!coach} onClick={() => setCoach(false)}>{t('ng_coach_off')}</button>
                  </div>
                </Field>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={!open}
                  onClick={() => {
                    onBot({ botId: picked.id, level: picked.level, color: pickColor(color), coach })
                    onClose()
                  }}
                >
                  {t('ng_play')}
                </button>
              </>
            )}
          />
        )}

        {tab === 'online' && (
          <>
            <p className={styles.lead}>{t('ng_online_lead')}</p>
            <div className={styles.tcGrid}>
              {TIME_CONTROLS.map(({ tc: c, kind }) => (
                <button key={c} type="button" className={styles.tcCard} onClick={() => go(`/chess/online?tc=${encodeURIComponent(c)}`)}>
                  <span className={styles.tcValue}>{c}</span>
                  <span className={styles.tcKind}>{t(`tc_${kind}`)}</span>
                </button>
              ))}
            </div>
            <Link href="/chess/online" className={styles.textLink} onClick={onClose}>
              {t('ng_online_lobby')}
            </Link>
          </>
        )}

        {tab === 'friend' && (
          <>
            <p className={styles.lead}>{t('ng_friend_lead')}</p>
            {link.state === 'ready' ? (
              <div className={styles.linkBox} role="status">
                <span className={styles.linkTitle}>
                  <Check size={16} strokeWidth={2.25} aria-hidden="true" />
                  {t('ng_link_ready')}
                </span>
                <div className={styles.linkRow}>
                  <input className={styles.linkInput} value={url} readOnly aria-label={t('ng_link_ready')} onFocus={(e) => e.currentTarget.select()} />
                  <button type="button" className={styles.secondary} onClick={copy}>
                    {copied ? <Check size={16} strokeWidth={2.25} aria-hidden="true" /> : <Copy size={16} strokeWidth={2} aria-hidden="true" />}
                    {t(copied ? 'ng_copied' : 'ng_copy')}
                  </button>
                </div>
                <button type="button" className={styles.primary} onClick={() => go(`/chess/game/${link.id}`)}>
                  {t('ng_open_game')}
                </button>
              </div>
            ) : (
              <>
                <Field label={t('ng_time')}>
                  <div className={styles.seg} role="group" aria-label={t('ng_time')}>
                    {TIME_CONTROLS.map(({ tc: c, kind }) => (
                      <button key={c} type="button" aria-pressed={friendTc === c} onClick={() => setFriendTc(c)}>
                        <span className={styles.segValue}>{c}</span>
                        <span className={styles.segSub}>{t(`tc_${kind}`)}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                {colorSeg(friendColor, setFriendColor, t('ng_color'))}
                {link.state === 'login' && (
                  <p className={styles.notice}>
                    <LogIn size={16} strokeWidth={2} aria-hidden="true" />
                    <span>{t('ng_login')}</span>
                    <Link href="/login" className={styles.textLink}>{t('ng_login_cta')}</Link>
                  </p>
                )}
                {link.state === 'error' && <p className={styles.notice} role="alert">{t('ng_error')}</p>}
                <button type="button" className={styles.primary} onClick={createLink} disabled={link.state === 'busy'}>
                  {t(link.state === 'busy' ? 'ng_creating' : 'ng_create_link')}
                </button>
              </>
            )}
          </>
        )}

        {tab === 'duo' && (
          <>
            <p className={styles.lead}>{t('ng_duo_lead')}</p>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                onDuo()
                onClose()
              }}
            >
              {t('ng_duo_start')}
            </button>
          </>
        )}
      </div>
    </>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label}
        {hint && <span className={styles.labelHint}>{hint}</span>}
      </span>
      {children}
    </div>
  )
}

// ─── G21/G22: bots as on chess.com — a grid of faces, the chosen one large ───

function BotPicker({ botId, onPick, footer }: { botId: string; onPick: (id: string) => void; footer: (b: Bot, open: boolean) => ReactNode }) {
  const t = useTranslations('chess.play')
  const tp = useTranslations('chess.progress')
  const tl = useTranslations('chess.learn')
  const me = useMyChessProgress()
  const badges = me.status === 'ready' ? me.profile.badges.map((b) => b.code) : null
  const picked = getBot(botId) ?? BOTS[0]
  const open = botUnlocked(picked, badges)
  const opening = picked.opening ? OPENINGS.find((o) => o.id === picked.opening) : undefined
  const unlockName = (b: Bot) => {
    const x = badgeText(b.unlock!)
    return tp(x.nameKey, x.values)
  }

  const grid = (list: Bot[], label: string, cols: number) => (
    <div className={styles.botGroup}>
      <span className={styles.label}>{label}</span>
      <div className={styles.botGrid} data-cols={cols} role="radiogroup" aria-label={label}>
        {list.map((b) => {
          const locked = !botUnlocked(b, badges)
          return (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={b.id === picked.id}
              className={styles.botCard}
              data-locked={locked || undefined}
              onClick={() => onPick(b.id)}
              title={locked ? t('ng_unlock', { badge: unlockName(b) }) : undefined}
            >
              <span className={styles.botFace}>
                <BotAvatar look={b.look} size={48} />
                {locked && (
                  <span className={styles.botLock}>
                    <Lock size={11} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className={styles.botName}>{t(b.nameKey)}</span>
              <span className={styles.botRating}>{b.rating}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className={styles.botPick}>
      <div className={styles.botLists}>
        {grid(BOTS.filter((b) => !b.unlock), t('ng_levels'), 4)}
        {grid(BOTS.filter((b) => b.unlock), t('ng_specials'), 5)}
        {me.status === 'guest' && (
          <p className={styles.notice}>
            <LogIn size={16} strokeWidth={2} aria-hidden="true" />
            <span>{t('ng_specials_guest')}</span>
            <Link href="/login" className={styles.textLink}>{t('ng_login_cta')}</Link>
          </p>
        )}
      </div>

      <div className={styles.botDetail} aria-live="polite">
        <div className={styles.botHero}>
          <BotAvatar look={picked.look} size={88} />
          <div>
            <p className={styles.botHeroName}>{t(picked.nameKey)}</p>
            <p className={styles.botHeroMeta}>
              {picked.rating} · {t('ng_bot_level', { n: picked.level })} · {t(`level_hint_${picked.level}`)}
            </p>
          </div>
        </div>
        <p className={styles.botQuote}>{t(picked.sayKey)}</p>
        {opening && <p className={styles.botMeta}>{t('ng_opening', { name: `${opening.eco} · ${tl(opening.nameKey)}` })}</p>}
        {!open && (
          <p className={styles.notice}>
            <Lock size={16} strokeWidth={2} aria-hidden="true" />
            <span>{t('ng_unlock', { badge: unlockName(picked) })}</span>
          </p>
        )}
        {footer(picked, open)}
      </div>
    </div>
  )
}
