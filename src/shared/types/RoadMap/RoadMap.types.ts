/* eslint-disable @typescript-eslint/no-explicit-any */
import {Node} from '@xyflow/react'
import {LucideProps} from 'lucide-react'

export enum RoadMapBlockType {
  TEST_LINK = 'TEST_LINK',
  ENTRY_POINT = 'ENTRY_POINT',
  POST_LINK = 'POST_LINK',
  // GROUP_POSTS_LINK = 'GROUP_POSTS_LINK',
  // ACTIVE_TEST_LINK = 'ACTIVE_TEST_LINK',
  // TEACHER_SERVICE_LINK = 'TEACHER_SERVICE_LINK',
  // DOWNLOAD_FILE_LINK = 'DOWNLOAD_FILE_LINK',
  INFO_TEXT = 'INFO_TEXT',
  DIVIDER = 'DIVIDER',
  DOWNLOAD_FILE_LINK = 'DOWNLOAD_FILE_LINK',

  INFO_MEDIA = 'INFO_MEDIA',
  INFO_AUDIO = 'INFO_AUDIO'
}
export enum RoadMapParamType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  SELECT = 'SELECT',
  FILE = 'FILE',
  SELECT_MY_TEST = 'SELECT_MY_TEST',
  SELECT_MY_POST = 'SELECT_MY_POST',
  HIDE = 'HIDE'
}

export interface BlockRoadParam {
  name: string
  type: RoadMapParamType
  helpText?: string
  required?: boolean
  hideHandle?: boolean
  value?: string
  [key: string]: any
}

export type RoadMapTask = {
  label: string
  icon: React.FC<LucideProps>
  type: RoadMapBlockType
  isEntryPoint?: boolean
  inputs: BlockRoadParam[]
  outputs?: BlockRoadParam[]
  headerColor?: string
}

// NODE
export interface RoadNodeData extends Record<string, unknown> {
  type: RoadMapBlockType
  inputs: Record<string, string>
  outputs?: {name: string; type: RoadMapParamType}[]
  headerColor?: string
  mediaSize?: 'mini' | 'medium' | 'large'
  isPaywallHidden?: boolean
  selectedPostIds?: string[]
  uploadedFiles?: {name: string; size: number; mimeType: string; url: string}[]

  // Для начального блока
  roadTitle?: string
  roadDescription?: string
  roadCategory?: string
  roadPreview?: string
}

export interface RoadNode extends Node {
  data: RoadNodeData
  headerColor?: string
}
