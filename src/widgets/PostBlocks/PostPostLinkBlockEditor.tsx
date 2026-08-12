'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchIcon, XIcon, FileTextIcon } from 'lucide-react'
import { useActions } from '@/features/hooks/store/useActions'
import MeService from '@/features/services/me.service'
import PostService from '@/features/services/PostService.service'
import { PostPostLinkPayload } from '@/shared/types/Post/Post.type'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import styles from './PostBlockEditors.module.scss'

interface Props { blockId: string; payload: PostPostLinkPayload }

export function PostPostLinkBlockEditor({ blockId, payload }: Props) {
  const { updatePostBlockPayload } = useActions()
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => MeService.getMe(),
    staleTime: 1000 * 60 * 5,
  })

  const { data: postsData, isLoading } = useQuery({
    queryKey: ['my-posts-for-hw', me?.id],
    queryFn: () => PostService.getList({ teacherId: me!.id, limit: 100 }),
    enabled: !!me?.id && modalOpen,
    staleTime: 1000 * 30,
  })

  const allPosts = postsData?.posts ?? []
  const filtered = useMemo(() => {
    if (!search.trim()) return allPosts
    const q = search.toLowerCase()
    return allPosts.filter(p => p.title.toLowerCase().includes(q))
  }, [allPosts, search])

  const select = (post: { id: string; title: string; slug?: string | null }) => {
    updatePostBlockPayload({
      id: blockId,
      payload: { postId: post.id, postTitle: post.title, postSlug: post.slug ?? null },
    })
    setModalOpen(false)
  }

  const clear = () => updatePostBlockPayload({ id: blockId, payload: { postId: '', postTitle: '' } })

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    setModalOpen(false)
  }

  return (
    <>
      {payload.postId ? (
        <div className={styles.test_link_selected}>
          <div className={styles.test_link_row}>
            <div className={styles.post_link_card}>
              <FileTextIcon size={16} className={styles.post_link_icon} />
              <span className={styles.post_link_title}>{payload.postTitle || payload.postId}</span>
            </div>
            <button type="button" className={styles.test_link_clear} onClick={clear}>
              <XIcon size={12} /> Изменить
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.test_link_stub} onClick={() => setModalOpen(true)}>
          <span className={styles.stub_icon}><FileTextIcon size={18} /></span>
          <div>
            <p className={styles.stub_text}>Выбрать пост</p>
            <p className={styles.stub_sub}>Студент прочитает пост и отметит блок выполненным</p>
          </div>
        </button>
      )}

      <ModalWindowDefault
        isOpen={modalOpen}
        onClose={handleClose}
        additionalTitle={<p className={styles.modal_title}>Выбрать пост</p>}
      >
        <div className={styles.modal_search_wrap}>
          <SearchIcon size={14} className={styles.modal_search_icon} />
          <input
            className={styles.modal_search_input}
            placeholder="Поиск по названию..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {isLoading && <p className={styles.modal_hint}>Загрузка...</p>}
        {!isLoading && filtered.length === 0 && <p className={styles.modal_hint}>Нет постов</p>}
        <div className={styles.post_link_list}>
          {filtered.map(p => (
            <button key={p.id} type="button" className={styles.post_link_list_item} onClick={() => select(p)}>
              <FileTextIcon size={15} />
              <span>{p.title}</span>
            </button>
          ))}
        </div>
        <button type="button" className={styles.modal_done_btn} onClick={handleClose}>Закрыть</button>
      </ModalWindowDefault>
    </>
  )
}
