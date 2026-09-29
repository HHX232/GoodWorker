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

export interface TariffDto {
  baseMinutes: number
  basePer5MinKopecks: number
  extraPer5MinKopecks: number
  aiMarkup: number
  maxMinutesPerDay: number
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
