import {nanoid} from '@reduxjs/toolkit'
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'

export interface SavedTest {
  id: string
  title: string
  theme: string
  description: string
  blocks: TestBlock[]
  createdAt: string
  updatedAt: string
}

const KEY = 'saved_tests'

function getAll(): SavedTest[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function setAll(tests: SavedTest[]) {
  localStorage.setItem(KEY, JSON.stringify(tests))
}

export const testStorage = {
  save(data: Omit<SavedTest, 'id' | 'createdAt' | 'updatedAt'>): SavedTest {
    const all = getAll()
    const now = new Date().toISOString()
    const test: SavedTest = {...data, id: nanoid(), createdAt: now, updatedAt: now}
    setAll([...all, test])
    return test
  },

  update(id: string, data: Partial<Omit<SavedTest, 'id' | 'createdAt'>>): SavedTest | null {
    const all = getAll()
    const idx = all.findIndex((t) => t.id === id)
    if (idx === -1) return null
    const updated = {...all[idx], ...data, updatedAt: new Date().toISOString()}
    all[idx] = updated
    setAll(all)
    return updated
  },

  getById(id: string): SavedTest | null {
    return getAll().find((t) => t.id === id) ?? null
  },

  getAll,

  delete(id: string) {
    setAll(getAll().filter((t) => t.id !== id))
  }
}
