import { useState } from 'react'
import { IconCam, IconCamOff, IconMicOff, IconMicOn, IconPalette, IconClipboard } from '../icons'
import { type Layout } from '../types'
import { type CallTestState } from './TestTile'
import styles from '../VideoCallPage.module.scss'

interface ControlsBarProps {
  overlay?: boolean
  controlsActive?: boolean
  layout: Layout
  isMainSpeaker: boolean
  isOwner: boolean
  copied: boolean
  showNotes: boolean
  micEnabled: boolean
  camEnabled: boolean
  videoDevices: MediaDeviceInfo[]
  screenShareEnabled: boolean
  callTest: CallTestState | null
  mainSpeaker: string
  browserHasSpeech: boolean
  onShareLink: () => void
  onChangeLayout: (l: Layout) => void
  onToggleNotes: () => void
  onOpenTestPicker: () => void
  onLaunchWhiteboard: () => void
  onOpenInvite: () => void
  onMakeTestMain: () => void
  onToggleMic: () => void
  onToggleCam: () => void
  onSwitchCamera: () => void
  onReloadCamera: () => void
  onToggleScreenShare: () => void
  onLeave: () => void
}

export function ControlsBar({
  layout,
  isOwner,
  showNotes,
  micEnabled,
  camEnabled,
  callTest,
  mainSpeaker,
  onChangeLayout,
  onToggleNotes,
  onOpenTestPicker,
  onLaunchWhiteboard,
  onMakeTestMain,
  onToggleMic,
  onToggleCam,
  onSwitchCamera,
  onReloadCamera,
  onOpenInvite,
  onLeave,
}: ControlsBarProps) {
  const [showMore, setShowMore] = useState(false)
  return (
    <>
    <div className={styles.controlbar}>

      {/* ── Left: grid toggle + teacher tools ────────────────────────────── */}
      <div className={styles.cbGroupLeft}>
        <button
          className={`${styles.cbTool} ${layout === 'grid' ? styles.cbToolActive : ''}`}
          onClick={() => onChangeLayout(layout === 'grid' ? 'pip' : 'grid')}
          data-tip="Сменить расположение камер"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          Сетка
        </button>
        {isOwner && !callTest && (
          <>
            <button className={styles.cbTool} onClick={onOpenTestPicker} data-tip="Открыть тест всем участникам">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              Открыть тест
            </button>
            <button className={styles.cbTool} onClick={onLaunchWhiteboard} data-tip="Открыть доску для всех">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 18v3"/><path d="M7 9l3 3-3 3M13 15h4"/>
              </svg>
              Whiteboard
            </button>
          </>
        )}
        {callTest && (
          <button
            className={`${styles.cbTool} ${mainSpeaker === '__test__' ? styles.cbToolActive : ''}`}
            onClick={onMakeTestMain}
          >
            {callTest.mode === 'whiteboard' ? <IconPalette /> : <IconClipboard />}
            {callTest.title}
          </button>
        )}
      </div>

      {/* ── Center: media controls ───────────────────────────────────────── */}
      <div className={styles.cbGroupCenter}>
        <button
          className={styles.cbRound}
          onClick={onSwitchCamera}
          data-tip="Перевернуть камеру"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </button>
        <button
          className={`${styles.cbRound} ${!micEnabled ? styles.cbRoundOff : ''}`}
          onClick={onToggleMic}
          data-tip={micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
        >
          {micEnabled ? <IconMicOn /> : <IconMicOff />}
        </button>
        <button
          className={`${styles.cbRound} ${!camEnabled ? styles.cbRoundOff : ''}`}
          onClick={onToggleCam}
          data-tip={camEnabled ? 'Выключить камеру' : 'Включить камеру'}
        >
          {camEnabled ? <IconCam /> : <IconCamOff />}
        </button>
        <button
          className={styles.cbRound}
          onClick={onReloadCamera}
          data-tip="Перезапустить камеру"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>
          </svg>
        </button>
        {/* Mobile-only "more" button */}
        <button className={styles.cbMore} onClick={() => setShowMore(true)} aria-label="Ещё">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
            <circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>
          </svg>
        </button>
      </div>

      {/* ── Right: invite + notes + leave ────────────────────────────────── */}
      <div className={styles.cbGroupRight}>
        <button className={styles.cbTool} onClick={onOpenInvite} data-tip="Пригласить участника">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="16" y1="11" x2="22" y2="11"/>
          </svg>
          Пригласить
        </button>
        <button
          className={`${styles.cbNotes} ${showNotes ? styles.cbNotesActive : ''}`}
          onClick={onToggleNotes}
          data-tip="Конспект урока"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>
          </svg>
          Конспект урока
        </button>
        <button className={styles.cbEnd} onClick={onLeave} data-tip={isOwner ? 'Завершить звонок для всех' : 'Покинуть комнату'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
            <line x1="16" y1="2" x2="22" y2="8"/>
            <line x1="22" y1="2" x2="16" y2="8"/>
          </svg>
          {isOwner ? 'Завершить для всех' : 'Покинуть'}
        </button>
      </div>

    </div>

    {/* Mobile bottom sheet ("more") */}
    {showMore && (
      <div className={styles.moreSheetBackdrop} onClick={e => { if (e.target === e.currentTarget) setShowMore(false) }}>
        <div className={styles.moreSheet}>
          <div className={styles.moreGrip} />
          <div className={styles.moreSheetTitle}>Ещё действия</div>
          {isOwner && !callTest && (
            <button className={styles.moreItem} onClick={() => { setShowMore(false); onOpenTestPicker() }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Открыть тест
            </button>
          )}
          {isOwner && !callTest && (
            <button className={styles.moreItem} onClick={() => { setShowMore(false); onLaunchWhiteboard() }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>
              Whiteboard
            </button>
          )}
          <button className={styles.moreItem} onClick={() => { setShowMore(false); onToggleNotes() }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></svg>
            Конспект урока
          </button>
          <button className={styles.moreItem} onClick={() => { setShowMore(false); onOpenInvite() }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
            Пригласить
          </button>
          <button className={`${styles.moreItem} ${styles.moreDanger}`} onClick={() => { setShowMore(false); onLeave() }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/><line x1="16" y1="2" x2="22" y2="8"/><line x1="22" y1="2" x2="16" y2="8"/></svg>
            {isOwner ? 'Завершить для всех' : 'Покинуть'}
          </button>
        </div>
      </div>
    )}
    </>
  )
}
