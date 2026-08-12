'use client'

import { useState } from 'react'
import styles from '@/widgets/VideoRoom/VideoCallPage.module.scss'

const COLORS = ['#3b82f6', '#16a34a', '#f0975a', '#6d5bd0', '#db2777']
const FAKE_PARTICIPANTS = [
  { id: '1', name: 'Алиса Смирнова', initials: 'АС', color: COLORS[0], micOff: false },
  { id: '2', name: 'Uguan',          initials: 'UG', color: COLORS[1], micOff: true  },
  { id: '3', name: 'Мария Соколова', initials: 'МС', color: COLORS[2], micOff: false },
]

export default function StubRoom({ userName }: { userName: string }) {
  const [micOn, setMicOn]         = useState(true)
  const [camOn, setCamOn]         = useState(true)
  const [showNotes, setShowNotes] = useState(false)
  const [gridMode, setGridMode]   = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showMore, setShowMore]   = useState(false)

  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'ВЫ'

  const callroomClass = `${styles.callroom}${gridMode ? ' ' + styles.gridMode : ''}`

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
  }

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.topDot} />
          <span className={styles.topRoom}>zagluha777</span>
          <span className={styles.topTopic}>Тестовая комната</span>
        </div>
        <div className={styles.topBarRight}>
          <span className={styles.topUser}>{userName}</span>
          <span className={styles.topOwner}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
            Владелец
          </span>
        </div>
      </div>

      {/* Call room */}
      <div className={callroomClass}>
        <div className={styles.stage}>

          {/* Main tile */}
          <div className={styles.mainTile}>
            <div className={styles.noVideo}>
              <div
                className={styles.avatar}
                style={{ background: 'linear-gradient(135deg,#6d5bd0,#9b6cf0,#f0975a)', width: 150, height: 150, fontSize: 52, fontWeight: 800, borderRadius: '50%' }}
              >
                {initials}
              </div>
            </div>

            {/* Self PIP bottom-left */}
            <div className={styles.selfCluster}>
              <div className={styles.selfPip}>
                <div className={styles.noVideo} style={{ position: 'absolute', inset: 0 }}>
                  <div className={styles.avatar} style={{ background: '#534AB7', width: 44, height: 44, fontSize: 16, fontWeight: 700, borderRadius: '50%' }}>
                    {initials}
                  </div>
                </div>
                <div className={styles.tileMeta}>
                  <span className={styles.tileName}>Вы</span>
                  <div className={styles.tileBadges}>
                    <span className={styles.badgeYou}>ВЫ</span>
                  </div>
                </div>
                {!micOn && (
                  <span className={styles.mutedIcon}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M4 4l16 16M12 15a3 3 0 0 0 3-3V9m-6 3V6a3 3 0 0 1 5.2-2"/>
                      <path d="M19 11a7 7 0 0 1-9.3 6.6M5 11a7 7 0 0 0 2 4.9"/>
                    </svg>
                  </span>
                )}
              </div>
            </div>

            {/* Tile top: name + speaking badge */}
            <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(10,8,20,.55)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 14.5, fontWeight: 700, padding: '8px 14px', borderRadius: 11 }}>
                {userName}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(91,63,214,.9)', color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '7px 13px', borderRadius: 999 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#8dffa8', display: 'inline-block' }} />
                Говорит
              </span>
            </div>
          </div>

          {/* Right rail */}
          <div className={styles.rail}>
            {FAKE_PARTICIPANTS.map(p => (
              <div className={styles.railTileWrap} key={p.id}>
                <div className={styles.tile}>
                  <div className={styles.noVideo}>
                    <div className={styles.avatar} style={{ background: p.color }}>
                      {p.initials}
                    </div>
                  </div>
                  <div className={styles.tileMeta}>
                    <span className={styles.tileName}>{p.name}</span>
                    {p.micOff && (
                      <span className={styles.mutedIcon}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M4 4l16 16M12 15a3 3 0 0 0 3-3V9m-6 3V6a3 3 0 0 1 5.2-2"/>
                          <path d="M19 11a7 7 0 0 1-9.3 6.6M5 11a7 7 0 0 0 2 4.9"/>
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Control bar */}
        <div className={styles.controlbar}>
          {/* Left: grid + teacher tools */}
          <div className={styles.cbGroupLeft}>
            <button
              className={`${styles.cbTool} ${gridMode ? styles.cbToolActive : ''}`}
              onClick={() => setGridMode(v => !v)}
              data-tip="Сменить расположение камер"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              Сетка
            </button>
            <button className={styles.cbTool} data-tip="Открыть тест всем участникам">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              Открыть тест
            </button>
            <button className={styles.cbTool} data-tip="Открыть доску для всех">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 18v3"/><path d="M7 9l3 3-3 3M13 15h4"/>
              </svg>
              Whiteboard
            </button>
          </div>

          {/* Center: media controls */}
          <div className={styles.cbGroupCenter}>
            <button className={styles.cbRound} data-tip="Перевернуть камеру">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </button>
            <button
              className={`${styles.cbRound} ${!micOn ? styles.cbRoundOff : ''}`}
              onClick={() => setMicOn(v => !v)}
              data-tip={micOn ? 'Выключить микрофон' : 'Включить микрофон'}
            >
              {micOn
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v3"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="M4 4l16 16M12 15a3 3 0 0 0 3-3V9m-6 3V6a3 3 0 0 1 5.2-2"/><path d="M19 11a7 7 0 0 1-9.3 6.6M5 11a7 7 0 0 0 2 4.9"/></svg>
              }
            </button>
            <button
              className={`${styles.cbRound} ${!camOn ? styles.cbRoundOff : ''}`}
              onClick={() => setCamOn(v => !v)}
              data-tip={camOn ? 'Выключить камеру' : 'Включить камеру'}
            >
              {camOn
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="14" height="12" rx="2.5"/><path d="m16 10 6-3v10l-6-3z"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l20 20M9.5 6H16a2 2 0 0 1 2 2v3.5M14 18H4a2 2 0 0 1-2-2V8c0-.7.3-1.3.8-1.7M22 8v8l-4.5-3"/></svg>
              }
            </button>
            <button className={styles.cbRound} data-tip="Перезапустить камеру">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>
              </svg>
            </button>
            {/* Mobile-only more button */}
            <button className={styles.cbMore} onClick={() => setShowMore(true)} aria-label="Ещё">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                <circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>
              </svg>
            </button>
          </div>

          {/* Right: invite + notes + end */}
          <div className={styles.cbGroupRight}>
            <button className={styles.cbTool} onClick={() => setShowInvite(true)} data-tip="Пригласить участника">
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
              onClick={() => setShowNotes(v => !v)}
              data-tip="Конспект урока"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>
              </svg>
              Конспект урока
            </button>
            <button className={styles.cbEnd} data-tip="Завершить звонок для всех">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
                <line x1="16" y1="2" x2="22" y2="8"/>
                <line x1="22" y1="2" x2="16" y2="8"/>
              </svg>
              Завершить для всех
            </button>
          </div>
        </div>

        {/* Notes modal */}
        {showNotes && (
          <div className={styles.notesPanel} onClick={(e) => { if (e.target === e.currentTarget) setShowNotes(false) }}>
            <div className={styles.notesPanelInner}>
              <div className={styles.notesPanelHeader}>
                <span>Конспект урока</span>
                <button className={styles.notesPanelClose} onClick={() => setShowNotes(false)}>✕</button>
              </div>
              <div className={styles.notesList}>
                {[
                  { who: userName, text: 'Сегодня разберём хуки useState и useEffect на практике.' },
                  { who: 'Алиса Смирнова', text: 'А можно пример с таймером на useEffect?' },
                  { who: userName, text: 'Да, сейчас покажу. Обратите внимание на массив зависимостей.' },
                  { who: 'Uguan', text: 'Если массив пустой, эффект сработает один раз?' },
                  { who: userName, text: 'Верно. Давайте откроем пример и пройдём его вместе.' },
                ].map((n, i) => (
                  <div key={i} className={styles.noteEntry}>
                    <span className={styles.noteAuthor} style={n.who === userName ? { background: '#2c2550', color: '#b9a6ff' } : { background: '#1f2c44', color: '#7fb0f5' }}>
                      {n.who === userName ? 'Учитель' : 'Ученик'}
                    </span>
                    <span className={styles.noteText}>{n.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mobile bottom sheet */}
        {showMore && (
          <div className={styles.moreSheetBackdrop} onClick={e => { if (e.target === e.currentTarget) setShowMore(false) }}>
            <div className={styles.moreSheet}>
              <div className={styles.moreGrip} />
              <div className={styles.moreSheetTitle}>Ещё действия</div>
              <button className={styles.moreItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                Открыть тест
              </button>
              <button className={styles.moreItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>
                Whiteboard
              </button>
              <button className={styles.moreItem} onClick={() => { setShowMore(false); setShowNotes(true) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></svg>
                Конспект урока
              </button>
              <button className={styles.moreItem} onClick={() => { setShowMore(false); setShowInvite(true) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
                Пригласить
              </button>
              <button className={`${styles.moreItem} ${styles.moreDanger}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/><line x1="16" y1="2" x2="22" y2="8"/><line x1="22" y1="2" x2="16" y2="8"/></svg>
                Завершить для всех
              </button>
            </div>
          </div>
        )}

        {/* Link-copy invite modal */}
        {showInvite && (
          <div
            className={styles.inviteLinkOverlay}
            onClick={e => { if (e.target === e.currentTarget) setShowInvite(false) }}
          >
            <div className={styles.inviteLinkCard}>
              <div className={styles.inviteLinkHeader}>
                <span>Пригласить участника</span>
                <button className={styles.inviteLinkClose} onClick={() => setShowInvite(false)}>✕</button>
              </div>
              <p className={styles.inviteLinkHint}>Поделитесь ссылкой на комнату</p>
              <div className={styles.inviteLinkRow}>
                <input
                  className={styles.inviteLinkInput}
                  readOnly
                  value={typeof window !== 'undefined' ? window.location.href : ''}
                  onFocus={e => e.currentTarget.select()}
                />
                <button className={styles.inviteLinkCopy} onClick={copyLink}>
                  {linkCopied
                    ? <span className={styles.inviteLinkCopied}>✓ Скопировано!</span>
                    : 'Копировать'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
