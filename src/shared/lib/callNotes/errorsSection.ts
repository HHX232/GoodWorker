// «Ошибки и поправки» — the last section of a participant's call notes, built from the
// call's StudentError rows without AI. Prisma-free: errorsSection.selfcheck.ts runs it.

export interface CallError { studentId: string; studentName: string; description: string | null; fragment: string | null; isCorrection: boolean }

/** Speech/AI text as plain markdown text: one line, house syntax ($, ==, {c|…}) and markup escaped. */
const plain = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim().replace(/[\\`*_$={}|[\]<>#~]/g, '\\$&')

const line = (e: CallError) => {
  const text = [plain(e.description), e.fragment?.trim() ? `«${plain(e.fragment)}»` : ''].filter(Boolean).join(' — ')
  return text ? `- ${text}${e.isCorrection ? ' _(поправка)_' : ''}` : ''
}

/** The section's markdown; '' when there is nothing to show. Grouped → a subheading per student. */
export function errorsMarkdown(errors: CallError[], groupByStudent: boolean): string {
  const list = (es: CallError[]) => es.map(line).filter(Boolean).join('\n')
  const groups = new Map<string, CallError[]>()
  // By id: namesakes are two students.
  for (const e of errors) groups.set(e.studentId, [...(groups.get(e.studentId) ?? []), e])
  const body = groupByStudent
    ? [...groups.values()].flatMap(es => (list(es) ? [`### ${plain(es[0].studentName) || 'Ученик'}\n\n${list(es)}`] : [])).join('\n\n')
    : list(errors)
  return body ? `## Ошибки и поправки\n\n${body}` : ''
}

/** The section for one person's copy: a student — only their own mistakes (even as the room owner); a tutor — everyone's, by student. */
export function errorsFor(errors: CallError[], person: { id: string; role: 'STUDENT' | 'TEACHER' }): string {
  return person.role === 'TEACHER' ? errorsMarkdown(errors, true) : errorsMarkdown(errors.filter(e => e.studentId === person.id), false)
}
