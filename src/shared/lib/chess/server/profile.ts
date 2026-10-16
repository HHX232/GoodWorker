import { prisma } from '@/shared/prisma/prisma'
import { GUEST_PUZZLE_RATING } from './puzzleRating'

export type ChessProfileDto = { puzzleRating: number; solved: number; failed: number }

/** Профиль задач пользователя; до первой попытки — значения по умолчанию (строка не создаётся). */
export async function loadChessProfile(userId: string): Promise<ChessProfileDto> {
  const p = await prisma.chessProfile.findUnique({ where: { userId } })
  return p
    ? { puzzleRating: p.puzzleRating, solved: p.solved, failed: p.failed }
    : { puzzleRating: GUEST_PUZZLE_RATING, solved: 0, failed: 0 }
}
