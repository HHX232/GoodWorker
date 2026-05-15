import {MOCK_EVENTS, MOCK_STUDENTS, MOCK_TASKS} from '@/shared/helpers/calendar/calendar.mock'
import {CalendarEvent, CalendarStudent, CalendarTask} from '@/shared/types/Calendar/calendar.types'
import {createSlice, PayloadAction} from '@reduxjs/toolkit'
import {nanoid} from 'nanoid'
export type CalendarView = 'month' | 'week' | 'day'

interface CreateModalState {
  isOpen: boolean
  date: string | null
  startTime: string | null
  endTime: string | null
  editingEvent: CalendarEvent | null
}

export interface CalendarState {
  events: CalendarEvent[]
  tasks: CalendarTask[]
  students: CalendarStudent[]
  selectedEventId: string | null
  selectedTaskId: string | null
  currentDate: string
  createModal: CreateModalState
  createTaskIsOpen: boolean
  view: CalendarView
}

const initialState: CalendarState = {
  events: MOCK_EVENTS,
  createTaskIsOpen: false,
  tasks: MOCK_TASKS,
  students: MOCK_STUDENTS,
  selectedEventId: null,
  selectedTaskId: null,
  currentDate: new Date().toISOString(),
  createModal: {
    isOpen: false,
    date: null,
    startTime: null,
    endTime: null,
    editingEvent: null
  },
  view: 'week'
}

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    // ── Events ──────────────────────────────────

    setEvents(state, action: PayloadAction<CalendarEvent[]>) {
      state.events = action.payload
    },
    addEvent(state, action: PayloadAction<Omit<CalendarEvent, 'id'>>) {
      state.events.push({...action.payload, id: nanoid()})
    },
    setCreateTaskModalStatus(state, action: PayloadAction<boolean>) {
      state.createTaskIsOpen = action.payload
    },
    setView(state, action: PayloadAction<CalendarView>) {
      state.view = action.payload
    },
    goToPrevDay(state) {
      const d = new Date(state.currentDate)
      d.setDate(d.getDate() - 1)
      state.currentDate = d.toISOString()
    },

    goToNextDay(state) {
      const d = new Date(state.currentDate)
      d.setDate(d.getDate() + 1)
      state.currentDate = d.toISOString()
    },

    goToPrevMonth(state) {
      const d = new Date(state.currentDate)
      d.setMonth(d.getMonth() - 1)
      state.currentDate = d.toISOString()
    },

    goToNextMonth(state) {
      const d = new Date(state.currentDate)
      d.setMonth(d.getMonth() + 1)
      state.currentDate = d.toISOString()
    },
    updateEvent(state, action: PayloadAction<CalendarEvent>) {
      const idx = state.events.findIndex((e) => e.id === action.payload.id)
      if (idx !== -1) state.events[idx] = action.payload
    },

    deleteEvent(state, action: PayloadAction<string>) {
      state.events = state.events.filter((e) => e.id !== action.payload)
    },

    selectEvent(state, action: PayloadAction<string | null>) {
      state.selectedEventId = action.payload
    },

    // ── Tasks ────────────────────────────────────

    addCalendarTask(state, action: PayloadAction<Omit<CalendarTask, 'id'>>) {
      state.tasks.push({...action.payload, id: nanoid()})
    },

    updateCalendarTask(state, action: PayloadAction<CalendarTask>) {
      const idx = state.tasks.findIndex((t) => t.id === action.payload.id)
      if (idx !== -1) state.tasks[idx] = action.payload
    },

    toggleCalendarTask(state, action: PayloadAction<string>) {
      const task = state.tasks.find((t) => t.id === action.payload)
      if (task) task.completed = !task.completed
    },

    deleteCalendarTask(state, action: PayloadAction<string>) {
      state.tasks = state.tasks.filter((t) => t.id !== action.payload)
    },

    selectTask(state, action: PayloadAction<string | null>) {
      state.selectedTaskId = action.payload
    },

    // ── Students ─────────────────────────────────

    addStudent(state, action: PayloadAction<Omit<CalendarStudent, 'id'>>) {
      state.students.push({...action.payload, id: nanoid()})
    },

    updateStudent(state, action: PayloadAction<CalendarStudent>) {
      const idx = state.students.findIndex((s) => s.id === action.payload.id)
      if (idx !== -1) state.students[idx] = action.payload
    },

    deleteStudent(state, action: PayloadAction<string>) {
      state.students = state.students.filter((s) => s.id !== action.payload)
    },

    // ── Navigation ───────────────────────────────

    setCurrentDate(state, action: PayloadAction<string>) {
      state.currentDate = action.payload
    },

    goToPrevWeek(state) {
      const d = new Date(state.currentDate)
      d.setDate(d.getDate() - 7)
      state.currentDate = d.toISOString()
    },

    goToNextWeek(state) {
      const d = new Date(state.currentDate)
      d.setDate(d.getDate() + 7)
      state.currentDate = d.toISOString()
    },

    goToToday(state) {
      state.currentDate = new Date().toISOString()
    },

    // ── Create modal ─────────────────────────────

    openCreateModal(
      state,
      action: PayloadAction<{
        date?: string | null
        startTime?: string | null
        endTime?: string | null
        editEventId?: string
      }>
    ) {
      const {date, startTime, endTime, editEventId} = action.payload
      state.createModal.isOpen = true
      state.createModal.date = date ?? null
      state.createModal.startTime = startTime ?? null
      state.createModal.endTime = endTime ?? null
      state.createModal.editingEvent = editEventId ? state.events.find((e) => e.id === editEventId) ?? null : null
    },

    closeCreateModal(state) {
      state.createModal = initialState.createModal
    }
  }
})

export const {
  setEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  selectEvent,
  addCalendarTask,
  updateCalendarTask,
  toggleCalendarTask,
  deleteCalendarTask,
  selectTask,
  addStudent,
  updateStudent,
  deleteStudent,
  setCurrentDate,
  goToPrevWeek,
  goToNextWeek,
  goToToday,
  openCreateModal,
  closeCreateModal
} = calendarSlice.actions

export default calendarSlice
