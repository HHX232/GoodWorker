import {ReactNode} from 'react'

export enum PostBlockType {
  TEXT = 'TEXT',
  MEDIA = 'MEDIA',
  AUDIO = 'AUDIO',
  TEST_LINK = 'TEST_LINK',
  MINI_TEST = 'MINI_TEST',
  POST_LINK = 'POST_LINK',
  ROAD_MAP_LINK = 'ROAD_MAP_LINK',
  FILE_LIST = 'FILE_LIST'
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

export interface PostTestLinkEntry {
  id: string
  title: string
}

export interface PostTestLinkPayload {
  tests?: PostTestLinkEntry[]
  // legacy single-test fields (backwards compat)
  testId?: string | null
  title?: string | null
}

export function getPostTestLinks(payload: PostTestLinkPayload): PostTestLinkEntry[] {
  if (payload.tests?.length) return payload.tests
  if (payload.testId) return [{ id: payload.testId, title: payload.title ?? '' }]
  return []
}

export interface PostMiniTestPayload {
  title: string
  blocks: import('@/entities/store/slices/tasksSlice.slice').TestBlock[]
}

export interface PostPostLinkPayload {
  postId: string
  postTitle: string
  postSlug?: string | null
}

export interface PostRoadMapLinkPayload {
  roadmapId: string
  roadmapTitle: string
}

export interface PostFileEntry {
  name: string
  size: number
  mimeType: string
  url: string
}

export interface PostFileListPayload {
  files: PostFileEntry[]
}

export type PostBlockPayload = PostTextPayload | PostMediaPayload | PostAudioPayload | PostTestLinkPayload | PostMiniTestPayload | PostPostLinkPayload | PostRoadMapLinkPayload | PostFileListPayload

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
