'use client'

import {TaskBlockRegistry} from '@/features'
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {validateBlocks} from '@/features/hooks/Test/useSaveTest'
import {PostMiniTestPayload} from '@/shared/types/Post/Post.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {InvalidTestBlocksContext} from '@/shared/ui/Tasks/providers/InvalidBlocksContext/InvalidBlocksContext'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import BlockEditor from '@/widgets/Tasks/BlockEditor/BlockEditor'
import {ClipboardCheckIcon, PencilIcon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {toast} from 'sonner'
import styles from './PostBlockEditors.module.scss'

const BLOCK_TYPES: TaskBlockType[] = [
  TaskBlockType.CHOOSE_OPTION,
  TaskBlockType.FREE_ANSWER,
  TaskBlockType.FILL_TEXT,
  TaskBlockType.SEQUENCE,
  TaskBlockType.MATCH_PAIRS,
  TaskBlockType.HIGHLIGHT_TEXT,
  TaskBlockType.WORD_SCRAMBLE,
  TaskBlockType.DIALOGUE,
  TaskBlockType.INFO_TEXT,
]

interface Props {
  blockId: string
  payload: PostMiniTestPayload
}

export function PostMiniTestBlockEditor({blockId, payload}: Props) {
  const t = useTranslations('PostBlockEditor')
  const {updatePostBlockPayload, addBlock, addBlocks, resetConstructor} = useActions()
  const reduxBlocks = useTypedSelector((state) => state.tasks.blocks)
  const [modalOpen, setModalOpen] = useState(false)
  const [invalidBlockIds, setInvalidBlockIds] = useState<Set<string>>(new Set())
  const [errorsMap, setErrorsMap] = useState<Map<string, string>>(new Map())

  const openModal = () => {
    resetConstructor()
    if (payload.blocks.length > 0) addBlocks(payload.blocks)
    setInvalidBlockIds(new Set())
    setErrorsMap(new Map())
    setModalOpen(true)
  }

  const clearInvalidBlock = (id: string) => {
    setInvalidBlockIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const save = () => {
    if (reduxBlocks.length === 0) {
      toast.error(t('miniTestAtLeastOne'))
      return
    }

    const blockErrors = validateBlocks(reduxBlocks)
    if (blockErrors.size > 0) {
      setInvalidBlockIds(new Set(blockErrors.keys()))
      setErrorsMap(blockErrors)
      toast.error(t('miniTestFillAll'))
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
    updatePostBlockPayload({id: blockId, payload: {...payload, blocks: [...reduxBlocks]}})
    setModalOpen(false)
  }

  const hasBlocks = payload.blocks.length > 0

  return (
    <>
      <div className={styles.mini_test_editor}>
        <div className={styles.mini_test_badge}>
          <ClipboardCheckIcon size={13} />
          <span>{t('miniTestLabel')}</span>
        </div>

        <input
          className={styles.mini_test_title_input}
          placeholder={t('miniTestTitlePlaceholder')}
          value={payload.title}
          onChange={(e) =>
            updatePostBlockPayload({id: blockId, payload: {...payload, title: e.target.value}})
          }
        />

        <div className={styles.mini_test_summary}>
          {hasBlocks ? (
            <div className={styles.mini_test_block_pills}>
              {payload.blocks.slice(0, 5).map((b) => {
                const meta = TaskBlockRegistry[b.type as TaskBlockType]
                return (
                  <span key={b.id} className={styles.mini_test_block_pill}>
                    {meta?.label}
                  </span>
                )
              })}
              {payload.blocks.length > 5 && (
                <span className={styles.mini_test_block_pill}>+{payload.blocks.length - 5}</span>
              )}
            </div>
          ) : (
            <p className={styles.mini_test_no_blocks}>{t('miniTestNoBlocks')}</p>
          )}
        </div>

        <button className={styles.mini_test_edit_btn} onClick={openModal}>
          <PencilIcon size={13} />
          {hasBlocks ? t('miniTestEditBtn', {count: payload.blocks.length}) : t('miniTestAddBtn')}
        </button>
      </div>

      <ModalWindowDefault
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        additionalTitle={<p className={styles.modal_title}>{t('miniTestModalTitle')}</p>}
      >
        <InvalidTestBlocksContext.Provider
          value={{ids: invalidBlockIds, errors: errorsMap, clear: clearInvalidBlock}}
        >
          <div className={styles.mini_test_type_picker}>
            {BLOCK_TYPES.map((type) => {
              const meta = TaskBlockRegistry[type]
              return (
                <button
                  key={type}
                  className={styles.mini_test_type_btn}
                  onClick={() => addBlock(type)}
                  title={meta.description}
                >
                  <span className={styles.mini_test_type_icon}>{meta.icon}</span>
                  <span className={styles.mini_test_type_label}>{meta.label}</span>
                </button>
              )
            })}
          </div>

          <div className={styles.mini_test_block_list}>
            {reduxBlocks.length === 0 ? (
              <p className={styles.mini_test_empty_hint}>{t('miniTestEmptyHint')}</p>
            ) : (
              reduxBlocks.map((block) => (
                <div key={block.id} className={styles.mini_test_block_item}>
                  <BlockEditor block={block} />
                </div>
              ))
            )}
          </div>

          <div className={styles.mini_test_modal_footer}>
            <button className={styles.mini_test_cancel_btn} onClick={() => setModalOpen(false)}>
              {t('miniTestCancel')}
            </button>
            <button className={styles.mini_test_save_btn} onClick={save}>
              {t('miniTestSave')}
            </button>
          </div>
        </InvalidTestBlocksContext.Provider>
      </ModalWindowDefault>
    </>
  )
}
