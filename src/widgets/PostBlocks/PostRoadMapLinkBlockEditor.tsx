'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchIcon, XIcon, MapIcon } from 'lucide-react'
import { useActions } from '@/features/hooks/store/useActions'
import MeService from '@/features/services/me.service'
import RoadmapService from '@/features/services/RoadmapService.service'
import { PostRoadMapLinkPayload } from '@/shared/types/Post/Post.type'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import styles from './PostBlockEditors.module.scss'

interface Props { blockId: string; payload: PostRoadMapLinkPayload }

export function PostRoadMapLinkBlockEditor({ blockId, payload }: Props) {
  const { updatePostBlockPayload } = useActions()
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => MeService.getMe(),
    staleTime: 1000 * 60 * 5,
  })

  const { data: rmData, isLoading } = useQuery({
    queryKey: ['my-roadmaps-for-hw', me?.id],
    queryFn: () => RoadmapService.getList({ teacherId: me!.id, limit: 100 }),
    enabled: !!me?.id && modalOpen,
    staleTime: 1000 * 30,
  })

  const allRm = rmData?.roadmaps ?? []
  const filtered = useMemo(() => {
    if (!search.trim()) return allRm
    const q = search.toLowerCase()
    return allRm.filter(r => (r.title ?? '').toLowerCase().includes(q))
  }, [allRm, search])

  const select = (rm: { id: string; title?: string }) => {
    updatePostBlockPayload({
      id: blockId,
      payload: { roadmapId: rm.id, roadmapTitle: rm.title ?? rm.id },
    })
    setModalOpen(false)
  }

  const clear = () => updatePostBlockPayload({ id: blockId, payload: { roadmapId: '', roadmapTitle: '' } })

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    setModalOpen(false)
  }

  return (
    <>
      {payload.roadmapId ? (
        <div className={styles.test_link_selected}>
          <div className={styles.test_link_row}>
            <div className={styles.post_link_card}>
              <MapIcon size={16} className={styles.post_link_icon} />
              <span className={styles.post_link_title}>{payload.roadmapTitle || payload.roadmapId}</span>
            </div>
            <button type="button" className={styles.test_link_clear} onClick={clear}>
              <XIcon size={12} /> Изменить
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.test_link_stub} onClick={() => setModalOpen(true)}>
          <span className={styles.stub_icon}><MapIcon size={18} /></span>
          <div>
            <p className={styles.stub_text}>Выбрать курс</p>
            <p className={styles.stub_sub}>Отображает прогресс студента по курсу</p>
          </div>
        </button>
      )}

      <ModalWindowDefault
        isOpen={modalOpen}
        onClose={handleClose}
        additionalTitle={<p className={styles.modal_title}>Выбрать курс</p>}
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
        {!isLoading && filtered.length === 0 && <p className={styles.modal_hint}>Нет курсов</p>}
        <div className={styles.post_link_list}>
          {filtered.map(r => (
            <button key={r.id} type="button" className={styles.post_link_list_item} onClick={() => select(r)}>
              <MapIcon size={15} />
              <span>{r.title ?? r.id}</span>
            </button>
          ))}
        </div>
        <button type="button" className={styles.modal_done_btn} onClick={handleClose}>Закрыть</button>
      </ModalWindowDefault>
    </>
  )
}
