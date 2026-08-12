/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBlock } from '@/entities/store/slices/tasksSlice.slice'
import { StudentAnswer } from '@/features/Tasks/TaskResult/scoreBlock'
import {
  AnswerRecord,
  CallTestStudentView,
  CallTestTeacherView,
  StudentProgress,
  serializeAnswer,
} from '../CallTestPanel/CallTestPanel'
import { CallWhiteboard } from '../CallWhiteboard/CallWhiteboard'
import { type Participant } from '../types'
import styles from '../VideoCallPage.module.scss'

export interface CallTestState {
  testId: string | null
  title: string
  blocks: TestBlock[]
  mode?: 'test' | 'whiteboard'
}

interface TestTileProps {
  callTest: CallTestState
  large: boolean
  isOwner: boolean
  studentProgress: Record<string, StudentProgress>
  students: Participant[]
  localTestSubmitted: boolean
  whiteboardElements: any[] | null
  whiteboardFiles: Record<string, any> | null
  onBroadcastChunked: (msg: object) => void
  onStop: () => void
  onHide: () => void
  onLocalHideWhiteboard: () => void
  onBroadcastWhiteboard: (elements: readonly any[], files: Record<string, any>) => void
  onSetLocalTestSubmitted: (v: boolean) => void
  onMakeMain: () => void
}

export function TestTile({
  callTest,
  large,
  isOwner,
  studentProgress,
  students,
  localTestSubmitted,
  whiteboardElements,
  whiteboardFiles,
  onBroadcastChunked,
  onStop,
  onHide,
  onLocalHideWhiteboard,
  onBroadcastWhiteboard,
  onSetLocalTestSubmitted,
  onMakeMain,
}: TestTileProps) {
  const isOneOnOne = students.length === 1
  const submitted = Object.values(studentProgress).filter(p => p.submitted).length
  const total = students.length

  if (large) {
    if (callTest.mode === 'whiteboard') {
      return (
        <div className={`${styles.tile} ${styles.tileLarge} ${styles.testTileLarge}`}>
          <div className={styles.testTileContent}>
            <CallWhiteboard
              isOwner={isOwner}
              remoteElements={whiteboardElements}
              remoteFiles={whiteboardFiles}
              onBroadcast={onBroadcastWhiteboard}
              onStop={onStop}
              onHide={isOwner ? onHide : onLocalHideWhiteboard}
            />
          </div>
        </div>
      )
    }

    return (
      <div className={`${styles.tile} ${styles.tileLarge} ${styles.testTileLarge}`}>
        <div className={styles.tileMeta}>
          <span className={styles.tileName}>📋 {callTest.title}</span>
        </div>
        <div className={styles.testTileContent}>
          {isOwner ? (
            <CallTestTeacherView
              blocks={callTest.blocks}
              title={callTest.title}
              studentProgress={studentProgress}
              studentCount={total}
              isOneOnOne={isOneOnOne}
              studentIdentity={students[0]?.identity}
              participants={students.map(p => p.identity)}
              onStop={onStop}
              onHide={onHide}
            />
          ) : (
            <CallTestStudentView
              blocks={callTest.blocks}
              title={callTest.title}
              onAnswer={(blockId, answer) =>
                onBroadcastChunked({ type: 'call_test_answer', blockId, answer: serializeAnswer(answer as StudentAnswer) })
              }
              onSubmit={(answers: AnswerRecord) => {
                onSetLocalTestSubmitted(true)
                onBroadcastChunked({ type: 'call_test_submit', answers })
              }}
              submitted={localTestSubmitted}
            />
          )}
        </div>
      </div>
    )
  }

  const tileIcon = callTest.mode === 'whiteboard' ? '🎨' : '📋'
  return (
    <div className={`${styles.tile} ${styles.testTileSmall}`} onClick={onMakeMain}>
      <div className={styles.noVideo}>
        <div className={styles.testTileIcon}>{tileIcon}</div>
      </div>
      <div className={styles.testTilePreviewMeta}>
        <span className={styles.testTilePreviewTitle}>{callTest.title}</span>
        {isOwner && total > 0 && callTest.mode !== 'whiteboard' && (
          <span className={styles.testTilePreviewProgress}>{submitted}/{total} сдали</span>
        )}
      </div>
    </div>
  )
}
