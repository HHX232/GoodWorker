'use client'
import { useLocalPref } from '@/shared/lib/chess/localPref'

// localStorage['gw-chess-openings'] = {[openingId]: 'viewed' | 'done'} (spec §7: client-only progress)
export type OpeningMark = 'viewed' | 'done'
const KEY = 'gw-chess-openings'

function parse(raw: string): Record<string, OpeningMark> {
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

export function useOpeningProgress(): [Record<string, OpeningMark>, (id: string, mark: OpeningMark) => void] {
  const [raw, setRaw] = useLocalPref(KEY, '{}')
  const marks = parse(raw)
  const mark = (id: string, m: OpeningMark) => {
    if (marks[id] === 'done' || marks[id] === m) return // never downgrade done → viewed
    setRaw(JSON.stringify({ ...marks, [id]: m }))
  }
  return [marks, mark]
}
