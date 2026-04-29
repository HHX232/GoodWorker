/* eslint-disable @typescript-eslint/no-explicit-any */
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {InfoAudioEditor} from '@/features/BlockEditors/InfoAudioEditor/InfoAudioEditor'
import {InfoMediaEditor} from '@/features/BlockEditors/InfoMediaEditor/InfoMediaEditor'
import {InfoTextEditor} from '@/features/BlockEditors/InfoTextEditor/InfoTextEditor'
import {useActions} from '@/features/hooks/store/useActions'
import {InfoAudioPayload, InfoMediaPayload, InfoTextPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {useInvalidTestBlocks} from '@/shared/ui/Tasks/providers/InvalidBlocksContext/InvalidBlocksContext'
import {useTranslations} from 'next-intl'
import {useEffect} from 'react'
import styles from './BlockEditor.module.scss'
import ChooseOptionEditor from './ChooseOptionEditor/ChooseOptionEditor'
import {DialogueEditor} from './DialogueEditor/DialogueEditor'
import {FillTextEditor} from './FillTextEditor/FillTextEditor'
import FreeAnswerEditor from './FreeAnswerEditor/FreeAnswerEditor'
import {HighlightTextEditor} from './HighlightTextEditor/HighlightTextEditor'
import MatchPairsEditor from './MatchPairsEditor/MatchPairsEditor'
import SequenceEditor from './SequenceEditor/SequenceEditor'
import {WordScrambleEditor} from './WordScrambleEditor/WordScrambleEditor'

interface Props {
  block: TestBlock
}

const DeleteBlockButton = ({label, onDelete}: {label: string; onDelete: () => void}) => (
  <button
    style={{marginRight: 'auto', padding: '5px', borderRadius: '5px', backgroundColor: '#f3f3f3'}}
    onClick={onDelete}
  >
    {label}
  </button>
)

function BlockEditor({block}: Props) {
  const t = useTranslations('BlockEditor')
  const {removeBlock, updateBlockPayload} = useActions()
  const {ids: invalidBlockIds, clear: clearInvalidBlock, errors} = useInvalidTestBlocks()
  const isInvalid = invalidBlockIds.has(block.id)
  const error = errors.get(block.id) ?? null
  const deleteBtn = <DeleteBlockButton label={t('deleteBlock')} onDelete={() => removeBlock(block.id)} />

  const wrapper = (heading: string, children: React.ReactNode) => (
    <div id={`block-${block.id}`} className={`${styles.block_wrap} ${isInvalid ? styles.block_invalid : ''}`}>
      <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
        <h3 style={{marginTop: '15px', fontWeight: '500', fontSize: '32px'}}>{heading}</h3>
        {deleteBtn}
        {children}
      </div>
    </div>
  )

  useEffect(() => {
    if (isInvalid) clearInvalidBlock(block.id)
  }, [block.payload])

  switch (block?.type) {
    case TaskBlockType.FILL_TEXT:
      return wrapper(t('fillText'), <FillTextEditor error={error} blockId={block.id} payload={block.payload as any} />)
    case TaskBlockType.SEQUENCE:
      return wrapper(t('sequence'), <SequenceEditor blockId={block.id} payload={block.payload as any} />)
    case TaskBlockType.CHOOSE_OPTION:
      return wrapper(t('chooseOption'), <ChooseOptionEditor blockId={block.id} payload={block.payload as any} />)
    case TaskBlockType.MATCH_PAIRS:
      return wrapper(t('matchPairs'), <MatchPairsEditor blockId={block.id} payload={block.payload as any} />)
    case TaskBlockType.FREE_ANSWER:
      return wrapper(
        t('freeAnswer'),
        <FreeAnswerEditor error={error} blockId={block.id} payload={block.payload as any} />
      )
    case TaskBlockType.HIGHLIGHT_TEXT:
      return wrapper(t('highlightText'), <HighlightTextEditor blockId={block.id} payload={block.payload as any} />)
    case TaskBlockType.WORD_SCRAMBLE:
      return wrapper(t('wordScramble'), <WordScrambleEditor blockId={block.id} payload={block.payload as any} />)
    case TaskBlockType.DIALOGUE:
      return wrapper(t('dialogue'), <DialogueEditor blockId={block.id} payload={block.payload as any} />)

    case TaskBlockType.INFO_TEXT:
      return wrapper(
        t('infoText'),
        <InfoTextEditor
          payload={block.payload as InfoTextPayload}
          onChange={(p) => updateBlockPayload({id: block.id, payload: p})}
        />
      )
    case TaskBlockType.INFO_MEDIA:
      return wrapper(
        t('infoMedia'),
        <InfoMediaEditor
          payload={block.payload as InfoMediaPayload}
          onChange={(p) => updateBlockPayload({id: block.id, payload: p})}
        />
      )
    case TaskBlockType.INFO_AUDIO:
      return wrapper(
        t('infoAudio'),
        <InfoAudioEditor
          payload={block.payload as InfoAudioPayload}
          onChange={(p) => updateBlockPayload({id: block.id, payload: p})}
        />
      )

    default:
      return null
  }
}

export default BlockEditor
