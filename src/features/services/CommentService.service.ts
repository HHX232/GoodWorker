import instance from '@/shared/api'
import {AxiosError} from 'axios'

export interface ICommentAuthor {
  id: string
  name: string
  avatarUrl: string | null
}

export interface ICommentResponse {
  id: string
  postId: string
  authorId: string
  authorRole: 'STUDENT' | 'TEACHER' | 'ADMIN'
  author: ICommentAuthor | null
  text: string
  imageUrls: string[]
  editedAt: string | null
  createdAt: string
  stars?: number | null
}

export interface ICommentsListResponse {
  comments: ICommentResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface IRatingResponse {
  averageStars: number
  totalRatings: number
  userRating: number | null
}

function handleError(error: unknown, fallback: string): never {
  if (error instanceof AxiosError) throw new Error(error.response?.data?.error || fallback)
  throw error
}

export interface ICreateCommentDto {
  text: string
  /** Optional image files — sent as multipart/form-data */
  images?: File[]
}

export interface IUpdateCommentDto {
  text?: string
  images?: File[]
   keepImageUrls?: string[]
}

const CommentService = {
  async getList(postId: string, query: {page?: number; limit?: number; lang?: string} = {}): Promise<ICommentsListResponse> {
    try {
      const params = new URLSearchParams()
      if (query.page) params.set('page', String(query.page))
      if (query.limit) params.set('limit', String(query.limit))
      if (query.lang) params.set('lang', query.lang)
      const res = await instance.get<ICommentsListResponse>(`/post/${postId}/comments?${params.toString()}`)
      return res.data
    } catch (error) {
      handleError(error, 'Failed to fetch comments')
    }
  },

  async create(postId: string, dto: ICreateCommentDto): Promise<ICommentResponse> {
    try {
      const form = new FormData()
      form.append('text', dto.text)
      dto.images?.forEach((file) => form.append('images', file))

      const res = await instance.post<ICommentResponse>(`/post/${postId}/comments`, form, {
        headers: {'Content-Type': 'multipart/form-data'}
      })
      return res.data
    } catch (error) {
      handleError(error, 'Failed to create comment')
    }
  },

    async update(postId: string, commentId: string, dto: IUpdateCommentDto): Promise<ICommentResponse> {
      try {
        const form = new FormData()
        if (dto.text !== undefined) form.append('text', dto.text)
        dto.images?.forEach((file) => form.append('images', file))
        dto.keepImageUrls?.forEach((url) => form.append('keepImageUrls', url))
        const res = await instance.patch<ICommentResponse>(`/post/${postId}/comments/${commentId}`, form, {
          headers: {'Content-Type': 'multipart/form-data'}
        })
        return res.data
      } catch (error) {
        handleError(error, 'Failed to update comment')
      }
    },

  async delete(postId: string, commentId: string): Promise<void> {
    try {
      await instance.delete(`/post/${postId}/comments/${commentId}`)
    } catch (error) {
      handleError(error, 'Failed to delete comment')
    }
  },

  async getRating(postId: string): Promise<IRatingResponse> {
    try {
      const res = await instance.get<IRatingResponse>(`/post/${postId}/rating`)
      return res.data
    } catch (error) {
      handleError(error, 'Failed to fetch rating')
    }
  },

  async ratePost(postId: string, stars: number): Promise<IRatingResponse> {
    try {
      const res = await instance.post<IRatingResponse>(`/post/${postId}/rating`, {stars})
      return res.data
    } catch (error) {
      handleError(error, 'Failed to rate post')
    }
  },

  async getMyComment(postId: string, lang?: string): Promise<ICommentResponse | null> {
    try {
      const params = lang ? `?lang=${lang}` : ''
      const res = await instance.get<ICommentResponse>(`/post/${postId}/comments/my${params}`)
      return res.data
    } catch (error) {
      if (error instanceof AxiosError && (error.response?.status === 404 || error.response?.status === 401)) {
        return null
      }
      handleError(error, 'Failed to fetch my comment')
    }
  }
}

export default CommentService
