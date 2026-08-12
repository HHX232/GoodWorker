import { TestBlock } from '@/entities/store/slices/tasksSlice.slice'
import { QuickTestBuilder } from '../QuickTestBuilder/QuickTestBuilder'
import styles from '../VideoCallPage.module.scss'

interface PickerTest {
  id: string
  title: string
  content: { blocks: TestBlock[] }
}

interface TestPickerModalProps {
  pickerTests: PickerTest[]
  pickerLoading: boolean
  activeTab: 'list' | 'quick' | 'board'
  onTabChange: (tab: 'list' | 'quick' | 'board') => void
  onClose: () => void
  onLaunchTest: (testId: string | null, title: string, blocks: TestBlock[]) => void
  onLaunchWhiteboard: () => void
}

export function TestPickerModal({
  pickerTests,
  pickerLoading,
  activeTab,
  onTabChange,
  onClose,
  onLaunchTest,
  onLaunchWhiteboard,
}: TestPickerModalProps) {
  return (
    <div className={styles.testPickerOverlay}>
      <div className={styles.testPickerModal}>
        <div className={styles.testPickerHeader}>
          <p className={styles.testPickerTitle}>Запустить тест</p>
          <button className={styles.testPickerClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.testPickerTabs}>
          {(['list', 'quick', 'board'] as const).map(tab => (
            <button
              key={tab}
              className={`${styles.testPickerTab} ${activeTab === tab ? styles.testPickerTabActive : ''}`}
              onClick={() => onTabChange(tab)}
            >
              {tab === 'list' ? 'Мои тесты' : tab === 'quick' ? 'Быстрый тест' : '🎨 Доска'}
            </button>
          ))}
        </div>

        <div className={styles.testPickerBody}>
          {activeTab === 'list' && (
            <div className={styles.testList}>
              {pickerLoading && <p className={styles.testListEmpty}>Загрузка...</p>}
              {!pickerLoading && pickerTests.length === 0 && (
                <p className={styles.testListEmpty}>Нет тестов. Создайте тест в конструкторе.</p>
              )}
              {pickerTests.map(t => (
                <div key={t.id} className={styles.testListItem}>
                  <div>
                    <div className={styles.testListName}>{t.title}</div>
                    <div className={styles.testListMeta}>{t.content.blocks.length} блоков</div>
                  </div>
                  <button
                    className={styles.testLaunchBtn}
                    onClick={() => onLaunchTest(t.id, t.title, t.content.blocks)}
                  >▶ Запустить</button>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'quick' && (
            <QuickTestBuilder onLaunch={(blocks) => onLaunchTest(null, 'Быстрый тест', blocks)} />
          )}
          {activeTab === 'board' && (
            <div className={styles.boardLaunchTab}>
              <div className={styles.boardLaunchIcon}>🎨</div>
              <p className={styles.boardLaunchDesc}>
                Откройте общую доску для рисования — все участники увидят её в реальном времени.
              </p>
              <button className={styles.testLaunchBtn} onClick={onLaunchWhiteboard}>▶ Открыть доску</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
