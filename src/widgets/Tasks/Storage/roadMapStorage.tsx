import {Edge, Node} from '@xyflow/react'
import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'

export interface SavedRoadMap {
  id: string
  nodes: Node<RoadNodeData>[]
  edges: Edge[]
  createdAt: string
  updatedAt: string
}

const KEY = 'saved_road_maps'

function getAll(): SavedRoadMap[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function setAll(maps: SavedRoadMap[]) {
  localStorage.setItem(KEY, JSON.stringify(maps))
}

export const roadMapStorage = {
  create(): SavedRoadMap {
    const all = getAll()
    const now = new Date().toISOString()
    const map: SavedRoadMap = {
      id: crypto.randomUUID(),
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now
    }
    setAll([...all, map])
    return map
  },

  update(id: string, data: {nodes: Node<RoadNodeData>[]; edges: Edge[]}): void {
    const all = getAll()
    const idx = all.findIndex((m) => m.id === id)
    if (idx === -1) return
    all[idx] = {...all[idx], ...data, updatedAt: new Date().toISOString()}
    setAll(all)
  },

  getById(id: string): SavedRoadMap | null {
    return getAll().find((m) => m.id === id) ?? null
  },

  delete(id: string) {
    setAll(getAll().filter((m) => m.id !== id))
  }
}
