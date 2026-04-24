import {PostBlock} from '@/entities/store/slices/post.slice'
import instance from '@/shared/api'
import {AxiosError} from 'axios'

// ── Types ────────────────────────────────────────────────────

export interface ICreatePostDto {
  title: string
  visibility: 'PUBLIC' | 'PRIVATE'
  categoryIds: string[]
  content: {
    blocks: PostBlock[]
  }
}

export interface IPostResponse {
  id: string
  title: string
  visibility: 'PUBLIC' | 'PRIVATE'
  content: {blocks: PostBlock[]}
  createdAt: string
  updatedAt: string
  teacherId: string
  categoryId: string | null
}

// ── Service ──────────────────────────────────────────────────

const PostService = {
  async create(dto: ICreatePostDto): Promise<IPostResponse> {
    try {
      const response = await instance.post<IPostResponse>('/posts', dto)
      return response.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to create post')
      }
      throw error
    }
  },

  async update(postId: string, dto: Partial<ICreatePostDto>): Promise<IPostResponse> {
    try {
      const response = await instance.patch<IPostResponse>(`/posts/${postId}`, dto)
      return response.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to update post')
      }
      throw error
    }
  },

  async getById(postId: string): Promise<IPostResponse> {
    try {
      const response = await instance.get<IPostResponse>(`/posts/${postId}`)
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
      await instance.delete(`/posts/${postId}`)
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to delete post')
      }
      throw error
    }
  }
}

export default PostService
