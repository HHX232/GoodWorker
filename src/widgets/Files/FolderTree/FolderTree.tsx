'use client'

import type { FilesPerson, TreeNode } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useEffect, useMemo, useState } from 'react'
import { resolveCover } from '@/shared/lib/tutorFiles/covers'
import { FilesChevronIcon, FilesHomeIcon } from '../icons'
import styles from './FolderTree.module.scss'

interface FolderTreeProps {
  nodes: TreeNode[]
  /** Student view: label the roots by tutor when there's more than one. */
  teachers: FilesPerson[]
  currentId: string | null
  /** Ids from the root down to the open folder — kept expanded. */
  openPath: string[]
  rootLabel: string
  onSelect: (id: string | null) => void
}

/** Sidebar quick-nav: the whole visible folder tree, expandable per branch. */
export function FolderTree({ nodes, teachers, currentId, openPath, rootLabel, onSelect }: FolderTreeProps) {
  const children = useMemo(() => {
    const map = new Map<string | null, TreeNode[]>()
    for (const n of nodes) {
      const list = map.get(n.parentId) ?? []
      list.push(n)
      map.set(n.parentId, list)
    }
    return map
  }, [nodes])

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(openPath))
  useEffect(() => {
    setExpanded(prev => (openPath.every(id => prev.has(id)) ? prev : new Set([...prev, ...openPath])))
  }, [openPath])

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const renderNode = (node: TreeNode, depth: number) => {
    const kids = children.get(node.id) ?? []
    const isOpen = expanded.has(node.id)
    const active = node.id === currentId
    const cover = resolveCover(node.id, node.cover)
    const swatch = cover.kind === 'image' ? `center / cover no-repeat url("${cover.url}")` : cover.preset.background
    return (
      <li key={node.id}>
        <div className={`${styles.row} ${active ? styles.active : ''}`} style={{ paddingLeft: 6 + depth * 14 }}>
          {kids.length > 0
            ? (
              <button type="button" className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} onClick={() => toggle(node.id)} aria-label={node.name} aria-expanded={isOpen}>
                <FilesChevronIcon size={13} />
              </button>
            )
            : <span className={styles.chevronSpacer} />}
          <button type="button" className={styles.label} onClick={() => onSelect(node.id)} aria-current={active ? 'page' : undefined}>
            <span className={styles.swatch} style={{ background: swatch }} aria-hidden="true" />
            <span className={styles.name}>{node.name}</span>
          </button>
        </div>
        {kids.length > 0 && isOpen && <ul className={styles.list}>{kids.map(k => renderNode(k, depth + 1))}</ul>}
      </li>
    )
  }

  const roots = children.get(null) ?? []
  const byTeacher = teachers.length > 1

  return (
    <nav className={styles.tree}>
      <button type="button" className={`${styles.row} ${styles.rootRow} ${currentId === null ? styles.active : ''}`} onClick={() => onSelect(null)}>
        <FilesHomeIcon size={16} strokeWidth={1.8} className={styles.icon} />
        <span className={styles.name}>{rootLabel}</span>
      </button>
      {byTeacher
        ? teachers.map(teacher => {
            const own = roots.filter(r => r.teacherId === teacher.id)
            if (own.length === 0) return null
            return (
              <div key={teacher.id} className={styles.group}>
                <div className={styles.groupLabel}>{teacher.name}</div>
                <ul className={styles.list}>{own.map(r => renderNode(r, 0))}</ul>
              </div>
            )
          })
        : <ul className={styles.list}>{roots.map(r => renderNode(r, 0))}</ul>}
    </nav>
  )
}

