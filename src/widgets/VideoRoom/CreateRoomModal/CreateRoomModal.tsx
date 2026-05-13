'use client'

import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {CategorySelect} from '@/shared/ui/inputs/CategorySelect/CategorySelect'
import {useSession} from 'next-auth/react'
import {useEffect, useRef, useState} from 'react'
import styles from './CreateRoomModal.module.scss'

type AccessType = 'ALL' | 'NOBODY' | 'MY_STUDENTS' | 'SELECTED'

interface Student {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface CreateRoomModalProps {
  isOpen: boolean
  onClose: (e: React.MouseEvent) => void
  onConfirm: (params: {topic?: string; categoryId?: string; accessType: AccessType; allowedEmails: string[]}) => void
  loading: boolean
}

export function CreateRoomModal({isOpen, onClose, onConfirm, loading}: CreateRoomModalProps) {
  const {data: session} = useSession()
  const isTeacher = session?.user?.role === 'TEACHER'

  const [topic, setTopic] = useState('')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [accessType, setAccessType] = useState<AccessType>('ALL')
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())
  const [emailInput, setEmailInput] = useState('')
  const [extraEmails, setExtraEmails] = useState<string[]>([])
  const emailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen || !isTeacher) return
    fetch('/api/call/my-students')
      .then((r) => r.json())
      .then((d) => setStudents(d.students ?? []))
      .catch(() => {})
  }, [isOpen, isTeacher])

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase()
    if (!email || extraEmails.includes(email)) return
    setExtraEmails((prev) => [...prev, email])
    setEmailInput('')
    emailInputRef.current?.focus()
  }

  const removeEmail = (email: string) => setExtraEmails((prev) => prev.filter((e) => e !== email))

  const handleSubmit = () => {
    const studentEmails = students.filter((s) => selectedStudentIds.has(s.id)).map((s) => s.email)
    const allEmails = Array.from(new Set([...studentEmails, ...extraEmails]))
    onConfirm({
      topic: topic.trim() || undefined,
      categoryId: categoryIds[0],
      accessType,
      allowedEmails: allEmails,
    })
  }

  const accessOptions: {value: AccessType; label: string; teacherOnly?: boolean}[] = [
    {value: 'ALL', label: 'Всем'},
    {value: 'NOBODY', label: 'Никому'},
    {value: 'MY_STUDENTS', label: 'Моим ученикам', teacherOnly: true},
    {value: 'SELECTED', label: 'Выбранным пользователям'},
  ]

  const showStudentList = isTeacher && accessType === 'SELECTED'
  const showEmailInput = accessType === 'SELECTED'

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={onClose}
      additionalTitle="Настройки комнаты"
      modalFooter={
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose as any}>
            Отмена
          </button>
          <button className={styles.createBtn} onClick={handleSubmit} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : 'Создать'}
          </button>
        </div>
      }
    >
      <div className={styles.body}>
        <div className={styles.field}>
          <span className={styles.label}>Тема занятия</span>
          <input
            className={styles.emailInput}
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Например: Квадратные уравнения"
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Предмет</span>
          <CategorySelect
            canSelectMany={false}
            value={categoryIds}
            onChange={setCategoryIds}
            placeholder="Выберите предмет"
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Доступ</span>
          <div className={styles.radioGroup}>
            {accessOptions
              .filter((o) => !o.teacherOnly || isTeacher)
              .map((o) => (
                <div
                  key={o.value}
                  className={`${styles.radioOption} ${accessType === o.value ? styles.selected : ''}`}
                  onClick={() => setAccessType(o.value)}
                >
                  <div className={styles.radioCircle}>
                    {accessType === o.value && <div className={styles.radioDot} />}
                  </div>
                  <span className={styles.radioText}>{o.label}</span>
                </div>
              ))}
          </div>
        </div>

        {showStudentList && students.length > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>Мои ученики</span>
            <div className={styles.studentsList}>
              {students.map((s) => (
                <div
                  key={s.id}
                  className={`${styles.studentRow} ${selectedStudentIds.has(s.id) ? styles.checked : ''}`}
                  onClick={() => toggleStudent(s.id)}
                >
                  <div className={styles.studentCheckbox}>
                    {selectedStudentIds.has(s.id) && (
                      <svg className={styles.checkIcon} width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className={styles.studentName}>{s.name}</span>
                  <span className={styles.studentEmail}>{s.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showEmailInput && (
          <div className={styles.field}>
            <span className={styles.label}>{isTeacher ? 'Добавить по почте' : 'Почта пользователей'}</span>
            <div className={styles.emailInputRow}>
              <input
                ref={emailInputRef}
                className={styles.emailInput}
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                placeholder="email@example.com"
              />
              <button className={styles.addEmailBtn} onClick={addEmail} disabled={!emailInput.trim()}>
                Добавить
              </button>
            </div>
            {extraEmails.length > 0 && (
              <div className={styles.emailTags}>
                {extraEmails.map((email) => (
                  <div key={email} className={styles.emailTag}>
                    {email}
                    <button className={styles.removeTagBtn} onClick={() => removeEmail(email)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ModalWindowDefault>
  )
}
