import {useRoadmapAccessContext} from '@/shared/ui/RoadMap/context/RoadmapAccessContext'
import {BlockRoadParam, RoadMapBlockType} from '@/shared/types/RoadMap/RoadMap.types'
import {Handle, Position} from '@xyflow/react'
import {useTranslations} from 'next-intl'
import handleStyles from '../NodeInputs/NodeInputs.module.scss'
import styles from './PaywallOverlay.module.scss'

function FakeMediaBlock() {
  return (
    <div className={styles.fakeBox}>
      <div className={styles.fakeMediaControls}>
        <div className={styles.fakeSegmented}>
          <div className={styles.fakeSegBtn} />
          <div className={`${styles.fakeSegBtn} ${styles.active}`} />
          <div className={styles.fakeSegBtn} />
        </div>
        <div className={styles.fakeRow} style={{gap: 4}}>
          <div className={styles.fakePill} style={{width: 32}} />
          <div className={styles.fakeIconBtn} />
          <div className={styles.fakeIconBtn} />
        </div>
      </div>
      <div className={styles.fakeImage} />
    </div>
  )
}

function FakeAudioBlock() {
  return (
    <div className={styles.fakeBox}>
      <div className={styles.fakeRow} style={{gap: 10, alignItems: 'center'}}>
        <div className={styles.fakePlayBtn} />
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 4}}>
          <div className={styles.fakeWaveform}>
            {Array.from({length: 48}).map((_, i) => (
              <div
                key={i}
                className={styles.fakeBar}
                style={{height: `${20 + Math.sin(i * 0.7) * 14 + Math.cos(i * 1.3) * 8}px`}}
              />
            ))}
          </div>
          <div className={styles.fakeRow} style={{justifyContent: 'space-between'}}>
            <div className={styles.fakeLine} style={{width: 24}} />
            <div className={styles.fakeLine} style={{width: 28}} />
          </div>
        </div>
      </div>
    </div>
  )
}

function FakeFileBlock() {
  const fakeFiles = [
    {color: '#ef4444', w: 90},
    {color: '#2563eb', w: 120},
    {color: '#8b5cf6', w: 70}
  ]
  return (
    <div className={styles.fakeBox}>
      {fakeFiles.map((f, i) => (
        <div key={i} className={styles.fakeFileRow}>
          <div className={styles.fakeFileIcon} style={{color: f.color}}>
            <div className={styles.fakeFileIconInner} />
            <div className={styles.fakeFileExt} style={{background: f.color}} />
          </div>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 4}}>
            <div className={styles.fakeLine} style={{width: f.w}} />
            <div className={styles.fakeLine} style={{width: 36, opacity: 0.5}} />
          </div>
          <div className={styles.fakeIconBtn} />
        </div>
      ))}
    </div>
  )
}

function FakeTextBlock() {
  return (
    <div className={styles.fakeBox}>
      <div className={styles.fakeLine} style={{width: '92%'}} />
      <div className={styles.fakeLine} style={{width: '85%'}} />
      <div className={styles.fakeLine} style={{width: '78%'}} />
      <div className={styles.fakeLine} style={{width: '60%'}} />
    </div>
  )
}

function FakeTestBlock() {
  return (
    <div className={styles.fakeBox}>
      <div className={styles.fakeRow} style={{justifyContent: 'space-between', marginBottom: 4}}>
        <div className={styles.fakePill} style={{width: 60}} />
        <div className={styles.fakePill} style={{width: 40}} />
      </div>
      <div className={styles.fakeLine} style={{width: '88%', height: 14, marginBottom: 10}} />
      {[80, 95, 70, 85].map((w, i) => (
        <div key={i} className={styles.fakeOption}>
          <div className={styles.fakeRadio} />
          <div className={styles.fakeLine} style={{width: `${w}%`}} />
        </div>
      ))}
    </div>
  )
}

function FakePostsBlock() {
  return (
    <div className={styles.fakeBox}>
      {[1, 2].map((i) => (
        <div key={i} className={styles.fakePostCard}>
          <div className={styles.fakePostThumb} />
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 5}}>
            <div className={styles.fakeLine} style={{width: '80%', height: 12}} />
            <div className={styles.fakeLine} style={{width: '55%', opacity: 0.5}} />
            <div className={styles.fakeRow} style={{gap: 4, marginTop: 2}}>
              <div className={styles.fakePill} style={{width: 36}} />
              <div className={styles.fakePill} style={{width: 44}} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function FakeSelectTestBlock() {
  return (
    <div className={styles.fakeBox}>
      <div className={styles.fakeSelect} />
      <div className={styles.fakeTestCard}>
        <div className={styles.fakeRow} style={{gap: 8, alignItems: 'center', marginBottom: 8}}>
          <div className={styles.fakeAvatar} />
          <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
            <div className={styles.fakeLine} style={{width: 100, height: 11}} />
            <div className={styles.fakeLine} style={{width: 65, opacity: 0.5}} />
          </div>
        </div>
        <div className={styles.fakeLine} style={{width: '90%', height: 13, marginBottom: 6}} />
        <div className={styles.fakeLine} style={{width: '70%', marginBottom: 10}} />
        <div className={styles.fakeRow} style={{gap: 4}}>
          <div className={styles.fakePill} style={{width: 28}} />
          <div className={styles.fakePill} style={{width: 38}} />
          <div className={styles.fakePill} style={{width: 32}} />
        </div>
      </div>
    </div>
  )
}
function FakeEntryPointBlock() {
  return (
    <div className={styles.fakeBox}>
      <div className={styles.fakeRow} style={{gap: 8, alignItems: 'center', marginBottom: 6}}>
        <div className={styles.fakeAvatar} style={{borderRadius: 8}} />
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 5}}>
          <div className={styles.fakeLine} style={{width: '70%', height: 13}} />
          <div className={styles.fakeLine} style={{width: '45%', opacity: 0.5}} />
        </div>
      </div>
      <div className={styles.fakeLine} style={{width: '90%'}} />
      <div className={styles.fakeLine} style={{width: '75%'}} />
      <div className={styles.fakeRow} style={{gap: 4, marginTop: 4}}>
        <div className={styles.fakePill} style={{width: 50}} />
        <div className={styles.fakePill} style={{width: 66}} />
      </div>
    </div>
  )
}

function FakeDividerBlock() {
  return (
    <div className={styles.fakeBox}>
      <div className={styles.fakeRow} style={{gap: 6, alignItems: 'center', marginBottom: 4}}>
        <div className={styles.fakeLine} style={{flex: 1, height: 2, borderRadius: 1}} />
        <div className={styles.fakePill} style={{width: 24, height: 24, borderRadius: 6}} />
        <div className={styles.fakeLine} style={{flex: 1, height: 2, borderRadius: 1}} />
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0'}}>
        {[70, 85, 55].map((w, i) => (
          <div key={i} className={styles.fakeOption}>
            <div className={styles.fakeRadio} style={{width: 12, height: 12}} />
            <div className={styles.fakeLine} style={{width: `${w}%`}} />
          </div>
        ))}
      </div>
      <div className={styles.fakeRow} style={{gap: 6, alignItems: 'center', marginTop: 4}}>
        <div className={styles.fakeLine} style={{flex: 1, height: 2, borderRadius: 1}} />
        <div className={styles.fakePill} style={{width: 24, height: 24, borderRadius: 6}} />
        <div className={styles.fakeLine} style={{flex: 1, height: 2, borderRadius: 1}} />
      </div>
    </div>
  )
}
const FAKE_MAP: Partial<Record<RoadMapBlockType, React.FC>> = {
  [RoadMapBlockType.ENTRY_POINT]: FakeEntryPointBlock,
  [RoadMapBlockType.DIVIDER]: FakeDividerBlock,
  [RoadMapBlockType.INFO_MEDIA]: FakeMediaBlock,
  [RoadMapBlockType.INFO_AUDIO]: FakeAudioBlock,
  [RoadMapBlockType.DOWNLOAD_FILE_LINK]: FakeFileBlock,
  [RoadMapBlockType.INFO_TEXT]: FakeTextBlock,
  [RoadMapBlockType.ACTIVE_TEST]: FakeTestBlock,
  [RoadMapBlockType.POST_LINK]: FakePostsBlock,
  [RoadMapBlockType.TEST_LINK]: FakeSelectTestBlock
}

interface PaywallOverlayProps {
  type: RoadMapBlockType
  nodeId: string
  hasInput: boolean
  hasOutput: boolean
  inputs?: BlockRoadParam[]
  outputs?: BlockRoadParam[]
}

export function PaywallOverlay({type, nodeId, hasInput, hasOutput}: PaywallOverlayProps) {
  const t = useTranslations('roadMap')
  const FakeContent = FAKE_MAP[type]
  const {nodeAccessType, openPurchaseModal} = useRoadmapAccessContext()

  const handleLockClick = () => {
    openPurchaseModal()
  }

  return (
    <div className={styles.overlay}>
      {hasInput && (
        <Handle
          position={Position.Left}
          id={`${nodeId}-input`}
          type='target'
          className={handleStyles.handle}
          style={{opacity: 0, pointerEvents: 'none'}}
        />
      )}
      {hasOutput && (
        <Handle
          position={Position.Right}
          id={`${nodeId}-output`}
          type='source'
          className={handleStyles.handle}
          style={{opacity: 0, pointerEvents: 'none'}}
        />
      )}

      {FakeContent && (
        <div className={styles.fakeContent}>
          <FakeContent />
        </div>
      )}
      <div className={styles.blur} />
      <button className={styles.lockBadge} onClick={handleLockClick}>
        <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
          <rect x='3' y='11' width='18' height='11' rx='2' stroke='currentColor' strokeWidth='2' />
          <path d='M7 11V7a5 5 0 0 1 10 0v4' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
        </svg>
        {nodeAccessType === 'PURCHASE' ? t('paywallBuy') : t('paywallLocked')}
      </button>
    </div>
  )
}
