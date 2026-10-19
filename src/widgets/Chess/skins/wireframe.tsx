import { buildPieces, type SkinDef } from './types'

// Wireframe ("Сетка"): low-poly silhouettes woven from nodes and edges, like the site's network globe.
// White = pale paper fill with ink mesh, black = deep ink fill with lavender mesh; one violet node per piece.
type Ink = { fill: string; line: string; mesh: string; node: string; accent: string }
const WHITE: Ink = { fill: '#f7f5fc', line: '#1b1724', mesh: '#7a6d96', node: '#1b1724', accent: '#8b42f4' }
const BLACK: Ink = { fill: '#262130', line: '#0c0a10', mesh: '#a998d4', node: '#efeaff', accent: '#b07cff' }

// hull: closed outline (points), mesh: inner edges (path), nodes: junction dots, top: the violet node
type Shape = { hull: string; mesh: string; nodes: string; top: string }

const BASE_HULL_L = '22 90 22 84 30 80'
const BASE_HULL_R = '70 80 78 84 78 90'
const BASE_MESH = 'M30 80H70M22 84 50 90 78 84'

const SHAPES: Record<string, Shape> = {
  P: {
    hull: `${BASE_HULL_L} 38 64 44 51 36 48 39 43 45 41 40 35 39 27 44 20 50 17 56 20 61 27 60 35 55 41 61 43 64 48 56 51 62 64 ${BASE_HULL_R}`,
    mesh: 'M39 27 50 30 61 27M40 35 50 30 60 35M45 41 50 30 55 41M36 48H64M44 51 50 64 56 51M38 64H62M38 64 50 80 62 64M50 64V80',
    nodes: '50 30 50 64 50 80',
    top: '50 17',
  },
  R: {
    hull: `${BASE_HULL_L} 34 72 35 46 29 42 29 22 37 22 37 29 45 29 45 22 55 22 55 29 63 29 63 22 71 22 71 42 65 46 66 72 ${BASE_HULL_R}`,
    mesh: 'M29 42H71M35 46H65M29 42 37 29M45 29 50 42 55 29M63 29 71 42M35 46 50 59 65 46M34 72 50 59 66 72M34 72H66',
    nodes: '50 59 50 72 29 42 71 42',
    top: '50 42',
  },
  B: {
    hull: `${BASE_HULL_L} 38 66 42 52 36 49 41 44 37 35 40 25 46 17 47 13 50 9 53 13 54 17 60 25 63 35 59 44 64 49 58 52 62 66 ${BASE_HULL_R}`,
    mesh: 'M46 17H54M58 25 46 37M37 35 50 44 63 35M41 44H59M36 49H64M42 52 50 66 58 52M38 66H62M38 66 50 80 62 66M50 66V80',
    nodes: '50 44 50 66 50 80',
    top: '50 9',
  },
  N: {
    hull: `${BASE_HULL_L} 31 69 39 57 30 56 21 55 18 49 22 42 33 30 36 22 39 12 44 20 50 19 62 24 71 34 76 48 76 62 72 72 ${BASE_HULL_R}`,
    mesh: 'M22 42 36 38 46 44 39 57M33 30 36 38M44 20 46 44M50 19 58 36 63 52 64 70 70 80M46 44 58 36 71 34M46 44 63 52 76 48M39 57 50 68 64 70 76 62M31 69 50 68 50 80',
    nodes: '46 44 58 36 63 52 50 68 64 70',
    top: '39 12',
  },
  Q: {
    hull: `${BASE_HULL_L} 33 66 31 62 24 30 36 46 38 20 47 42 50 15 53 42 62 20 64 46 76 30 69 62 67 66 ${BASE_HULL_R}`,
    mesh: 'M31 62H69M36 46 50 56 64 46M47 42 50 56 53 42M31 62 50 56 69 62M33 66 50 80 67 66',
    nodes: '24 30 38 20 62 20 76 30 50 56',
    top: '50 15',
  },
  K: {
    hull: `${BASE_HULL_L} 33 66 30 62 25 48 28 40 36 37 44 40 47 35 47 25 41 25 41 19 47 19 47 10 53 10 53 19 59 19 59 25 53 25 53 35 56 40 64 37 72 40 75 48 70 62 67 66 ${BASE_HULL_R}`,
    mesh: 'M30 62H70M28 40 40 50 50 44 60 50 72 40M25 48 40 50 50 62 60 50 75 48M44 40 50 44 56 40M50 44V62M33 66 50 80 67 66',
    nodes: '40 50 60 50 50 44 50 62',
    top: '50 22',
  },
}

const dots = (pts: string) => {
  const n = pts.split(' ').map(Number)
  return Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]] as const)
}

const draw = (kind: string, ink: Ink) => {
  const s = SHAPES[kind]
  const [tx, ty] = dots(s.top)[0]
  return (
    <g fill={ink.fill} stroke={ink.line} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
      <path d={`M${s.hull}Z`} />
      <path d={`${s.mesh}${BASE_MESH}`} fill="none" stroke={ink.mesh} strokeWidth="1.3" />
      {dots(s.nodes).map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.1" fill={ink.node} stroke="none" />
      ))}
      <circle cx={tx} cy={ty} r="3.2" fill={ink.accent} stroke="none" />
    </g>
  )
}

export const wireframe: SkinDef = {
  id: 'wireframe',
  labelKey: 'skin_wireframe',
  light: '#efecf6',
  dark: '#a99dc7',
  coordLight: '#8a7fae',
  coordDark: '#f3f0fa',
  pieces: buildPieces('Wireframe', WHITE, BLACK, draw),
}
