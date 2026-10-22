import assert from 'node:assert/strict'
import { markdownToBlocks, nodeText } from '@/shared/lib/lecture/markdownToDoc'
import { errorsFor, errorsMarkdown } from './errorsSection'

// npx tsx src/shared/lib/callNotes/errorsSection.selfcheck.ts

// Nobody made mistakes → no section at all (spec §Д3 Д14).
assert.equal(errorsMarkdown([], false), '')
assert.equal(errorsMarkdown([], true), '')

// A student's own copy: heading + one line per error, correction marked (§Д3 Д11).
assert.equal(
  errorsMarkdown([
    { studentId: 'a', studentName: 'Аня', description: 'Перепутала знак при переносе', fragment: 'x = 5 - 3', isCorrection: false },
    { studentId: 'a', studentName: 'Аня', description: 'Исправила сама', fragment: null, isCorrection: true },
  ], false),
  '## Ошибки и поправки\n\n- Перепутала знак при переносе — «x \\= 5 - 3»\n- Исправила сама _(поправка)_',
)

// The tutor's copy: every student under their name, in first-seen order (§Д3 Д12).
assert.equal(
  errorsMarkdown([
    { studentId: 'b', studentName: 'Боря', description: 'Не тот падеж', fragment: 'в школу', isCorrection: false },
    { studentId: 'a', studentName: 'Аня', description: 'Пропустила минус', fragment: null, isCorrection: false },
    { studentId: 'b', studentName: 'Боря', description: 'Сам поправил время', fragment: 'went', isCorrection: true },
  ], true),
  '## Ошибки и поправки\n\n### Боря\n\n- Не тот падеж — «в школу»\n- Сам поправил время — «went» _(поправка)_\n\n### Аня\n\n- Пропустила минус',
)

// Rows with neither description nor fragment show nothing — and an all-empty list is no section.
assert.equal(errorsMarkdown([{ studentId: 'a', studentName: 'Аня', description: ' ', fragment: null, isCorrection: false }], true), '')

// Speech that looks like the notes' markup stays plain text: $…$ isn't a formula, == isn't a highlight.
assert.equal(
  errorsMarkdown([{ studentId: 'a', studentName: 'Аня', description: 'Написала $x$ ==', fragment: null, isCorrection: false }], false),
  '## Ошибки и поправки\n\n- Написала \\$x\\$ \\=\\=',
)
{
  const item = markdownToBlocks(errorsMarkdown([{ studentId: 'a', studentName: 'Аня', description: 'Написала $x$ ==да==', fragment: null, isCorrection: false }], false))[1]
  assert.equal(nodeText(item).trim(), 'Написала $x$ ==да==')
  assert.equal(JSON.stringify(item).includes('mathInline') || JSON.stringify(item).includes('highlight'), false)
}

// Namesakes are two students, not one: a subheading each (grouped by id, not name).
assert.equal(
  errorsMarkdown([
    { studentId: 's1', studentName: 'Саша', description: 'Ошибка первого', fragment: null, isCorrection: false },
    { studentId: 's2', studentName: 'Саша', description: 'Ошибка второго', fragment: null, isCorrection: false },
  ], true),
  '## Ошибки и поправки\n\n### Саша\n\n- Ошибка первого\n\n### Саша\n\n- Ошибка второго',
)

// Whose copy gets what (§Д3 Д11–Д12): a student — only their own, ungrouped (also when the
// student owns the room); a tutor — everyone's, by student.
{
  const errors = [
    { studentId: 'a', studentName: 'Аня', description: 'Ошибка Ани', fragment: null, isCorrection: false },
    { studentId: 'b', studentName: 'Боря', description: 'Ошибка Бори', fragment: null, isCorrection: false },
  ]
  assert.equal(errorsFor(errors, { id: 'a', role: 'STUDENT' }), '## Ошибки и поправки\n\n- Ошибка Ани')
  assert.equal(errorsFor(errors, { id: 'c', role: 'STUDENT' }), '')
  assert.equal(errorsFor(errors, { id: 't', role: 'TEACHER' }), '## Ошибки и поправки\n\n### Аня\n\n- Ошибка Ани\n\n### Боря\n\n- Ошибка Бори')
  // A tutor whose id happens to equal a student's still sees everyone.
  assert.equal(errorsFor(errors, { id: 'a', role: 'TEACHER' }), '## Ошибки и поправки\n\n### Аня\n\n- Ошибка Ани\n\n### Боря\n\n- Ошибка Бори')
}

console.log('errorsSection ok')
