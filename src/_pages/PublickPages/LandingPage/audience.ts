export type Audience = 'teacher' | 'student' | 'newUser'
export type SectionId = 'promo' | 'video' | 'calendar' | 'teachers' | 'lecture' | 'files' | 'course' | 'features' | 'pdf' | 'posts'

const PARAMS: Record<string, Audience> = {
  isForTeacher: 'teacher',
  isForStudent: 'student',
  isForNewUser: 'newUser',
}

// ?isForTeacher / ?isForTeacher=1 / =true — включено, =false / =0 — выключено.
// Если указано несколько — побеждает первый в PARAMS.
export function parseAudience(sp: Record<string, string | string[] | undefined>): Audience | null {
  for (const [key, audience] of Object.entries(PARAMS)) {
    const raw = sp[key]
    if (raw === undefined) continue
    const v = Array.isArray(raw) ? raw[0] : raw
    if (v !== 'false' && v !== '0') return audience
  }
  return null
}

// Порядок блоков под Hero. Без параметра = newUser (как было).
export const SECTION_ORDER: Record<Audience, SectionId[]> = {
  // без параметра — исходный порядок главной (как в origin/main) + блок с видео под hero
  newUser: ['promo', 'video', 'calendar', 'teachers', 'lecture', 'files', 'course', 'features', 'pdf', 'posts'],
  // конспект урока → расписание → материалы → PDF-тест → конспект лекции → учителя → остальное
  teacher: ['promo', 'video', 'calendar', 'files', 'pdf', 'lecture', 'teachers', 'course', 'features', 'posts'],
  // репетиторы → конспект урока → конспект лекции → календарь → остальное
  student: ['promo', 'teachers', 'video', 'lecture', 'calendar', 'files', 'course', 'features', 'pdf', 'posts'],
}
