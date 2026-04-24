import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'

// types/test.types.ts
export interface ITestFull {
  id: string
  title: string
  aiTopic: string | null
  content: {
    description: string
    blocks: TestBlock[]
  }
  testCategories: Array<{
    categoryId: string
    category: {id: string; slug: string}
  }>
}

export interface IAttemptResponse {
  attemptId: string
  errorsCreated: number
}
