import instance from '@/shared/api'
import { AxiosError } from 'axios'

export interface IBookmark {
  id: string
  sourceType: string
  sourceId: string
  text: string
  xpath: string
  offset: number
  length: number
  contextText:string
  createdAt: string
}

export interface ICreateBookmarkDto {
  sourceType: 'post' | 'text' | 'roadmap'
  sourceId: string
  text: string
  xpath: string
  offset: number
  length: number
}

function handleError(error: unknown, fallback: string): never {
  if (error instanceof AxiosError) throw new Error(error.response?.data?.error || fallback)
  throw error
}

const BookmarkService = {
  async getList(sourceType: string, sourceId: string): Promise<IBookmark[]> {
    try {
      const res = await instance.get<IBookmark[]>(`/bookmarks`, {
        params: { sourceType, sourceId }
      })
      return res.data
    } catch (error) {
      handleError(error, 'Failed to fetch bookmarks')
    }
  },

  async create(dto: ICreateBookmarkDto): Promise<IBookmark> {
    try {
      const res = await instance.post<IBookmark>(`/bookmarks`, dto)
      return res.data
    } catch (error) {
      handleError(error, 'Failed to create bookmark')
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await instance.delete(`/bookmarks/${id}`)
    } catch (error) {
      handleError(error, 'Failed to delete bookmark')
    }
  }
}

export default BookmarkService