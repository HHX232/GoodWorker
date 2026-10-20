// Bots to play (G21/G22): 8 level bots, one per engine level, and 5 special characters unlocked by T11 badges.
// Strength is always the engine level: points and badges count by `level`, as for a plain level game.
import { OPENINGS } from './openings'

export type BotPiece = 'p' | 'b' | 'r' | 'q' | 'k'
export type BotExtra = 'cap' | 'headband' | 'glasses' | 'monocle' | 'beard' | 'bow' | 'none'
/** Drawn by `BotAvatar`: a chess piece with a face, in the coach's line style. */
export type BotLook = { piece: BotPiece; badge: string; accent: string; extra: BotExtra }

export type Bot = {
  id: string
  level: number
  /** approximate strength shown on the card */
  rating: number
  look: BotLook
  /** `chess.play` keys: name, a line about itself; specials also greet and comment the result */
  nameKey: string
  sayKey: string
  hiKey: string
  winKey: string
  loseKey: string
  /** OPENINGS id the bot plays from the start while the game follows it */
  opening?: string
  /** badge code (BADGE_CODES) that unlocks a special bot; level bots are open to everyone */
  unlock?: string
}

const bot = (id: string, level: number, rating: number, look: BotLook, extra: Partial<Pick<Bot, 'opening' | 'unlock'>> = {}): Bot => ({
  id,
  level,
  rating,
  look,
  nameKey: `bot_${id}`,
  sayKey: `bot_${id}_say`,
  hiKey: `bot_${id}_hi`,
  winKey: `bot_${id}_win`,
  loseKey: `bot_${id}_lose`,
  ...extra,
})

// ratings: levels 1–3 are Stockfish UCI_Elo (engine.ts), 4–8 are skill levels — estimated
export const BOTS: Bot[] = [
  bot('pip', 1, 1320, { piece: 'p', badge: '#f1e3c8', accent: '#6f9fd1', extra: 'cap' }),
  bot('tosha', 2, 1500, { piece: 'p', badge: '#dfe9d6', accent: '#e07a3f', extra: 'headband' }),
  bot('bella', 3, 1700, { piece: 'b', badge: '#f4dce0', accent: '#c4547a', extra: 'bow' }),
  bot('rudik', 4, 1900, { piece: 'r', badge: '#dbe4ee', accent: '#3f6fa8', extra: 'glasses' }),
  bot('olga', 5, 2100, { piece: 'q', badge: '#ece0f2', accent: '#7c4fa8', extra: 'none' }),
  bot('boris', 6, 2300, { piece: 'b', badge: '#e6e0d4', accent: '#8a6a3c', extra: 'beard' }),
  bot('magister', 7, 2500, { piece: 'k', badge: '#d9e6e1', accent: '#17855a', extra: 'glasses' }),
  bot('maximus', 8, 2800, { piece: 'k', badge: '#2a2b31', accent: '#b4321f', extra: 'monocle' }),

  bot('gosha', 3, 1700, { piece: 'p', badge: '#f7d9b8', accent: '#d9531e', extra: 'headband' }, { opening: 'kings-gambit', unlock: 'first_win_l3' }),
  bot('professor', 5, 2100, { piece: 'b', badge: '#e3e7ef', accent: '#2f4b7c', extra: 'glasses' }, { opening: 'ruy-lopez', unlock: 'points_500' }),
  bot('dina', 6, 2300, { piece: 'q', badge: '#f3d6cf', accent: '#a8322a', extra: 'bow' }, { opening: 'dragon', unlock: 'streak_7' }),
  bot('krepost', 6, 2300, { piece: 'r', badge: '#e4e1d9', accent: '#5c5f6a', extra: 'beard' }, { opening: 'caro-kann', unlock: 'points_2500' }),
  bot('noch', 8, 2800, { piece: 'k', badge: '#1d1e24', accent: '#8b42f4', extra: 'monocle' }, { opening: 'najdorf', unlock: 'first_win_l8' }),
]

export const getBot = (id: string | null | undefined) => BOTS.find((b) => b.id === id)
/** the plain bot of an engine level (old saves only know the level) */
export const levelBot = (level: number) => BOTS.find((b) => !b.unlock && b.level === level) ?? BOTS[0]

/**
 * The bot's book move or null (engine plays). Matched by position, not by colour: from the standard start,
 * while every move so far (both sides) equals the line, the bot plays the line's next move for whichever side it has.
 * So a white-side opening (King's Gambit) bot with Black answers 1.e4 with 1...e5 and keeps the line only if the
 * player follows it as White (2.f4); a black-side defence (Najdorf) bot with White plays 1.e4 and goes on while the
 * player answers by the book. Any deviation — the engine takes over for the rest of the game.
 */
export function bookMove(b: Bot, fromStart: boolean, historySan: readonly string[]): string | null {
  const line = b.opening ? OPENINGS.find((o) => o.id === b.opening)?.moves : undefined
  if (!line || !fromStart || historySan.length >= line.length) return null
  return historySan.every((san, i) => san === line[i]) ? line[historySan.length] : null
}

/** Special bots open with their badge; `badges` null = guest (all special bots closed). */
export const botUnlocked = (b: Bot, badges: readonly string[] | null) => !b.unlock || !!badges?.includes(b.unlock)
