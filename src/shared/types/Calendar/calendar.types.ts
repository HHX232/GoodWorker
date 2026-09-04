export type CalendarEventColor = 'purple' | 'teal' | 'pink' | 'amber' | 'blue' | 'coral'

export interface CalendarChecklistItem {
  id: string
  text: string
  completed: boolean
}

export interface LessonPlanStep {
  title: string
  description: string
  status?: 'success' | 'error' | 'active' | 'upcoming'
  recommendation?: string
}

export interface LessonPlan {
  subject: string
  summary: string
  reviewSteps: LessonPlanStep[]
  activeSteps: LessonPlanStep[]
  upcomingSteps: LessonPlanStep[]
  generatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  date: string
  color: CalendarEventColor
  studentId?: string
  studentName?: string
  teacherName?: string
  subject?: string
  categoryId?: string
  description?: string
  status?: 'scheduled' | 'completed' | 'cancelled'
  fromTeacher?: boolean
  serviceId?: string
  serviceTitle?: string
  servicePrice?: number
  serviceDurationMinutes?: number
  durationMinutes?: number
  warning?: boolean
  noteType?: 'event' | 'note'
  lessonPlan?: LessonPlan
}

export interface CalendarTask {
  id: string
  title: string
  description?: string
  dueDate?: string
  category?: string
  priority?: 'low' | 'medium' | 'high'
  completed: boolean
  checklistItems?: CalendarChecklistItem[]
}

export interface CalendarStudent {
  id: string
  name: string
  initials: string
  subject: string
  avatarColor: string
  avatarTextColor: string
}

export type CalendarView = 'week' | 'day' | 'month'
