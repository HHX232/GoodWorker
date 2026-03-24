import { JSONContent } from '@tiptap/core'

export interface FillTextPayload {
  content: JSONContent | null
}

// SEQUENCE
export interface SequencePayload {
  items: { id: string; text: string }[]
}

// CHOOSE_OPTION
export interface ChooseOptionPayload {
  question: string
  options: { id: string; text: string }[]
  correctId: string | string[]
}

// MATCH_PAIRS
export interface MatchPairsPayload {
  pairs: { id: string; left: string; right: string }[]
}

// FREE_ANSWER
export interface FreeAnswerPayload {
  question: string
  referenceAnswer?: string
}

export interface InfoTextPayload {
  content: object | null
}
 
export type InfoMediaKind = 'image' | 'video'
 
export interface InfoMediaPayload {
  kind:    InfoMediaKind | null
  url:     string | null
  caption: string | null
}
 
// ── INFO_AUDIO ─────────────────────────────────────────────
export interface InfoAudioPayload {
  url:      string | null  
  filename: string | null  

  waveform: number[] | null
}
 
 

export interface HighlightToken {
  id:        number
  text:      string
  isCorrect: boolean   // true = это слово нужно выделить
}
 
export interface HighlightTextPayload {
  instruction: string | null           // "Выдели все глаголы"
  tokens:      HighlightToken[] | null // текст разбитый на токены
}
 
// ── WORD_SCRAMBLE ──────────────────────────────────────────
export type WordScrambleMode = 'letters' | 'words'
 
export interface WordScramblePayload {
  mode:        WordScrambleMode        // 'letters' = буквы слова, 'words' = слова предложения
  source:      string | null           // исходное слово или предложение
  hint:        string | null           // подсказка / перевод (необязательно)
}
 
export interface DialogueSpeakers {
  a: string   // имя левого участника
  b: string   // имя правого участника
}
 
export interface DialogueLine {
  id:      string
  speaker: 'a' | 'b'
  text:    string
}
 
export interface DialoguePayload {
  instruction: string | null
  speakers:    DialogueSpeakers
  lines:       DialogueLine[]
}