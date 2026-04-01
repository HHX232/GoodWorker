import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {testStorage} from '@/widgets/Tasks/Storage/testStorage'
import {useRouter} from 'next/navigation'
import {useState} from 'react'
import {toast} from 'sonner'
import {BlockValidationTestBlockError, validateTestBlocks} from './validateTestBlock'

export function useSaveTest(existingId?: string) {
  const router = useRouter()
  const {title, theme, description, blocks} = useTypedSelector((s) => s.tasks)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [invalidBlockIds, setInvalidBlockIds] = useState<Set<string>>(new Set())
  const [errorsMap, setErrorsMap] = useState<Map<string, string>>(new Map())

  const clearInvalidBlock = (blockId: string) => {
    setInvalidBlockIds((prev) => {
      const next = new Set(prev)
      next.delete(blockId)
      return next
    })
    setErrorsMap((prev) => {
      const next = new Map(prev)
      next.delete(blockId)
      return next
    })
  }

  const save = async () => {
    if (!title.trim()) {
      toast.error('Введите название теста')
      return
    }

    if (blocks.length === 0) {
      toast.error('Добавьте хотя бы один блок')
      return
    }

    const errors: BlockValidationTestBlockError[] = validateTestBlocks(blocks)
    if (errors.length > 0) {
      const newIds = new Set(errors.map((e) => e.blockId))
      const newMap = new Map(errors.map((e) => [e.blockId, e.message]))
      setInvalidBlockIds(newIds)
      setErrorsMap(newMap)

      toast.error(`${errors.length} ${errors.length === 1 ? 'блок не заполнен' : 'блока не заполнены'}`, {
        description: errors[0].message
      })

      document.getElementById(`block-${errors[0].blockId}`)?.scrollIntoView({behavior: 'smooth', block: 'center'})
      return
    }

    setInvalidBlockIds(new Set())
    setErrorsMap(new Map())
    setStatus('saving')

    try {
      if (existingId) {
        testStorage.update(existingId, {title, theme, description, blocks})
      } else {
        const saved = testStorage.save({title, theme, description, blocks})
        router.replace(`/create-test?id=${saved.id}`)
      }
      setStatus('saved')
      toast.success('Тест сохранён')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
      toast.error('Ошибка при сохранении')
    }
  }

  return {save, status, invalidBlockIds, errorsMap, clearInvalidBlock}
}
