import instance from '@/shared/api'
import {PostBlock} from '@/shared/types/Post/Post.type'
import {AxiosError} from 'axios'

export interface ICreatePostDto {
  title: string
  visibility: 'PUBLIC' | 'PRIVATE'
  categoryIds: string[]
  content: {
    blocks: PostBlock[]
  }
}
export interface IPostsQuery {
  page?: number
  limit?: number
  categoryId?: string
  teacherId?: string
  visibility?: 'PUBLIC' | 'PRIVATE' | 'any'
  search?: string
  onlyVip?: boolean
  lang?: string
}

export interface IPostsResponse {
  posts: IPostResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface IPostResponse {
  id: string
  title: string
  additionalTitle?: string | null
  visibility: 'PUBLIC' | 'PRIVATE'
  content: {blocks: PostBlock[]} | null
  mediaUrls: string[]
  createdAt: string
  updatedAt: string
  teacherId: string
  categoryId: string | null
  isVip: boolean
  vipExpiresAt?: string | null
  originalLang?: string | null
  teacher: {
    id: string
    name: string
    avatarUrl: string | null
  }
  category: {
    id: string
    slug: string
    translations: {langCode: string; name: string}[]
  } | null
  viewCount: number
  avgRating: number
  _count: {
    comments: number
  }
}
const PostService = {
  async create(dto: ICreatePostDto): Promise<IPostResponse> {
    try {
      const response = await instance.post<IPostResponse>('/post', dto)
      return response.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to create post')
      }
      throw error
    }
  },
  async getList(query: IPostsQuery = {}): Promise<IPostsResponse> {
    const params = new URLSearchParams()
    if (query.page) params.set('page', String(query.page))
    if (query.limit) params.set('limit', String(query.limit))
    if (query.categoryId) params.set('categoryId', query.categoryId)
    if (query.teacherId) params.set('teacherId', query.teacherId)
    if (query.visibility && query.visibility !== 'any') params.set('visibility', query.visibility)
    if (query.search) params.set('search', query.search)
    if (query.onlyVip) params.set('onlyVip', 'true')
    if (query.lang) params.set('lang', query.lang)
    const response = await instance.get<IPostsResponse>(`/posts?${params.toString()}`)
    return response.data
  },

  async update(postId: string, dto: Partial<ICreatePostDto>): Promise<IPostResponse> {
    try {
      const response = await instance.patch<IPostResponse>(`/post/${postId}`, dto)
      return response.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to update post')
      }
      throw error
    }
  },

  async getById(postId: string, lang?: string): Promise<IPostResponse> {
    try {
      const params = lang ? `?lang=${lang}` : ''
      const response = await instance.get<IPostResponse>(`/post/${postId}${params}`)
      return response.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to fetch post')
      }
      throw error
    }
  },

  async delete(postId: string): Promise<void> {
    try {
      await instance.delete(`/post/${postId}`)
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to delete post')
      }
      throw error
    }
  }
}

export default PostService
