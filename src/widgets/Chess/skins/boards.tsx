import type { SkinDef } from './types'
import { classic } from './classic'

// Reward board colourings (G24): squares only — any piece set stands on them. Coordinates take the opposite square's tone.
const board = (id: SkinDef['id'], unlock: string | undefined, light: string, dark: string, frame: string): SkinDef => ({
  id,
  labelKey: `skin_${id}`,
  only: 'board',
  unlock,
  light,
  dark,
  coordLight: dark,
  coordDark: light,
  frame,
  pieces: classic.pieces,
})

export const ice = board('ice', 'streak_7', '#e6f0f5', '#7fa7bf', '#4d7590')
export const emerald = board('emerald', 'points_500', '#e4ecd8', '#3b7d5c', '#1f4d36')
export const sunset = board('sunset', 'first_win_l3', '#f7dcb4', '#cf6a4c', '#8a3a28')
export const graphite = board('graphite', 'storm_10', '#c4c6cb', '#565b65', '#2e3138')

// Themed boards (G37), open to all, each drawn for its piece set: monsters, vikings, candy.
export const lair = board('lair', undefined, '#cdc8b6', '#5e5072', '#342b40')
export const fjord = board('fjord', undefined, '#e6d3ab', '#45604f', '#2b3b31')
export const sweets = board('sweets', undefined, '#f9dbe0', '#86cdb9', '#d98a9c')
