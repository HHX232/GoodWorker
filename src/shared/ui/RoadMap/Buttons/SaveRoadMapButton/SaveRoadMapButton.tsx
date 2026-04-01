/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import {roadMapStorage} from '@/widgets/Tasks/Storage/roadMapStorage'
import {useReactFlow} from '@xyflow/react'
import {useRouter} from 'next/navigation'
import {useState} from 'react'
import {toast} from 'sonner'

export function SaveRoadMapButton() {
  const {getNodes, getEdges} = useReactFlow()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    setSaving(true)
    try {
      const map = roadMapStorage.create()
      roadMapStorage.update(map.id, {
        nodes: getNodes() as any,
        edges: getEdges()
      })
      toast.success('Road map сохранён')
      router.push(`/road-map/${map.id}`)
    } catch {
      toast.error('Ошибка при сохранении')
      setSaving(false)
    }
  }

  return (
    <button onClick={handleSave} disabled={saving}>
      {saving ? 'Сохраняем...' : 'Сохранить'}
    </button>
  )
}
