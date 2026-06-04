/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {updateCalendarTask} from '@/entities/store/slices/calendar.slice'
import {
  selectCreateModal,
  selectEvents,
  selectSelectedEvent,
  selectSelectedTask,
  selectStudents,
  selectTasks,
  selectWeekDays
} from '@/features/Calendar/selectors/selector'
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {CalendarStudent} from '@/shared/types/Calendar/calendar.types'
import {CalendarEvent} from '@/shared/types/Calendar/calendar.types'
import {CalendarHeader} from '@/widgets/Calendar/CalendarHeader/CalendarHeader'
import {CalendarSidebar} from '@/widgets/Calendar/CalendarSidebar/CalendarSidebar'
import {DayCalendar} from '@/widgets/Calendar/DayCalendar/DayCalendar'
import {CalendarCreateModal} from '@/widgets/Calendar/Modals/CalendarCreateModal/CalendarCreateModal'
import {CalendarEventModal} from '@/widgets/Calendar/Modals/CalendarEventModal/CalendarEventModal'
import {CalendarTaskCreateModal} from '@/widgets/Calendar/Modals/CalendarTaskCreateModal/CalendarTaskCreateModal'
import {CalendarTaskModal} from '@/widgets/Calendar/Modals/CalendarTaskModal/CalendarTaskModal'
import {MonthCalendar} from '@/widgets/Calendar/MonthCalendar/MonthCalendar'
import {WeekCalendar} from '@/widgets/Calendar/WeekCalendar/WeekCalendar'
import {useLocale} from 'next-intl'
import {useEffect, useRef, useState} from 'react'
import styles from './CalendarPage.module.scss'

export function CalendarPage({ teacherId }: { teacherId: string }) {

  const {
    addEvent,
    setEvents,
    setTasks,
    setStudents,
    setView,
    updateEvent,
    deleteEvent,
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
    setCurrentDate
  } = useActions()
  const weekDays = useTypedSelector(selectWeekDays)
  const events = useTypedSelector(selectEvents)

  const [teacherServices, setTeacherServices] = useState<{id: string; title: string; price: number; duration: number}[]>([])

  const loaded = useRef(false)
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    fetch(`/api/teacher/calendar?teacherId=${teacherId}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.events) && d.events.length > 0) setEvents(d.events)
        if (Array.isArray(d.tasks) && d.tasks.length > 0) setTasks(d.tasks)
      })
      .catch(() => {})

    fetch(`/api/teacher/students?teacherId=${teacherId}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.students)) setStudents(d.students as CalendarStudent[])
      })
      .catch(() => {})

    fetch(`/api/services?teacherId=${teacherId}&lang=ru`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.services)) {
          setTeacherServices(d.services.map((s: {id: string; title: string; price: number; duration: number}) => ({
            id: s.id, title: s.title, price: s.price, duration: s.duration,
          })))
        }
      })
      .catch(() => {})
  }, [setEvents, setTasks, setStudents, teacherId])

  const tasks = useTypedSelector(selectTasks)

  // Save to DB whenever events or tasks change (debounced 1.5s)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const initialMount = useRef(true)
  useEffect(() => {
    if (initialMount.current) { initialMount.current = false; return }
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch(`/api/teacher/calendar?teacherId=${teacherId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({events, tasks}),
      }).catch(() => {})
    }, 1500)
    return () => clearTimeout(saveTimer.current)
  }, [events, tasks])
  const students = useTypedSelector(selectStudents)
  const selectedEvent = useTypedSelector(selectSelectedEvent)
  const selectedTask = useTypedSelector(selectSelectedTask)
  const createModal = useTypedSelector(selectCreateModal)
  const isOpen = useTypedSelector((state) => state.calendar.createTaskIsOpen)
  const view = useTypedSelector((state) => state.calendar.view)

  const locale = useLocale()
  const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US'
  const [exporting, setExporting] = useState(false)

  const currentDate = weekDays[0] ?? new Date()
  const currentDateRaw = useTypedSelector((state) => state.calendar.currentDate)
  const currentDateObj = new Date(currentDateRaw)

  const handleExportPDF = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const [regularBuf, boldBuf] = await Promise.all([
        fetch('/fonts/Roboto-Regular.ttf').then(r => r.arrayBuffer()),
        fetch('/fonts/Roboto-Bold.ttf').then(r => r.arrayBuffer()),
      ])
      const [{ pdf, Font }, { CalendarPDFDoc }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/widgets/Calendar/CalendarPDF'),
      ])
      Font.reset()
      Font.register({
        family: 'Roboto',
        fonts: [
          { src: URL.createObjectURL(new Blob([regularBuf], { type: 'font/ttf' })), fontWeight: 400 },
          { src: URL.createObjectURL(new Blob([boldBuf], { type: 'font/ttf' })), fontWeight: 700 },
        ],
      })
      const d = currentDateObj
      const monthLabel = d.toLocaleDateString(intlLocale, {day: 'numeric', month: 'long', year: 'numeric'})
      const blob = await pdf(
        <CalendarPDFDoc events={events} tasks={tasks} monthLabel={monthLabel} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `schedule_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }
  const handleEditEvent = (event: CalendarEvent) => {
    selectEvent(null)
    openCreateModal({editEventId: event.id})
  }

  const handleDeleteEvent = (id: string) => {
    deleteEvent(id)
    selectEvent(null)
  }

  const handleSaveEvent = (eventData: Omit<CalendarEvent, 'id'> & {id?: string}) => {
    if (eventData.id) {
      updateEvent(eventData as CalendarEvent)
    } else {
      addEvent(eventData)
      // fire-and-forget TG notification
      fetch('/api/teacher/calendar/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: eventData.title,
          date: eventData.date,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          studentName: eventData.studentName,
        }),
      }).catch(() => {})
    }
    closeCreateModal()
  }
  const closeEvent = () => selectEvent(null)
  const closeTask = () => selectTask(null)
  const closeCreate = () => closeCreateModal()
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
        students={students}
        onTaskClick={(task) => selectTask(task.id)}
        onTaskToggle={(id) => toggleCalendarTask(id)}
      />

      <div className={styles.main}>
        <CalendarHeader
          view={view}
          onViewChange={setView}
          currentDate={currentDate}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={goToToday}
          onDateSelect={(d) => {
            setCurrentDate(d.toISOString())
          }}
          onAdd={() => openCreateModal({})}
          onExportPDF={handleExportPDF}
          exporting={exporting}
        />
        {view === 'week' && (
          <WeekCalendar
            weekDays={weekDays}
            events={events}
            onEventClick={(event) => selectEvent(event.id)}
            onCellClick={(date, startTime, endTime) => openCreateModal({date, startTime, endTime})}
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
            onCellClick={(date, startTime, endTime) => openCreateModal({date, startTime, endTime})}
          />
        )}
        {view === 'month' && (
          <MonthCalendar
            currentDate={currentDate}
            events={events}
            tasks={tasks}
            onEventClick={(event: any) => selectEvent(event.id)}
            onDayClick={(date: any) => openCreateModal({date})}
            onTaskToggle={(id) => toggleCalendarTask(id)}
          />
        )}
      </div>

      <CalendarEventModal
        event={selectedEvent}
        onClose={closeEvent}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
      />

      <CalendarTaskCreateModal
        isOpen={isOpen}
        onClose={() => {
          setCreateTaskModalStatus(false)
        }}
        onSave={addCalendarTask}
      />

      <CalendarTaskModal
        task={selectedTask}
        onClose={closeTask}
        onToggle={toggleCalendarTask}
        onSave={updateCalendarTask}
      />
      <CalendarCreateModal
        isOpen={createModal.isOpen}
        initialDate={createModal.date}
        initialStartTime={createModal.startTime}
        initialEndTime={createModal.endTime}
        editingEvent={createModal.editingEvent}
        onClose={closeCreate}
        onSave={handleSaveEvent}
        teacherServices={teacherServices}
      />
    </div>
  )
}
