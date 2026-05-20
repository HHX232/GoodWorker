import instance from '@/shared/api'

export interface ITeacherCategory {
  category: {
    id: string
    slug: string
    translations: {langCode: string; name: string}[]
  }
}

export interface ITeacherListItem {
  id: string
  name: string
  avatarUrl: string | null
  isVip: boolean
  lastSeenAt: string | null
  languages: string[]
  categories: ITeacherCategory[]
  _count: {posts: number; students: number}
}

export interface ITeachersQuery {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
}

export interface ITeachersResponse {
  teachers: ITeacherListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const TeacherService = {
  async getList(query: ITeachersQuery = {}): Promise<ITeachersResponse> {
    const params = new URLSearchParams()
    if (query.page) params.set('page', String(query.page))
    if (query.limit) params.set('limit', String(query.limit))
    if (query.search) params.set('search', query.search)
    if (query.categoryId) params.set('categoryId', query.categoryId)
    const response = await instance.get<ITeachersResponse>(`/teachers?${params.toString()}`)
    return response.data
  }
}

export default TeacherService
