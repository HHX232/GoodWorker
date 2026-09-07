/**
 * Категории в БД — свободные (teacher-curated), гарантированного 1:1 с
 * ключами CurriculumProgram.subject нет. Мэппинг поддерживается вручную:
 * при подключении нового предмета — одна строка сюда + прогон
 * scripts/ingest-curriculum.ts.
 */
export const CATEGORY_ROOT_SLUG_TO_SUBJECT: Record<string, string> = {
  russian: 'rus_yaz',
  mathematics: 'matem',
  // physics: 'fizika',   — добавить, когда появится соответствующая root-категория
  // history: 'istoriya', — добавить, когда появится соответствующая root-категория
}
