// Small book illustrations of design A: the shelf buttons, the hero's collection cards and the empty states.
// They are artwork (fixed book colours), not UI icons — the UI icons come from lucide-react.
import styles from './BooksPage.module.scss'

export type ShelfKind = 'all' | 'saved' | 'new'
export type MiniKind = 'new' | 'withcover' | 'needcover' | 'done'

export function ShelfArt({ kind }: { kind: ShelfKind }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {kind === 'all' && (
        <>
          <rect x="6" y="31" width="34" height="9" rx="3" fill="#6a4fb3" />
          <rect x="9" y="21" width="32" height="9" rx="3" fill="#c4443e" />
          <rect x="7" y="11" width="33" height="9" rx="3" fill="#2f5aa8" />
          <path d="M31 11v9M33 21v9" stroke="#fff" strokeOpacity=".5" />
          <path d="M33 7v9l2.5-2 2.5 2V7z" fill="#e0a43a" />
        </>
      )}
      {kind === 'saved' && (
        <>
          <rect x="9" y="5" width="28" height="35" rx="4" fill="#6a4fb3" />
          <rect x="9" y="37" width="30" height="5" rx="2.5" fill="#4b3787" />
          <path d="M26 5h9v19l-4.5-3.5L26 24z" fill="#f2b84b" />
        </>
      )}
      {kind === 'new' && (
        <>
          <rect x="9" y="5" width="28" height="35" rx="4" fill="#3f7d5b" />
          <rect x="9" y="37" width="30" height="5" rx="2.5" fill="#2a5a40" />
          <path d="m23 13 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#ffe08a" />
        </>
      )}
    </svg>
  )
}

export function MiniArt({ kind }: { kind: MiniKind }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {kind === 'new' && (
        <>
          <rect x="6" y="10" width="14" height="30" rx="3" fill="#3f7d5b" />
          <rect x="22" y="14" width="13" height="26" rx="3" fill="#c79a2e" />
          <rect x="36" y="9" width="8" height="31" rx="3" fill="#2a8c8c" />
          <path d="m31 4 1.6 3.4 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#e0a43a" />
        </>
      )}
      {kind === 'withcover' && (
        <>
          <rect x="8" y="5" width="30" height="38" rx="4" fill="#2f5aa8" />
          <circle cx="23" cy="20" r="7" fill="none" stroke="#f4d58a" strokeWidth="2" />
          <path d="M14 33h18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M32 5h7v14l-3.5-2.6L32 19z" fill="#f2b84b" />
        </>
      )}
      {kind === 'needcover' && (
        <>
          <rect x="8" y="5" width="30" height="38" rx="4" fill="#fbfaf5" stroke="#b9bbcb" />
          <path d="M14 14h18M14 20h18M14 26h11" stroke="#c8c9d4" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="35" cy="35" r="9" fill="#534AB7" />
          <path d="M35 30v10M30 35h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {kind === 'done' && (
        <>
          <rect x="8" y="5" width="30" height="38" rx="4" fill="#b9552f" />
          <path d="m16 24 6 6 11-12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

export function EmptyShelfArt() {
  return (
    <svg viewBox="0 0 260 150" fill="none" aria-hidden="true">
      <rect x="14" y="116" width="232" height="10" rx="5" className={styles.artPlank} />
      <rect x="46" y="48" width="26" height="68" rx="5" fill="#2f5aa8" opacity=".85" />
      <rect x="76" y="62" width="22" height="54" rx="5" fill="#c4443e" opacity=".85" />
      <rect x="102" y="40" width="28" height="76" rx="5" fill="#6a4fb3" opacity=".85" />
      <g className={styles.artDash}>
        <rect x="144" y="56" width="26" height="60" rx="5" />
        <rect x="176" y="44" width="30" height="72" rx="5" />
      </g>
      <path d="M157 80v14M150 87h14" className={styles.artPlus} />
      <path d="M52 48h14v22l-7-5-7 5z" fill="#e0a43a" />
    </svg>
  )
}

export function EmptyMineArt() {
  return (
    <svg viewBox="0 0 260 150" fill="none" aria-hidden="true">
      <rect x="80" y="28" width="62" height="88" rx="8" className={styles.artSheetBack} />
      <rect x="112" y="40" width="62" height="88" rx="8" className={styles.artSheetFront} />
      <path d="M128 40h22v38l-11-8.5L128 78z" className={styles.artRibbon} />
      <path d="M135.5 54l3.5 3.5 6-7" className={styles.artTick} />
      <path d="M122 98h38M122 108h24" className={styles.artLines} />
    </svg>
  )
}
