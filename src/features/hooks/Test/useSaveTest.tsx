import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import instance from '@/shared/api'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useState} from 'react'
import {toast} from 'sonner'

export function validateBlocks(blocks: TestBlock[]): Map<string, string> {
  const errors = new Map<string, string>()
  for (const block of blocks) {
    const p = block.payload as any
    switch (block.type) {
      case TaskBlockType.CHOOSE_OPTION:
        if (!p?.question?.trim()) { errors.set(block.id, 'Введите вопрос'); break }
        if (!p?.options?.length || p.options.length < 2) { errors.set(block.id, 'Добавьте минимум 2 варианта'); break }
        if (!p?.correctId) { errors.set(block.id, 'Отметьте правильный ответ'); break }
        break
      case TaskBlockType.FREE_ANSWER:
        if (!p?.question?.trim()) errors.set(block.id, 'Введите вопрос')
        break
      case TaskBlockType.FILL_TEXT:
        if (!p?.content) errors.set(block.id, 'Заполните текст с пропусками')
        break
      case TaskBlockType.HIGHLIGHT_TEXT:
        if (!p?.instruction || !p?.tokens) errors.set(block.id, 'Заполните текст для выделения')
        break
      case TaskBlockType.WORD_SCRAMBLE:
        if (!p?.source) errors.set(block.id, 'Добавьте слово или фразу')
        break
      case TaskBlockType.MATCH_PAIRS: {
        const pairs = p?.pairs ?? []
        if (pairs.length < 2) errors.set(block.id, 'Добавьте минимум 2 пары')
        break
      }
      case TaskBlockType.SEQUENCE: {
        const items = p?.items ?? []
        if (items.length < 2 || items.some((i: any) => !i?.text?.trim())) {
          errors.set(block.id, 'Добавьте минимум 2 элемента')
        }
        break
      }
      case TaskBlockType.DIALOGUE: {
        if (!p?.lines?.length || p.lines.length < 2) { errors.set(block.id, 'Добавьте минимум 2 реплики'); break }
        const hasEmptyLine = p.lines.some((l: any) => !l?.text?.trim())
        if (hasEmptyLine) errors.set(block.id, 'Заполните все реплики')
        break
      }
    }
  }
  return errors
}

export function useSaveTest(existingId?: string) {
  const t = useTranslations('CreateTestPage')
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
      toast.success(existingId ? t('successUpdated') : t('successCreated'))
    },
    onError: () => {
      toast.error(t('errorSaveFailed'))
    },
  })

  const save = () => {
    if (!title.trim()) {
      toast.error(t('errorTitleRequired'))
      return
    }
    if (blocks.length === 0) {
      toast.error(t('errorBlocksRequired'))
      return
    }

    const blockErrors = validateBlocks(blocks)
    if (blockErrors.size > 0) {
      setInvalidBlockIds(new Set(blockErrors.keys()))
      setErrorsMap(blockErrors)
      toast.error(t('errorBlocksInvalid'))
      // Scroll to first invalid block
      const firstId = blockErrors.keys().next().value
      if (firstId) {
        setTimeout(() => {
          document.getElementById(`block-${firstId}`)?.scrollIntoView({behavior: 'smooth', block: 'center'})
        }, 50)
      }
      return
    }

    setErrorsMap(new Map())
    setInvalidBlockIds(new Set())
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
