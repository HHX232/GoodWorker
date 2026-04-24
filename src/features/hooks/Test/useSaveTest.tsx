// features/hooks/Test/useSaveTest.ts
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import instance from '@/shared/api'
import {useRouter} from 'next/navigation'
import {useState} from 'react'

export function useSaveTest(existingId?: string) {
  const {blocks, title, theme, description, categoryIds} = useTypedSelector((s) => s.tasks)
  const {resetConstructor} = useActions()
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [invalidBlockIds, setInvalidBlockIds] = useState<Set<string>>(new Set())
  const [errorsMap, setErrorsMap] = useState<Map<string, string>>(new Map())
  const router = useRouter()

  const clearInvalidBlock = (id: string) =>
    setInvalidBlockIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  const save = async () => {
    if (!title.trim()) {
      setErrorsMap(new Map([['title', 'Введите название теста']]))
      return
    }

    setStatus('saving')
    try {
      const payload = {title, theme, description, blocks, categoryIds}

      const {data} = existingId
        ? await instance.patch<{id: string}>(`/tests/${existingId}`, payload)
        : await instance.post<{id: string}>('/tests', payload)

      setStatus('saved')
      resetConstructor()
      router.push(`/test/${data.id}`)
    } catch {
      setStatus('error')
    }
  }

  return {save, status, invalidBlockIds, errorsMap, clearInvalidBlock}
}
