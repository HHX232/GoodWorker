'use client'

import { useSyncExternalStore } from 'react'
import { lectureRecorder, type RecorderState } from './lectureRecorder'

const SERVER_STATE: RecorderState = { status: 'idle', lectureId: null, elapsedMs: 0, level: 0, error: null, wasHidden: false, wakeLock: false }

export function useRecorderState(): RecorderState {
  return useSyncExternalStore(
    fn => lectureRecorder.subscribe(fn),
    () => lectureRecorder.getState(),
    () => SERVER_STATE,
  )
}
