import {ReactNode} from 'react'

export enum PostBlockType {
  TEXT = 'TEXT',
  MEDIA = 'MEDIA',
  AUDIO = 'AUDIO',
  TEST_LINK = 'TEST_LINK',
  MINI_TEST = 'MINI_TEST'
}

export interface PostTextPayload {
  content: object | null
}

export type PostMediaKind = 'image' | 'video'

export interface PostMediaPayload {
  kind: PostMediaKind | null
  url: string | null
  caption: string | null
}

export interface PostAudioPayload {
  url: string | null
  filename: string | null
  waveform: number[] | null
}

export interface PostTestLinkPayload {
  testId: string | null
  title: string | null
}

export interface PostMiniTestPayload {
  testId: string | null
  title: string | null
}

export type PostBlockPayload = PostTextPayload | PostMediaPayload | PostAudioPayload | PostTestLinkPayload | PostMiniTestPayload

export interface PostBlockMeta {
  type: PostBlockType
  label: string
  description: string
  icon: ReactNode
  defaultPayload: PostBlockPayload
}

export interface PostBlock<T extends PostBlockPayload = PostBlockPayload> {
  id: string
  type: PostBlockType
  payload: T
}
