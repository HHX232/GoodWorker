'use client'

import React, { useEffect, useState } from 'react'
import styles from './ElementInspector.module.scss'

interface Props {
  label: string
  x: number
  y: number
  onEdit: () => void
  onRename: (newLabel: string) => void
}

export function ElementInspector({ label, x, y, onEdit, onRename }: Props) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(label)

  useEffect(() => {
    setDraft(label)
  }, [label])

  const commit = () => {
    setRenaming(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== label) onRename(trimmed)
  }

  return (
    <div className={styles.inspector} style={{ left: x, top: y }}>
      {renaming ? (
        <input
          className={styles.nameInput}
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            e.stopPropagation()
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(label)
              setRenaming(false)
            }
          }}
        />
      ) : (
        <span className={styles.name} onDoubleClick={() => setRenaming(true)} title="Двойной клик — переименовать">
          {label}
        </span>
      )}
      <button type="button" className={styles.editButton} onClick={onEdit} title="Открыть редактор">
        ✎
      </button>
    </div>
  )
}
