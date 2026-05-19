// features/hooks/Test/useSaveTest.ts
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import instance from '@/shared/api'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {useRouter} from 'next/navigation'
import {useState} from 'react'
import {toast} from 'sonner'

export function useSaveTest(existingId?: string) {
  const {blocks, title, theme, description, categoryIds} = useTypedSelector((s) => s.tasks)
  const {resetConstructor} = useActions()
  const [invalidBlockIds, setInvalidBlockIds] = useState<Set<string>>(new Set())
  const [errorsMap, setErrorsMap] = useState<Map<string, string>>(new Map())
  const router = useRouter()
  const queryClient = useQueryClient()

  const clearInvalidBlock = (id: string) =>
    setInvalidBlockIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {title, theme, description, blocks, categoryIds}
      const {data} = existingId
        ? await instance.patch<{id: string}>(`/tests/${existingId}`, payload)
        : await instance.post<{id: string}>('/tests', payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({queryKey: ['tests', 'mine']})
      resetConstructor()
      router.push(`/test/${data.id || existingId}`)
      toast.success(existingId ? 'Тест обновлён!' : 'Тест создан!')
    },
    onError: () => {
      toast.error('Не удалось сохранить тест')
    },
  })

  const save = () => {
    if (!title.trim()) {
      setErrorsMap(new Map([['title', 'Введите название теста']]))
      return
    }
    setErrorsMap(new Map())
    mutation.mutate()
  }

  const status: 'idle' | 'saving' | 'saved' | 'error' =
    mutation.status === 'pending'
      ? 'saving'
      : mutation.status === 'success'
        ? 'saved'
        : mutation.status === 'error'
          ? 'error'
          : 'idle'

  return {save, status, invalidBlockIds, errorsMap, clearInvalidBlock}
}
