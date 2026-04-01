// features/test-block-editor/model/registry.ts

import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {ReactNode} from 'react'
import {ChooseOptionTask} from './TaskObjects/ChooseOptionTask'
import {DialogueTask} from './TaskObjects/DialogueTask'
import {FillTextTask} from './TaskObjects/FillTextTask'
import {FreeAnswerTask} from './TaskObjects/FreeAnswerTask'
import {HighlightTextTask} from './TaskObjects/HighlightTextTask'
import {InfoAudioTask} from './TaskObjects/InfoAudioTask'
import {InfoMediaTask} from './TaskObjects/InfoMediaTask'
import {InfoTextTask} from './TaskObjects/InfoTextTask'
import {MatchPairsTask} from './TaskObjects/MatchPairsTask'
import {SequenceTask} from './TaskObjects/SequenceTask'
import {WordScrambleTask} from './TaskObjects/WordScrambleTask'

type TAvailableFor = 'lang' | 'math' | 'all'

export interface TestUserBlockMeta {
  type: TaskBlockType
  label: string
  description: string
  credits?: number
  icon: ReactNode
  defaultPayload: unknown
  availableFor?: TAvailableFor[]
}

type Registry = {
  [K in TaskBlockType]: TestUserBlockMeta & {type: K}
}

const TestUserBlockRegistry: Registry = {
  [TaskBlockType.FILL_TEXT]: FillTextTask,
  [TaskBlockType.SEQUENCE]: SequenceTask,
  [TaskBlockType.CHOOSE_OPTION]: ChooseOptionTask,
  [TaskBlockType.MATCH_PAIRS]: MatchPairsTask,
  [TaskBlockType.FREE_ANSWER]: FreeAnswerTask,
  [TaskBlockType.INFO_TEXT]: InfoTextTask,
  [TaskBlockType.INFO_MEDIA]: InfoMediaTask,
  [TaskBlockType.INFO_AUDIO]: InfoAudioTask,
  [TaskBlockType.HIGHLIGHT_TEXT]: HighlightTextTask,
  [TaskBlockType.WORD_SCRAMBLE]: WordScrambleTask,
  [TaskBlockType.DIALOGUE]: DialogueTask
}
export default TestUserBlockRegistry
