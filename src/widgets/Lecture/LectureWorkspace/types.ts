// Client mirrors of GET /api/lecture/[id].

export interface LectureDto {
  id: string
  title: string
  status: 'RECORDING' | 'FINALIZING' | 'READY'
  docJson: unknown
  processedSeq: number
  keepAudio: boolean
  recordedMs: number
  costKopecks: number
  fileId: string | null
  createdAt: string
  updatedAt: string
}

export interface ChunkDto {
  seq: number
  startMs: number
  durationMs: number
  text: string
  isFinal: boolean
  hasAudio: boolean
}

/** Only `billingEnabled` for non-admins — the tariff's internals stay server-side. */
export interface TariffDto {
  billingEnabled: boolean
}

export interface LectureResponse {
  lecture: LectureDto
  chunks: ChunkDto[]
  tariff: TariffDto
  access: boolean
  isAdmin: boolean
  sttConfigured: boolean
}

export type UploadIssue = 'offline' | 'busy' | 'stt' | 'limit' | null
