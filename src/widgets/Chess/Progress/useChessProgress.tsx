'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { ChessPlayerDto, ChessProgressDto } from '@/shared/lib/chess/server/progress'
import type { ActivityInput, GameResult } from '@/shared/lib/chess/server/progressModel'
import { SKINS } from '@/widgets/Chess/skins'
import { BadgeToast } from './BadgeToast'
import { badgeText } from './badges'

export type MyProgress =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'error' }
  | { status: 'ready'; player: ChessPlayerDto | null; profile: ChessProgressDto }

// One shared copy per tab: the flame in a header and the profile page show the same numbers,
// and a reported game updates both without refetching.
let state: MyProgress = { status: 'loading' }
let inflight: Promise<void> | null = null
let retried = false // сбой /me — одна повторная попытка через паузу, не запрос на каждое монтирование доски
const RETRY_MS = 5000
const listeners = new Set<() => void>()
const set = (s: MyProgress) => {
  state = s
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l))
const LOADING: MyProgress = { status: 'loading' }

function load() {
  inflight ??= fetch('/api/chess/profile/me')
    .then(async (r) => {
      if (r.status === 401) return set({ status: 'guest' })
      if (!r.ok) throw new Error(String(r.status))
      const b = (await r.json()) as { player: ChessPlayerDto | null; profile: ChessProgressDto }
      set({ status: 'ready', player: b.player, profile: b.profile })
    })
    .catch(() => {
      set({ status: 'error' })
      if (retried) return
      retried = true
      setTimeout(() => void load(), RETRY_MS)
    })
    .finally(() => (inflight = null))
  return inflight
}

/** Свежий прогресс с сервера (ответ шторма и т.п.): огонёк и профиль обновляются без перезагрузки. */
export function setMyChessProgress(profile: ChessProgressDto) {
  set({ status: 'ready', player: state.status === 'ready' ? state.player : null, profile })
}

/** Прогресс вошедшего (серия, рейтинги, очки, значки); гостю — `{status:'guest'}`. */
export function useMyChessProgress(): MyProgress {
  const s = useSyncExternalStore(subscribe, () => state, () => LOADING)
  useEffect(() => {
    // guest и error окончательны для вкладки (error сам повторяется один раз в load); ponytail: вход без перезагрузки страницы
    // покажет гостя до обновления — next-auth signIn перезагружает страницу
    if (state.status === 'loading') void load()
  }, [])
  return s
}

/** Текущая дата пользователя YYYY-MM-DD — для огонька («сегодня уже играл?»). */
export function todayLocal(now = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

type ReportInput = Omit<ActivityInput, 'tzOffsetMin' | 'kind'> & { kind: 'bot' | 'puzzle' } // storm — только POST /api/chess/storm

/** Отправить активность (гостю — ничего), обновить общий прогресс и показать тост «Новый значок!». */
export function useChessActivity() {
  const t = useTranslations('chess.progress')
  const tc = useTranslations('chess.core')
  const { status } = useSession()
  return useCallback(
    (input: ReportInput) => {
      if (status !== 'authenticated') return
      fetch('/api/chess/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, tzOffsetMin: new Date().getTimezoneOffset() }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((b: { profile: ChessProgressDto; newBadges: string[]; vipDays?: number } | null) => {
          if (!b) return
          setMyChessProgress(b.profile)
          if (!b.newBadges.length) return
          const first = badgeText(b.newBadges[0])
          // G24/G25: что открыли новые значки — наборы фигур, доски, дни VIP
          const rewards = SKINS.filter((s) => s.unlock && b.newBadges.includes(s.unlock)).map((s) =>
            t(s.only === 'board' ? 'toast_reward_board' : 'toast_reward_pieces', { name: tc(s.labelKey) })
          )
          if (b.vipDays) rewards.push(t('toast_reward_vip', { n: b.vipDays }))
          toast.custom(
            (id) => (
              <BadgeToast
                code={b.newBadges[0]}
                title={t('toast_title')}
                name={t(first.nameKey, first.values)}
                hint={t(first.hintKey, first.values)}
                more={b.newBadges.length > 1 ? t('toast_more', { n: b.newBadges.length - 1 }) : null}
                rewards={rewards}
                openLabel={t('toast_open')}
                closeLabel={t('toast_close')}
                onClose={() => toast.dismiss(id)}
              />
            ),
            { duration: 8000 }
          )
        })
        .catch(() => {}) // прогресс — бонус к партии: сбой сети не мешает играть
    },
    [status, t, tc]
  )
}

/**
 * Партия с ботом: отчитывается один раз, когда партия ЗАКАНЧИВАЕТСЯ на глазах игрока.
 * Восстановленная из localStorage уже законченная партия не отчитывается повторно;
 * новая партия (0 полуходов) снова разрешает отчёт. Уровень — МИНИМАЛЬНЫЙ за партию:
 * переключение на сильного бота перед матом не даёт его очков и значка.
 */
export function useBotGameActivity(game: { active: boolean; over: boolean; result: GameResult; level: number; plies: number }) {
  const report = useChessActivity()
  const seen = useRef<boolean | null>(null) // null — ещё не видели готовую партию
  const minLevel = useRef(game.level)
  const { active, over, result, level, plies } = game
  useEffect(() => {
    if (plies === 0) minLevel.current = level
    else minLevel.current = Math.min(minLevel.current, level)
  }, [plies, level])
  useEffect(() => {
    if (!active) return
    if (seen.current === null) {
      seen.current = over // уже законченная при загрузке — не считается
      minLevel.current = level // уровень восстановленной партии (до этого стоял уровень по умолчанию)
      return
    }
    if (plies === 0) seen.current = false
    if (!over || seen.current) return
    seen.current = true
    report({ kind: 'bot', botLevel: minLevel.current, result, plies })
  }, [active, over, result, level, plies, report])
}
