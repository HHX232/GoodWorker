// src/shared/hooks/useInfiniteComments.ts
import CommentService, { ICommentResponse } from '@/features/services/CommentService.service'
import { CommentItem } from '@/shared/ui/Posts/PostCommentSection/PostCommentSection'
import { useCallback, useEffect, useRef, useState } from 'react'

function commentToUI(c: ICommentResponse): CommentItem {
  return {
    id: c.id,
    user: {
      cardID: c.id,
      userID: c.authorId,
      name: c.author?.name ?? 'Unknown',
      role: c.authorRole === 'TEACHER' ? 'Admin' : 'Member',
      image: c.author?.avatarUrl ?? '',
      dateActivity: new Date(c.createdAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}),
      BlurDots: c.authorRole === 'TEACHER'
    },
    commentText: c.text,
    images: c.imageUrls ?? []
  }
}

export function useInfiniteComments(postId: string, limit = 15) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const loadPage = useCallback(async (pageNum: number) => {
    setLoading(true)
    try {
      const res = await CommentService.getList(postId, {page: pageNum, limit})
      setComments((prev) =>
        pageNum === 1 ? res.comments.map(commentToUI) : [...prev, ...res.comments.map(commentToUI)]
      )
      setTotal(res.pagination.total)
      setHasMore(pageNum < res.pagination.totalPages)
    } finally {
      setLoading(false)
    }
  }, [postId, limit])

  // Загрузка первой страницы
  useEffect(() => {
    setComments([])
    setPage(1)
    setHasMore(true)
    loadPage(1)
  }, [postId, loadPage])

  // IntersectionObserver для подгрузки
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((p) => {
            const next = p + 1
            loadPage(next)
            return next
          })
        }
      },
      {threshold: 0.1}
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadPage])

  const addComment = useCallback((c: CommentItem) => {
    setComments((prev) => [c, ...prev])
    setTotal((t) => t + 1)
  }, [])

  const updateComment = useCallback((updated: CommentItem) => {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }, [])

  const deleteComment = useCallback((id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
    setTotal((t) => Math.max(0, t - 1))
  }, [])

  return {comments, total, loading, hasMore, sentinelRef, addComment, updateComment, deleteComment}
}