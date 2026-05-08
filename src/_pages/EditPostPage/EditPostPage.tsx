'use client'

import {useActions} from '@/features/hooks/store/useActions'
import {useGetPost} from '@/features/hooks/Post/useGetPost'
import {PostBlock} from '@/shared/types/Post/Post.type'
import CreatePostPage from '@/_pages/CreatePostPage/CreatePostPage'
import {useEffect, useRef} from 'react'

function EditPostPage({id}: {id: string}) {
  const {data: post, isLoading, error} = useGetPost(id)
  const {initPostConstructor, resetPostConstructor} = useActions()
  const initialized = useRef(false)

  useEffect(() => {
    if (!post || initialized.current) return
    initialized.current = true
    initPostConstructor({
      title: post.title,
      visibility: post.visibility as 'PUBLIC' | 'PRIVATE',
      categoryIds: post.categoryId ? [post.categoryId] : [],
      blocks: (post.content?.blocks ?? []) as PostBlock[]
    })
  }, [post, initPostConstructor])

  useEffect(() => {
    return () => {
      resetPostConstructor()
    }
  }, [resetPostConstructor])

  if (isLoading) return <p style={{padding: 24}}>Загрузка...</p>
  if (error) return <p style={{padding: 24, color: 'red'}}>Ошибка загрузки поста</p>
  if (!post) return null

  return <CreatePostPage id={id} />
}

export default EditPostPage
