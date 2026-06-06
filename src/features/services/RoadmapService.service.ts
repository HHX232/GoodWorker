import instance from '@/shared/api'
import { AxiosError } from 'axios'

export type RoadmapAccessGrant = 'TEACHER' | 'PURCHASE'
export type RoadmapNodeAccessType = 'STUDENTS' | 'SELECTED' | 'PURCHASE'

export interface IRoadmapAccessEntry {
  roadmapId: string
  studentId: string
  grantedBy: RoadmapAccessGrant
  createdAt: string
  student: { id: string; name: string; avatarUrl: string | null; email: string }
}

export interface IRoadmapAccessCheck {
  hasAccess: boolean
  grantedBy?: RoadmapAccessGrant | 'owner'
}

export interface IRoadmapQuery {
  page?: number
  limit?: number
  teacherId?: string
  search?: string
  minPrice?: number
  maxPrice?: number
  minRating?: number
  lang?: string
}

export interface IRoadmapComment {
  id: string
  roadmapId: string
  authorId: string
  authorRole: string
  text: string
  imageUrls: string[]
  createdAt: string
  editedAt: string | null
  author?: { id: string; name: string; avatarUrl: string | null } | null
  userStars?: number | null
}

export interface IRoadmapCommentsResponse {
  comments: IRoadmapComment[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface IRoadmapRatingData {
  avgRating: number
  totalRatings: number
  userRating: number | null
}

export interface IRoadmapItem {
  id: string
  title: string
  description?: string | null
  price: number
  previewImageUrl: string | null
  mediaPreviewUrls: string[]
  avgRating: number
  createdAt: string
  updatedAt: string
  nodeAccessType: RoadmapNodeAccessType | null
  originalLanguage?: string | null
  teacher: { id: string; name: string; avatarUrl: string | null }
  _count: { comments: number; ratings: number }
}

export interface IRoadmapsResponse {
  roadmaps: IRoadmapItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const RoadmapService = {
  async getList(query: IRoadmapQuery = {}): Promise<IRoadmapsResponse> {
    const params = new URLSearchParams()
    if (query.page) params.set('page', String(query.page))
    if (query.limit) params.set('limit', String(query.limit))
    if (query.teacherId) params.set('teacherId', query.teacherId)
    if (query.search) params.set('search', query.search)
    if (query.minPrice !== undefined) params.set('minPrice', String(query.minPrice))
    if (query.maxPrice !== undefined) params.set('maxPrice', String(query.maxPrice))
    if (query.minRating !== undefined) params.set('minRating', String(query.minRating))
    if (query.lang) params.set('lang', query.lang)
    const res = await instance.get<IRoadmapsResponse>(`/roadmap?${params.toString()}`)
    return res.data
  },

  async getById(id: string, lang?: string): Promise<IRoadmapItem & { content: unknown }> {
    try {
      const params = lang ? `?lang=${lang}` : ''
      const res = await instance.get<IRoadmapItem & { content: unknown }>(`/roadmap/${id}${params}`)
      return res.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to fetch roadmap')
      }
      throw error
    }
  },

  async purchaseAccess(roadmapId: string): Promise<{ success: boolean }> {
    try {
      const res = await instance.post<{ success: boolean }>(`/roadmap/${roadmapId}/purchase`)
      return res.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to purchase access')
      }
      throw error
    }
  },

  async create(dto: {
    title: string
    content: unknown
    price?: number
    previewImageUrl?: string | null
    nodeAccessType?: RoadmapNodeAccessType | null
    currency?: string
  }): Promise<IRoadmapItem> {
    try {
      const res = await instance.post<IRoadmapItem>('/roadmap', {
        ...dto,
        nodeAccessType: dto.nodeAccessType ?? null,
      })
      return res.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to create roadmap')
      }
      throw error
    }
  },

  async update(
    id: string,
    dto: { title?: string; content?: unknown; price?: number; previewImageUrl?: string | null; nodeAccessType?: RoadmapNodeAccessType | null; currency?: string }
  ): Promise<IRoadmapItem> {
    try {
      const res = await instance.patch<IRoadmapItem>(`/roadmap/${id}`, dto)
      return res.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to update roadmap')
      }
      throw error
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await instance.delete(`/roadmap/${id}`)
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to delete roadmap')
      }
      throw error
    }
  },

  async getComments(roadmapId: string, page = 1, limit = 10): Promise<IRoadmapCommentsResponse> {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      const res = await instance.get<IRoadmapCommentsResponse>(`/roadmap/${roadmapId}/comments?${params}`)
      return res.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to fetch comments')
      }
      throw error
    }
  },

  async getMyComment(roadmapId: string): Promise<IRoadmapComment | null> {
    try {
      const res = await instance.get<IRoadmapComment>(`/roadmap/${roadmapId}/comments/my`)
      return res.data
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) return null
      if (error instanceof AxiosError && error.response?.status === 401) return null
      throw error
    }
  },

  async createOrUpdateComment(
    roadmapId: string,
    dto: { text: string; imageUrls: string[] }
  ): Promise<IRoadmapComment> {
    try {
      const res = await instance.post<IRoadmapComment>(`/roadmap/${roadmapId}/comments`, dto)
      return res.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to save comment')
      }
      throw error
    }
  },

  async getRating(roadmapId: string): Promise<IRoadmapRatingData> {
    try {
      const res = await instance.get<IRoadmapRatingData>(`/roadmap/${roadmapId}/rating`)
      return res.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to fetch rating')
      }
      throw error
    }
  },

  async setRating(roadmapId: string, stars: number): Promise<IRoadmapRatingData> {
    try {
      const res = await instance.post<IRoadmapRatingData>(`/roadmap/${roadmapId}/rating`, { stars })
      return res.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to set rating')
      }
      throw error
    }
  },

  async checkAccess(roadmapId: string): Promise<IRoadmapAccessCheck> {
    try {
      const res = await instance.get<IRoadmapAccessCheck>(`/roadmap/${roadmapId}/access`)
      return res.data
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 401) {
        return { hasAccess: false }
      }
      throw error
    }
  },

  async grantAccess(
    roadmapId: string,
    studentId: string,
    grantedBy: RoadmapAccessGrant = 'TEACHER'
  ): Promise<IRoadmapAccessEntry> {
    try {
      const res = await instance.post<IRoadmapAccessEntry>(`/roadmap/${roadmapId}/access`, {
        studentId,
        grantedBy,
      })
      return res.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to grant access')
      }
      throw error
    }
  },

  async revokeAccess(roadmapId: string, studentId: string): Promise<void> {
    try {
      await instance.delete(`/roadmap/${roadmapId}/access/${studentId}`)
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to revoke access')
      }
      throw error
    }
  },

  async getAccessList(roadmapId: string): Promise<IRoadmapAccessEntry[]> {
    try {
      const res = await instance.get<IRoadmapAccessEntry[]>(`/roadmap/${roadmapId}/access/list`)
      return res.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to fetch access list')
      }
      throw error
    }
  },
}

export default RoadmapService
