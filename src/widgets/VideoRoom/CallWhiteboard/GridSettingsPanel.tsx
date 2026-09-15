'use client'

import React from 'react'
import styles from './GridSettingsPanel.module.scss'

export type GridStyle = 'squares' | 'dots' | 'lines' | 'off'

export interface GridSettings {
  style: GridStyle
  cellSize: number
  /** 0..90 — percent transparency of the grid pattern; 0 is fully opaque. */
  transparency: number
}

export const DEFAULT_GRID_SETTINGS: GridSettings = { style: 'off', cellSize: 24, transparency: 0 }

const STYLE_OPTIONS: { value: GridStyle; label: string }[] = [
  { value: 'off', label: 'Выкл' },
  { value: 'squares', label: 'Клетка' },
  { value: 'dots', label: 'Точки' },
  { value: 'lines', label: 'Линейка' },
]

interface Props {
  settings: GridSettings
  onChange: (settings: GridSettings) => void
  onClose: () => void
}

export function GridSettingsPanel({ settings, onChange, onClose }: Props) {
  return (
    <div className={styles.panel}>
      <div className={styles.title}>Сетка доски</div>
      <div className={styles.styleRow}>
        {STYLE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.styleButton} ${settings.style === opt.value ? styles.styleButtonActive : ''}`}
            onClick={() => onChange({ ...settings, style: opt.value })}
          >
            <span className={styles.swatch} data-swatch={opt.value} aria-hidden="true" />
            {opt.label}
          </button>
        ))}
      </div>
      <label className={styles.sizeRow}>
        <span className={styles.sizeLabel}>Размер ячейки</span>
        <input
          className={styles.slider}
          type="range"
          min={10}
          max={60}
          step={2}
          value={settings.cellSize}
          disabled={settings.style === 'off'}
          onChange={e => onChange({ ...settings, cellSize: Number(e.target.value) })}
        />
        <span className={styles.sizeValue}>{settings.cellSize}px</span>
      </label>
      <label className={styles.sizeRow}>
        <span className={styles.sizeLabel}>Прозрачность</span>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={90}
          step={5}
          value={settings.transparency}
          disabled={settings.style === 'off'}
          onChange={e => onChange({ ...settings, transparency: Number(e.target.value) })}
        />
        <span className={styles.sizeValue}>{settings.transparency}%</span>
      </label>
      <div className={styles.actions}>
        <button type="button" className={styles.close} onClick={onClose}>
          Готово
        </button>
      </div>
    </div>
  )
}
