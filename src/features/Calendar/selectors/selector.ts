import {TypeRootState} from '@/entities/store/store'
import {getEventsForDay, getWeekDays} from '@/shared/helpers/calendar/calendar.helpers'
import {createSelector} from '@reduxjs/toolkit'

const selectCalendar = (state: TypeRootState) => state.calendar

export const selectEvents = (state: TypeRootState) => state.calendar.events
export const selectTasks = (state: TypeRootState) => state.calendar.tasks
export const selectStudents = (state: TypeRootState) => state.calendar.students
export const selectCurrentDate = (state: TypeRootState) => new Date(state.calendar.currentDate)
export const selectCreateModal = (state: TypeRootState) => state.calendar.createModal

export const selectSelectedEvent = createSelector(
  selectCalendar,
  (cal) => cal.events.find((e) => e.id === cal.selectedEventId) ?? null
)

export const selectSelectedTask = createSelector(
  selectCalendar,
  (cal) => cal.tasks.find((t) => t.id === cal.selectedTaskId) ?? null
)

export const selectWeekTasks = createSelector(selectTasks, (t) => t.slice(0, 3))
export const selectMonthTasks = createSelector(selectTasks, (t) => t.slice(3))

export const selectWeekDays = createSelector(selectCurrentDate, (date) => getWeekDays(date))

export const makeSelectEventsForDay = (dateKey: string) =>
  createSelector(selectEvents, (events) => getEventsForDay(events, dateKey))

export const selectPendingTasksCount = createSelector(selectTasks, (tasks) => tasks.filter((t) => !t.completed).length)
