import {CalendarEvent, CalendarStudent, CalendarTask} from '@/shared/types/Calendar/calendar.types'

const today = new Date()
const fmt = (d: Date) => d.toISOString().split('T')[0]
const day = (offset: number) => {
  const d = new Date(today)
  d.setDate(today.getDate() + offset)
  return fmt(d)
}

const weekStart = (() => {
  const d = new Date(today)
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d
})()

const wd = (i: number) => {
  const d = new Date(weekStart)
  d.setDate(weekStart.getDate() + i)
  return fmt(d)
}

export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: '1',
    title: 'Алгебра',
    studentName: 'Аня Козлова',
    subject: 'Математика',
    date: wd(0),
    startTime: '09:00',
    endTime: '11:00',
    color: 'purple',
    description: 'Квадратные уравнения, дискриминант',
    status: 'scheduled'
  },
  {
    id: '2',
    title: 'Физика',
    studentName: 'Миша Смирнов',
    subject: 'Физика',
    date: wd(0),
    startTime: '13:00',
    endTime: '14:30',
    color: 'teal',
    description: 'Механика, законы Ньютона',
    status: 'scheduled'
  },
  {
    id: '3',
    title: 'Геометрия',
    studentName: 'Настя Волкова',
    subject: 'Математика',
    date: wd(1),
    startTime: '10:00',
    endTime: '11:30',
    color: 'pink',
    description: 'Теорема Пифагора',
    status: 'scheduled'
  },
  {
    id: '4',
    title: 'Группа ОГЭ',
    subject: 'Математика',
    date: wd(1),
    startTime: '15:00',
    endTime: '16:00',
    color: 'purple',
    description: 'Подготовка к ОГЭ, группа 3 человека',
    status: 'scheduled'
  },
  {
    id: '5',
    title: 'Созвон — родители',
    subject: 'Встреча',
    date: wd(2),
    startTime: '09:00',
    endTime: '10:00',
    color: 'teal',
    description: 'Отчёт об успеваемости Ани К.',
    status: 'completed'
  },
  {
    id: '6',
    title: 'Алгебра',
    studentName: 'Аня Козлова',
    subject: 'Математика',
    date: wd(2),
    startTime: '14:00',
    endTime: '16:00',
    color: 'amber',
    description: 'Разбор ошибок теста, новая тема',
    status: 'scheduled'
  },
  {
    id: '7',
    title: 'Физика',
    studentName: 'Миша Смирнов',
    subject: 'Физика',
    date: wd(3),
    startTime: '11:00',
    endTime: '12:30',
    color: 'teal',
    description: 'Электричество, задачи',
    status: 'scheduled'
  },
  {
    id: '8',
    title: 'Консультация',
    subject: 'Встреча',
    date: wd(3),
    startTime: '16:00',
    endTime: '17:00',
    color: 'purple',
    description: 'Онлайн-консультация нового ученика',
    status: 'scheduled'
  },
  {
    id: '9',
    title: 'Тригонометрия',
    studentName: 'Настя Волкова',
    subject: 'Математика',
    date: wd(4),
    startTime: '09:00',
    endTime: '11:00',
    color: 'pink',
    description: 'Синус и косинус',
    status: 'scheduled'
  },
  {
    id: '10',
    title: 'Физика',
    studentName: 'Миша Смирнов',
    subject: 'Физика',
    date: wd(4),
    startTime: '14:00',
    endTime: '15:30',
    color: 'teal',
    description: 'Итоговое занятие недели',
    status: 'scheduled'
  },
  {
    id: '11',
    title: 'Подготовка материалов',
    subject: 'Личное',
    date: wd(5),
    startTime: '13:00',
    endTime: '14:00',
    color: 'amber',
    description: 'Составление заданий на следующую неделю',
    status: 'scheduled'
  }
]

export const MOCK_TASKS: CalendarTask[] = [
  {
    id: 't1',
    title: 'Подготовить тест по алгебре',
    description: 'Создать 20 заданий по теме квадратных уравнений',
    dueDate: day(2),
    category: 'Математика',
    priority: 'medium',
    completed: false
  },
  {
    id: 't2',
    title: 'Проверить домашние задания',
    description: 'Проверить работы 8 учеников по теме производных',
    dueDate: fmt(today),
    category: 'Проверка',
    priority: 'high',
    completed: true
  },
  {
    id: 't3',
    title: 'Созвон с родителями',
    description: 'Обсудить успеваемость Миши К.',
    dueDate: day(3),
    category: 'Встреча',
    priority: 'low',
    completed: false
  },
  {
    id: 't4',
    title: 'Обновить программу курса',
    description: 'Пересмотреть учебный план на осенний семестр',
    dueDate: day(14),
    category: 'Планирование',
    priority: 'medium',
    completed: false
  },
  {
    id: 't5',
    title: 'Записать видеоурок',
    description: 'Урок по теме «Интегралы» для онлайн-платформы',
    dueDate: day(10),
    category: 'Контент',
    priority: 'medium',
    completed: false
  }
]

export const MOCK_STUDENTS: CalendarStudent[] = [
  {
    id: 's1',
    name: 'Аня Козлова',
    initials: 'АК',
    subject: 'Матем.',
    avatarColor: '#EEEDFE',
    avatarTextColor: '#534AB7'
  },
  {
    id: 's2',
    name: 'Миша Смирнов',
    initials: 'МС',
    subject: 'Физика',
    avatarColor: '#E1F5EE',
    avatarTextColor: '#0F6E56'
  },
  {
    id: 's3',
    name: 'Настя Волкова',
    initials: 'НВ',
    subject: 'Матем.',
    avatarColor: '#FBEAF0',
    avatarTextColor: '#993556'
  }
]

export const LUNCH_BREAKS = {startTime: '12:00', endTime: '13:00'}
