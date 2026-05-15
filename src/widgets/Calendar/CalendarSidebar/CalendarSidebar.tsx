'use client'

import {selectMonthTasks, selectPendingTasksCount, selectWeekTasks} from '@/features/Calendar/selectors/selector'
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {CalendarStudent, CalendarTask} from '@/shared/types/Calendar/calendar.types'
import {JSX, useState} from 'react'
import styles from './CalendarSidebar.module.scss'

interface CalendarSidebarProps {
  tasks: CalendarTask[]
  students: CalendarStudent[]
  onTaskClick: (task: CalendarTask) => void
  onTaskToggle: (taskId: string) => void
}

export function CalendarSidebar({tasks, students, onTaskClick, onTaskToggle}: CalendarSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [weekCollapsed, setWeekCollapsed] = useState(false)
  const [monthCollapsed, setMonthCollapsed] = useState(false)
  const [studentsCollapsed, setStudentsCollapsed] = useState(false)
  const pendingCount = useTypedSelector(selectPendingTasksCount)
  const weekTasks = useTypedSelector(selectWeekTasks)
  const monthTasks = useTypedSelector(selectMonthTasks)
  const {setCreateTaskModalStatus} = useActions()

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <button
        className={styles.collapseBtn}
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? 'Развернуть' : 'Свернуть'}
      >
        {!collapsed && <p>Свернуть</p>}
        <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
          <path d='M15 18l-6-6 6-6' stroke='#FFFFFF' strokeWidth='2' strokeLinecap='round' />
        </svg>
      </button>

      {/* ── Контент — скрывается при collapse ── */}
      <div className={styles.scrollContent}>
        <nav className={styles.section}>
          <span className={styles.sectionLabel}>Навигация</span>
          <NavItem icon='calendar' label='Календарь' active />
          <NavItem icon='check' label='Задачи' badge={pendingCount} />
          <NavItem icon='users' label='Ученики' badge={students.length} />
        </nav>

        <div className={styles.divider} />

        <div className={styles.section}>
          <button className={styles.sectionToggle} onClick={() => setWeekCollapsed((v) => !v)}>
            <span className={styles.sectionLabel}>Задачи на неделю</span>
            <svg
              width='10'
              height='10'
              viewBox='0 0 24 24'
              fill='none'
              className={`${styles.chevron} ${weekCollapsed ? styles.chevronUp : ''}`}
            >
              <path d='M6 9l6 6 6-6' stroke='#FFF' strokeWidth='2' strokeLinecap='round' />
            </svg>
          </button>
          <button className={styles.addTaskBtn} onClick={() => setCreateTaskModalStatus(true)}>
            <svg width='11' height='11' viewBox='0 0 24 24' fill='none'>
              <path d='M12 5v14M5 12h14' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
            </svg>
            Добавить задачу
          </button>
          {!weekCollapsed &&
            weekTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                onToggle={() => onTaskToggle(task.id)}
              />
            ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <button className={styles.sectionToggle} onClick={() => setMonthCollapsed((v) => !v)}>
            <span className={styles.sectionLabel}>Задачи на месяц</span>
            <svg
              width='10'
              height='10'
              viewBox='0 0 24 24'
              fill='none'
              className={`${styles.chevron} ${monthCollapsed ? styles.chevronUp : ''}`}
            >
              <path d='M6 9l6 6 6-6' stroke='#FFF' strokeWidth='2' strokeLinecap='round' />
            </svg>
          </button>
          <button className={styles.addTaskBtn} onClick={() => setCreateTaskModalStatus(true)}>
            <svg width='11' height='11' viewBox='0 0 24 24' fill='none'>
              <path d='M12 5v14M5 12h14' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
            </svg>
            Добавить задачу
          </button>
          {!monthCollapsed &&
            monthTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                onToggle={() => onTaskToggle(task.id)}
              />
            ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <button className={styles.sectionToggle} onClick={() => setStudentsCollapsed((v) => !v)}>
            <span className={styles.sectionLabel}>Ученики</span>
            <svg
              width='10'
              height='10'
              viewBox='0 0 24 24'
              fill='none'
              className={`${styles.chevron} ${studentsCollapsed ? styles.chevronUp : ''}`}
            >
              <path d='M6 9l6 6 6-6' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
            </svg>
          </button>
          {!studentsCollapsed &&
            students.map((student) => (
              <div key={student.id} className={styles.studentRow}>
                <div
                  className={styles.avatar}
                  style={{background: student.avatarColor, color: student.avatarTextColor}}
                >
                  {student.initials}
                </div>
                <div className={styles.studentInfo}>
                  <span className={styles.studentName}>{student.name}</span>
                  <span className={styles.studentTag}>{student.subject}</span>
                </div>
              </div>
            ))}
        </div>

        <div className={styles.plan}>
          <div className={styles.planTitle}>Pro план</div>
          <div className={styles.planDesc}>Безлимитные ученики, аналитика и экспорт расписания</div>
          <div className={styles.planPrice}>
            990 ₽ <span>/ месяц</span>
          </div>
          <div className={styles.planFeats}>
            <PlanFeat>Неограниченные ученики</PlanFeat>
            <PlanFeat>Экспорт в PDF / Google Cal</PlanFeat>
            <PlanFeat>Аналитика прогресса</PlanFeat>
          </div>
          <button className={styles.planBtn}>Перейти на Pro</button>
        </div>
      </div>
    </aside>
  )
}

function NavItem({icon, label, active, badge}: {icon: string; label: string; active?: boolean; badge?: number}) {
  const icons: Record<string, JSX.Element> = {
    calendar: (
      <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
        <rect x='3' y='4' width='18' height='18' rx='2' stroke='currentColor' strokeWidth='1.6' />
        <path d='M16 2v4M8 2v4M3 10h18' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' />
      </svg>
    ),
    check: (
      <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
        <path d='M9 11l3 3L22 4' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
        <path
          d='M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'
          stroke='currentColor'
          strokeWidth='1.6'
          strokeLinecap='round'
        />
      </svg>
    ),
    users: (
      <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
        <path
          d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2'
          stroke='currentColor'
          strokeWidth='1.6'
          strokeLinecap='round'
        />
        <circle cx='9' cy='7' r='4' stroke='currentColor' strokeWidth='1.6' />
        <path
          d='M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75'
          stroke='currentColor'
          strokeWidth='1.6'
          strokeLinecap='round'
        />
      </svg>
    )
  }

  return (
    <div className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}>
      <span className={styles.navIcon}>{icons[icon]}</span>
      <span className={styles.navLabel}>{label}</span>
      {badge !== undefined && <span className={styles.badge}>{badge}</span>}
    </div>
  )
}

function TaskItem({task, onClick, onToggle}: {task: CalendarTask; onClick: () => void; onToggle: () => void}) {
  return (
    <div className={styles.taskItem} onClick={onClick}>
      <button
        className={`${styles.taskCheck} ${task.completed ? styles.taskCheckDone : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        aria-label={task.completed ? 'Снять выполнение' : 'Отметить выполненным'}
      >
        {task.completed && (
          <svg width='9' height='9' viewBox='0 0 12 12' fill='none'>
            <path d='M2 6l3 3 5-5' stroke='#fff' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
          </svg>
        )}
      </button>
      <div className={styles.taskContent}>
        <span className={`${styles.taskTitle} ${task.completed ? styles.taskTitleDone : ''}`}>{task.title}</span>
        <span className={styles.taskMeta}>
          {task.completed ? 'Выполнено' : `${task.dueDate ?? ''} · ${task.category ?? ''}`}
        </span>
      </div>
    </div>
  )
}

function PlanFeat({children}: {children: React.ReactNode}) {
  return (
    <div className={styles.planFeat}>
      <svg width='12' height='12' viewBox='0 0 16 16' fill='none'>
        <path d='M3 8l3.5 3.5L13 4' stroke='#534AB7' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
      {children}
    </div>
  )
}
