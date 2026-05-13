export type Layout = 'pip' | 'split' | 'grid'

export interface Participant {
  identity: string
  isLocal: boolean
  audioMuted: boolean
  videoMuted: boolean
  localAudioMuted: boolean
  avatarUrl?: string
}

export interface NoteEntry {
  identity: string
  text: string
}

export const LAYOUTS: Layout[] = ['pip', 'split', 'grid']

export const LAYOUT_LABELS: Record<Layout, string> = {
  pip: 'PiP',
  split: 'Рядом',
  grid: 'Сетка',
}
