'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { OutlineStep } from '@/shared/lib/roadmapOutline'

// ─── Brand tokens (matches TaskPlan) ───────────────────────────────────────
const brand = {
  bg: '#EEEFF8',
  card: '#ffffff',
  border: 'rgba(20,20,22,0.1)',
  text: '#141416',
  textMuted: 'rgba(20,20,22,0.45)',
  hoverBg: 'rgba(20,20,22,0.04)',
  green:  { bg: '#e6f9ef', text: '#1a7a45' },
  blue:   { bg: '#e6f0ff', text: '#1a4fa8' },
  yellow: { bg: '#fff8e1', text: '#8a6200' },
  red:    { bg: '#fde8e8', text: '#b91c1c' },
  muted:  { bg: 'rgba(20,20,22,0.07)', text: 'rgba(20,20,22,0.45)' },
}

function completionColors(pct: number) {
  if (pct >= 70) return brand.green
  if (pct >= 40) return brand.blue
  if (pct > 0)   return brand.yellow
  return brand.muted
}

interface Section {
  step: OutlineStep
  children: OutlineStep[]
}

function buildSections(steps: OutlineStep[]): { sections: Section[]; orphans: OutlineStep[] } {
  const sections: Section[] = []
  const orphans: OutlineStep[] = []
  let current: Section | null = null

  for (const step of steps) {
    if (step.type === 'DIVIDER' && step.depth === 0) {
      current = { step, children: [] }
      sections.push(current)
    } else if (current) {
      current.children.push(step)
    } else {
      orphans.push(step)
    }
  }
  return { sections, orphans }
}

interface Props {
  steps: OutlineStep[]
  nodeProgress: Record<string, number>
  totalStudents: number
}

export function RoadmapNodeProgress({ steps, nodeProgress, totalStudents }: Props) {
  const { sections, orphans } = buildSections(steps)
  const [expanded, setExpanded] = useState<string[]>(sections.slice(0, 2).map(s => s.step.nodeId))

  const toggle = (id: string) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const subtaskListVariants = {
    hidden: { opacity: 0, height: 0, overflow: 'hidden' as const },
    visible: { height: 'auto', opacity: 1, overflow: 'visible' as const, transition: { duration: 0.22, staggerChildren: 0.04 } },
    exit:    { height: 0, opacity: 0, overflow: 'hidden' as const, transition: { duration: 0.18 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, x: -8 },
    visible: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 28 } },
    exit: { opacity: 0, x: -8, transition: { duration: 0.12 } },
  }

  const renderNode = (step: OutlineStep) => {
    const count = nodeProgress[step.nodeId] ?? 0
    const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0
    const colors = completionColors(pct)

    return (
      <motion.div
        key={step.nodeId}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6 }}
        variants={itemVariants}
        whileHover={{ backgroundColor: brand.hoverBg }}
        transition={{ duration: 0.15 }}
      >
        <span style={{
          minWidth: 30,
          fontSize: 11,
          fontWeight: 700,
          color: brand.textMuted,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}>
          {step.number}
        </span>
        <span style={{ flex: 1, fontSize: 13, color: brand.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {step.title}
        </span>
        {totalStudents > 0 && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            background: colors.bg,
            color: colors.text,
            borderRadius: 4,
            padding: '2px 7px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            {count} / {totalStudents}
          </span>
        )}
      </motion.div>
    )
  }

  return (
    <div style={{ background: brand.bg, borderRadius: 12, padding: 8 }}>
      <motion.div
        style={{
          background: brand.card,
          border: `1px solid ${brand.border}`,
          borderRadius: 10,
          boxShadow: '0 1px 4px rgba(20,20,22,0.07)',
          overflow: 'hidden',
          padding: '10px 6px',
        }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.25 } }}
      >
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Orphan nodes (before first divider) */}
          {orphans.map(s => (
            <li key={s.nodeId}>{renderNode(s)}</li>
          ))}

          {sections.map((section, idx) => {
            const isOpen = expanded.includes(section.step.nodeId)
            const sectionCount = section.children.reduce((sum, c) => sum + (nodeProgress[c.nodeId] ?? 0), 0)
            const sectionMaxPossible = section.children.length * totalStudents
            const sectionPct = sectionMaxPossible > 0 ? Math.round((sectionCount / sectionMaxPossible) * 100) : 0
            const sc = completionColors(sectionPct)

            return (
              <motion.li
                key={section.step.nodeId}
                style={{ marginTop: idx !== 0 ? 4 : 0, paddingTop: idx !== 0 ? 6 : 0 }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.04 } }}
              >
                {/* Section header row */}
                <motion.div
                  style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 8, cursor: 'pointer' }}
                  whileHover={{ backgroundColor: brand.hoverBg }}
                  onClick={() => toggle(section.step.nodeId)}
                >
                  <span style={{
                    minWidth: 30,
                    fontSize: 11,
                    fontWeight: 700,
                    color: brand.textMuted,
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}>
                    {section.step.number}
                  </span>

                  <span style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: 600,
                    color: brand.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginRight: 8,
                  }}>
                    {section.step.title}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {totalStudents > 0 && (
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={sectionPct}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            background: sc.bg,
                            color: sc.text,
                            borderRadius: 4,
                            padding: '2px 7px',
                          }}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.18 }}
                        >
                          {sectionPct}%
                        </motion.span>
                      </AnimatePresence>
                    )}
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke={brand.textMuted} strokeWidth="2.5" strokeLinecap="round"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </motion.div>

                {/* Sub-items */}
                <AnimatePresence>
                  {isOpen && section.children.length > 0 && (
                    <motion.div
                      style={{ position: 'relative' }}
                      variants={subtaskListVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                    >
                      {/* Dashed connecting line */}
                      <div style={{
                        position: 'absolute',
                        top: 0, bottom: 0,
                        left: 20,
                        borderLeft: `2px dashed ${brand.border}`,
                      }} />
                      <ul style={{ listStyle: 'none', margin: '2px 4px 4px 10px', padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {section.children.map(child => (
                          <li key={child.nodeId} style={{ paddingLeft: 22 }}>
                            {renderNode(child)}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            )
          })}
        </ul>
      </motion.div>
    </div>
  )
}
