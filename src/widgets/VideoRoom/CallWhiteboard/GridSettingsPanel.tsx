'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import styles from './GridSettingsPanel.module.scss'

export type GridStyle = 'squares' | 'dots' | 'lines' | 'off'

export interface GridSettings {
  style: GridStyle
  cellSize: number
  /** 0..90 — percent transparency of the grid pattern; 0 is fully opaque. */
  transparency: number
}

export const DEFAULT_GRID_SETTINGS: GridSettings = { style: 'off', cellSize: 24, transparency: 0 }

const STYLE_OPTIONS: GridStyle[] = ['off', 'squares', 'dots', 'lines']

interface Props {
  settings: GridSettings
  onChange: (settings: GridSettings) => void
  onClose: () => void
}

export function GridSettingsPanel({ settings, onChange, onClose }: Props) {
  const t = useTranslations('whiteboard.grid')
  return (
    <div className={styles.panel}>
      <div className={styles.title}>{t('title')}</div>
      <div className={styles.styleRow}>
        {STYLE_OPTIONS.map(value => (
          <button
            key={value}
            type="button"
            className={`${styles.styleButton} ${settings.style === value ? styles.styleButtonActive : ''}`}
            onClick={() => onChange({ ...settings, style: value })}
          >
            <span className={styles.swatch} data-swatch={value} aria-hidden="true" />
            {t(value)}
          </button>
        ))}
      </div>
      <label className={styles.sizeRow}>
        <span className={styles.sizeLabel}>{t('cellSize')}</span>
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
        <span className={styles.sizeLabel}>{t('transparency')}</span>
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
          {t('done')}
        </button>
      </div>
    </div>
  )
}
