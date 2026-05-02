import BookmarkService, { IBookmark } from '@/features/services/Bookmark/bookmark.service'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

export function useBookmarks(sourceType: 'post' | 'text' | 'roadmap', sourceId: string) {
  const [bookmarks, setBookmarks] = useState<IBookmark[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const data = await BookmarkService.getList(sourceType, sourceId)
      setBookmarks(data)
    } catch {
      // тихо — не мешаем основному контенту
    } finally {
      setLoading(false)
    }
  }, [sourceType, sourceId])

  useEffect(() => { fetch() }, [fetch])

  const save = useCallback(async (dto: Omit<IBookmark, 'id' | 'sourceType' | 'sourceId' | 'createdAt'>) => {
    try {
      const bookmark = await BookmarkService.create({ sourceType, sourceId, ...dto })
      setBookmarks(prev => [...prev, bookmark])
      toast.success('Закладка сохранена')
      return bookmark
    } catch {
      toast.error('Не удалось сохранить закладку')
      return null
    }
  }, [sourceType, sourceId])

  const remove = useCallback(async (id: string) => {
    try {
      await BookmarkService.delete(id)
      setBookmarks(prev => prev.filter(b => b.id !== id))
      toast.success('Закладка удалена')
    } catch {
      toast.error('Не удалось удалить закладку')
    }
  }, [])

  return { bookmarks, loading, save, remove }
}