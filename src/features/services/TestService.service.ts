import instance from '@/shared/api'

export interface ITestItem {
  id: string
  title: string
  aiTopic?: string | null
  createdAt: string
  updatedAt: string
  teacherId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content?: { blocks: any[] }
  teacher?: { id: string; name: string; avatarUrl: string | null }
  testCategories?: Array<{
    category: {
      id: string
      slug: string
      translations: Array<{ langCode: string; name: string }>
    }
  }>
}

const TestService = {
  // My own tests (teacher session required)
  getMyTests(): Promise<ITestItem[]> {
    return instance.get<ITestItem[]>('/tests').then(r => r.data)
  },

  // Public tests by a specific teacher
  getByTeacher(teacherId: string): Promise<ITestItem[]> {
    return instance.get<ITestItem[]>(`/tests?teacherId=${teacherId}`).then(r => r.data)
  },

  // All tests (admin only)
  getAll(): Promise<ITestItem[]> {
    return instance.get<ITestItem[]>('/tests?all=true').then(r => r.data)
  },

  getById(id: string): Promise<ITestItem> {
    return instance.get<ITestItem>(`/tests/${id}`).then(r => r.data)
  },
}

export default TestService
