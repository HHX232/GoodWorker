import React from 'react'
import { type Layout, type Participant } from '../types'
import { type CallTestState } from './TestTile'
import styles from '../VideoCallPage.module.scss'

interface VideoLayoutProps {
  layout: Layout
  participants: Participant[]
  testIsMain: boolean
  mainPart: Participant | null
  sideParts: Participant[]
  callTest: CallTestState | null
  renderTile: (p: Participant, large?: boolean, isPip?: boolean) => React.ReactNode
  renderTestTile: (large: boolean) => React.ReactNode
}

export function VideoLayout({
  layout,
  participants,
  testIsMain,
  mainPart,
  sideParts,
  callTest,
  renderTile,
  renderTestTile,
}: VideoLayoutProps) {
  if (participants.length === 0) {
    return (
      <div className={styles.waiting}>
        <div className={styles.waitingPulse} />
        <p>Ожидаем участников...</p>
      </div>
    )
  }

  // ── New stage layout (pip mode = default) ────────────────────────────────
  if (layout === 'pip') {
    const localPart = participants.find(p => p.isLocal)
    const railParts = testIsMain
      ? participants
      : sideParts.filter(p => !p.isLocal)
    const showRail = railParts.length > 0 || (!testIsMain && callTest)

    return (
      <div className={styles.stage}>
        <div className={styles.mainTile}>
          {testIsMain ? renderTestTile(true) : mainPart && renderTile(mainPart, true)}
          {localPart && (
            <div className={styles.selfCluster}>
              <div className={styles.selfPip}>
                {renderTile(localPart, false, true)}
              </div>
            </div>
          )}
        </div>

        {showRail && (
          <div className={styles.rail}>
            {railParts.map(p => (
              <div className={styles.railTileWrap} key={p.identity}>
                {renderTile(p, false, true)}
              </div>
            ))}
            {!testIsMain && callTest && (
              <div className={styles.railTileWrap} key="__test__">
                {renderTestTile(false)}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Split layout ─────────────────────────────────────────────────────────
  if (layout === 'split') {
    return (
      <div className={styles.splitArea}>
        {participants.map(p => renderTile(p))}
        {callTest && callTest.mode !== 'whiteboard' && renderTestTile(false)}
      </div>
    )
  }

  // ── Grid layout ──────────────────────────────────────────────────────────
  const totalCount = participants.length + (callTest && callTest.mode !== 'whiteboard' ? 1 : 0)
  return (
    <div className={styles.gridArea} data-count={totalCount}>
      {participants.map(p => renderTile(p))}
      {callTest && callTest.mode !== 'whiteboard' && renderTestTile(false)}
    </div>
  )
}
