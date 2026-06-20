/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {updateCalendarTask} from '@/entities/store/slices/calendar.slice'
import {
  selectEvents,
  selectSelectedEvent,
  selectSelectedTask,
  selectTasks,
  selectWeekDays
} from '@/features/Calendar/selectors/selector'
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {CalendarEvent, CalendarStudent} from '@/shared/types/Calendar/calendar.types'
import {CalendarHeader} from '@/widgets/Calendar/CalendarHeader/CalendarHeader'
import {CalendarSidebar} from '@/widgets/Calendar/CalendarSidebar/CalendarSidebar'
import {DayCalendar} from '@/widgets/Calendar/DayCalendar/DayCalendar'
import {CalendarEventModal} from '@/widgets/Calendar/Modals/CalendarEventModal/CalendarEventModal'
import {CalendarTaskCreateModal} from '@/widgets/Calendar/Modals/CalendarTaskCreateModal/CalendarTaskCreateModal'
import {CalendarTaskModal} from '@/widgets/Calendar/Modals/CalendarTaskModal/CalendarTaskModal'
import {MonthCalendar} from '@/widgets/Calendar/MonthCalendar/MonthCalendar'
import {WeekCalendar} from '@/widgets/Calendar/WeekCalendar/WeekCalendar'
import {useLocale, useTranslations} from 'next-intl'
import {useEffect, useRef, useState} from 'react'
import styles from '../CalendarPage/CalendarPage.module.scss'

export function StudentCalendarPage() {
  const tSidebar = useTranslations('calendar.sidebar')
  const {
    setEvents,
    setTasks,
    setView,
    selectEvent,
    selectTask,
    toggleCalendarTask,
    goToPrevWeek,
    goToNextWeek,
    goToToday,
    openCreateModal,
    closeCreateModal,
    addCalendarTask,
    setCreateTaskModalStatus,
    goToPrevDay,
    goToNextDay,
    goToPrevMonth,
    goToNextMonth,
    setCurrentDate,
  } = useActions()

  const weekDays = useTypedSelector(selectWeekDays)
  const events = useTypedSelector(selectEvents)
  const tasks = useTypedSelector(selectTasks)
  const selectedEvent = useTypedSelector(selectSelectedEvent)
  const selectedTask = useTypedSelector(selectSelectedTask)
  const isOpen = useTypedSelector((state) => state.calendar.createTaskIsOpen)
  const view = useTypedSelector((state) => state.calendar.view)
  const currentDateRaw = useTypedSelector((state) => state.calendar.currentDate)
  const currentDateObj = new Date(currentDateRaw)

  const locale = useLocale()
  void locale

  const [teachers, setTeachers] = useState<CalendarStudent[]>([])

  const loaded = useRef(false)
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    fetch('/api/student/calendar')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.events) && d.events.length > 0) setEvents(d.events)
        if (Array.isArray(d.tasks) && d.tasks.length > 0) setTasks(d.tasks)
        if (Array.isArray(d.teachers)) setTeachers(d.teachers)
      })
      .catch(() => {})
  }, [setEvents, setTasks])

  const handlePrev = () => {
    if (view === 'month') goToPrevMonth()
    else if (view === 'day') goToPrevDay()
    else goToPrevWeek()
  }

  const handleNext = () => {
    if (view === 'month') goToNextMonth()
    else if (view === 'day') goToNextDay()
    else goToNextWeek()
  }

  return (
    <div className={styles.layout}>
      <CalendarSidebar
        tasks={tasks}
        students={teachers}
        onTaskClick={(task) => selectTask(task.id)}
        onTaskToggle={(id) => toggleCalendarTask(id)}
        peopleLabel={tSidebar('teachers')}
      />

      <div className={styles.main}>
        <CalendarHeader
          view={view}
          onViewChange={setView}
          currentDate={weekDays[0] ?? new Date()}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={goToToday}
          onDateSelect={(d) => setCurrentDate(d.toISOString())}
          onAdd={() => setCreateTaskModalStatus(true)}
          exporting={false}
        />
        {view === 'week' && (
          <WeekCalendar
            weekDays={weekDays}
            events={events}
            onEventClick={(event) => selectEvent(event.id)}
            onCellClick={() => setCreateTaskModalStatus(true)}
            onEventUpdate={() => {}}
          />
        )}
        {view === 'day' && (
          <DayCalendar
            day={currentDateObj}
            onTaskSave={updateCalendarTask}
            events={events}
            onTaskToggle={toggleCalendarTask}
            tasks={tasks}
            onEventClick={(event) => selectEvent(event.id)}
            onCellClick={() => setCreateTaskModalStatus(true)}
            onEventUpdate={() => {}}
          />
        )}
        {view === 'month' && (
          <MonthCalendar
            currentDate={weekDays[0] ?? new Date()}
            events={events}
            tasks={tasks}
            onEventClick={(event: any) => selectEvent(event.id)}
            onDayClick={() => setCreateTaskModalStatus(true)}
            onTaskToggle={(id) => toggleCalendarTask(id)}
          />
        )}
      </div>

      <CalendarEventModal
        event={selectedEvent}
        onClose={() => selectEvent(null)}
        onEdit={() => {}}
        onDelete={() => {}}
      />

      <CalendarTaskCreateModal
        isOpen={isOpen}
        onClose={() => setCreateTaskModalStatus(false)}
        onSave={addCalendarTask}
      />

      <CalendarTaskModal
        task={selectedTask}
        onClose={() => selectTask(null)}
        onToggle={toggleCalendarTask}
        onSave={updateCalendarTask}
      />
    </div>
  )
}
