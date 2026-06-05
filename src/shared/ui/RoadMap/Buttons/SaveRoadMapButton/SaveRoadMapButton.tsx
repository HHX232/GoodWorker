'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import {validateRoadMapNodes} from '@/features/helpers/validateRoadMapNodes'
import RoadmapService, {RoadmapNodeAccessType} from '@/features/services/RoadmapService.service'
import {RoadMapBlockType, RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {PublishModal} from '@/shared/ui/RoadMap/PublishModal/PublishModal'
import {Edge, Node, useReactFlow} from '@xyflow/react'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useState} from 'react'
import {toast} from 'sonner'
import styles from './SaveRoadMapButton.module.scss'

interface ValidatedDraft {
  nodes: Node<RoadNodeData>[]
  edges: Edge[]
  title: string
  previewImageUrl: string | null
  hasPaywalledNodes: boolean
}

interface Props {
  editId?: string
}

export function SaveRoadMapButton({ editId }: Props) {
  const t = useTranslations('roadMap')
  const {getNodes, getEdges, updateNodeData, fitView} = useReactFlow()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [draft, setDraft] = useState<ValidatedDraft | null>(null)

  const handleValidate = () => {
    const nodes = getNodes() as Node<RoadNodeData>[]
    const edges = getEdges()

    nodes.forEach((n) => {
      if ((n.data as any).validationError) {
        updateNodeData(n.id, {validationError: null} as any)
      }
    })

    const errors = validateRoadMapNodes(nodes)

    if (errors.length > 0) {
      errors.forEach(({nodeId, message}) => {
        updateNodeData(nodeId, {validationError: message} as any)
      })
      const firstNode = nodes.find((n) => n.id === errors[0].nodeId)
      if (firstNode) fitView({nodes: [firstNode], duration: 400, padding: 0.5})
      toast.error(t('validationErrors', {count: errors.length}), {description: errors[0].message})
      return
    }

    const entryNode = nodes.find((n) => n.data.type === RoadMapBlockType.ENTRY_POINT)
    const title = (entryNode?.data as any)?.roadTitle?.trim() ?? ''
    const previewImageUrl = (entryNode?.data as any)?.roadPreview ?? null
    const hasPaywalledNodes = nodes.some((n) => (n.data as any).isPaywallHidden === true)

    setDraft({nodes, edges, title, previewImageUrl, hasPaywalledNodes})
    setPublishOpen(true)
  }

  const handlePublish = async (price: number, nodeAccessType: RoadmapNodeAccessType | null, currency: string) => {
    if (!draft) return
    setSaving(true)
    const toastId = toast.loading(t('saving'))
    try {
      let roadmap
      if (editId) {
        roadmap = await RoadmapService.update(editId, {
          title: draft.title,
          content: {nodes: draft.nodes, edges: draft.edges},
          price,
          previewImageUrl: draft.previewImageUrl,
          nodeAccessType,
          currency,
        })
      } else {
        roadmap = await RoadmapService.create({
          title: draft.title,
          content: {nodes: draft.nodes, edges: draft.edges},
          price,
          previewImageUrl: draft.previewImageUrl,
          nodeAccessType,
          currency,
        })
      }
      toast.success(t('saveSuccess'), {id: toastId})
      router.push(`/road-map/${roadmap.id}`)
    } catch (err: any) {
      console.error('[SaveRoadMapButton]', err)
      const msg = err?.message === 'VIP_REQUIRED' ? t('vipRequired') : t('saveError')
      toast.error(msg, {id: toastId})
      setSaving(false)
    }
  }

  return (
    <>
      <button onClick={handleValidate} disabled={saving} className={styles.button}>
        {saving ? (
          <span className={styles.spinner} />
        ) : (
          <svg className={styles.icon} viewBox='0 0 16 16' fill='none'>
            <path
              d='M13 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1ZM5 2v4h6V2M5 9h6'
              stroke='currentColor'
              strokeWidth='1.3'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        )}
        {saving ? t('saving') : t('save')}
      </button>

      <PublishModal
        isOpen={publishOpen}
        onClose={() => setPublishOpen(false)}
        hasPaywalledNodes={draft?.hasPaywalledNodes ?? false}
        onConfirm={handlePublish}
      />
    </>
  )
}
