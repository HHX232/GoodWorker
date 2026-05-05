import BookmarkService, { IBookmark } from '@/features/services/Bookmark/bookmark.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

type CreateDto = Omit<IBookmark, 'id' | 'sourceType' | 'sourceId' | 'createdAt'>

export function bookmarksKey(sourceType: string, sourceId: string) {
  return ['bookmarks', sourceType, sourceId] as const
}

export function useBookmarks(sourceType: 'post' | 'text' | 'roadmap', sourceId: string) {
  const queryClient = useQueryClient()
  const key = bookmarksKey(sourceType, sourceId)

  const { data: bookmarks = [], isLoading: loading } = useQuery({
    queryKey: key,
    queryFn: () => BookmarkService.getList(sourceType, sourceId),
    staleTime: 60_000,
    enabled: !!sourceId,
  })

  const saveMutation = useMutation({
    mutationFn: (dto: CreateDto) =>
      BookmarkService.create({ sourceType, sourceId, ...dto }),
    onSuccess: (newBookmark) => {
      queryClient.setQueryData<IBookmark[]>(key, (old = []) => [...old, newBookmark])
      toast.success('Закладка сохранена')
    },
    onError: () => {
      toast.error('Не удалось сохранить закладку')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => BookmarkService.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<IBookmark[]>(key)
      queryClient.setQueryData<IBookmark[]>(key, (old = []) => old.filter((b) => b.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error('Не удалось удалить закладку')
    },
    onSuccess: () => {
      toast.success('Закладка удалена')
    },
  })

  return {
    bookmarks,
    loading,
    save: (dto: CreateDto) => saveMutation.mutateAsync(dto),
    remove: (id: string) => removeMutation.mutate(id),
  }
}
