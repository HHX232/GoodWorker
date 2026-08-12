import Image from 'next/image'
import styles from '../VideoCallPage.module.scss'

interface Student {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
}

interface InviteModalProps {
  inviteEmail: string
  inviteStudents: Student[]
  inviteSending: boolean
  inviteFeedback: { ok: boolean; msg: string } | null
  onEmailChange: (email: string) => void
  onClose: () => void
  onSend: () => void
  onSelectStudent: (email: string) => void
}

export function InviteModal({
  inviteEmail,
  inviteStudents,
  inviteSending,
  inviteFeedback,
  onEmailChange,
  onClose,
  onSend,
  onSelectStudent,
}: InviteModalProps) {
  return (
    <div
      className={styles.inviteOverlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.inviteCard}>
        <div className={styles.inviteHeader}>
          <span className={styles.inviteTitle}>Пригласить в комнату</span>
          <button className={styles.inviteCloseBtn} onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <input
          className={styles.inviteEmailInput}
          type="email"
          placeholder="Email пользователя"
          value={inviteEmail}
          onChange={e => onEmailChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSend() }}
        />

        {inviteStudents.length > 0 && (
          <div>
            <p className={styles.inviteStudentsSectionTitle}>Мои ученики</p>
            <div className={styles.inviteStudentsList}>
              {inviteStudents.map(s => (
                <div key={s.id} className={styles.inviteStudentRow} onClick={() => onSelectStudent(s.email)}>
                  {s.avatarUrl
                    ? <Image src={s.avatarUrl} alt={s.name} width={32} height={32} className={styles.inviteStudentAvatar} />
                    : <div className={styles.inviteStudentAvatarFallback}>{s.name[0]?.toUpperCase()}</div>
                  }
                  <span className={styles.inviteStudentName}>{s.name}</span>
                  <span className={styles.inviteStudentEmail}>{s.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {inviteFeedback && (
          <p className={`${styles.inviteFeedback} ${inviteFeedback.ok ? styles.inviteFeedbackOk : styles.inviteFeedbackErr}`}>
            {inviteFeedback.msg}
          </p>
        )}

        <button
          className={styles.inviteSendBtn}
          onClick={onSend}
          disabled={inviteSending || !inviteEmail.trim()}
        >
          {inviteSending ? 'Отправляем...' : 'Отправить приглашение'}
        </button>
      </div>
    </div>
  )
}
