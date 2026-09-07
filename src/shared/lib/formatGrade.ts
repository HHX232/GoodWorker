export function formatGradeLabel(schoolGrade: number | null | undefined, courseNumber: number | null | undefined): string | null {
  if (schoolGrade) return `${schoolGrade} класс`
  if (courseNumber) return `${courseNumber} курс`
  return null
}
