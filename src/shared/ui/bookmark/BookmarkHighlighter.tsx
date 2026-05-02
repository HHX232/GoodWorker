// features/Bookmarks/BookmarkHighlighter.tsx
'use client'

import { useBookmarks } from '@/features/hooks/Bookmark/useBookmarks'
import { highlightBookmark } from '@/shared/helpers/xpath/xpath'
import { useEffect } from 'react'

interface Props {
  postId: string
}

export function BookmarkHighlighter({postId}: Props) {
  const {bookmarks, remove} = useBookmarks('post', postId)

  useEffect(() => {
    if (!bookmarks.length) return
      console.log('bookmarks to highlight:', bookmarks.length)

    const timer = setTimeout(() => {
          console.log('starting highlight...')

      bookmarks.forEach((b) =>
       {
         const result = highlightBookmark(b)
          console.log('highlight result:', result, b.text)
         highlightBookmark({
          id: b.id,
          text: b.text,
          contextText: b.contextText,
          offset: b.offset,
          length: b.length
        })}
        
      )

      // Клик по закладке — удалить
      document.querySelectorAll<HTMLElement>('.bookmark-highlight').forEach((el) => {
        el.onclick = () => {
          const id = el.dataset.bookmarkId
          if (id && confirm('Удалить закладку?')) {
            remove(id)
            el.replaceWith(...Array.from(el.childNodes))
          }
        }
      })
    }, 1000)

    return () => clearTimeout(timer)
  }, [bookmarks, remove])

  return null
}
