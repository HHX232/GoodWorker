// Данные и чистый редьюсер окна «Мои файлы» (hero). Анимации и тексты живут в компонентах —
// здесь только состояние: какая папка/экран открыт, кому выдан доступ, какие файлы открыты.

export type StudentId = 'anna' | 'ilya' | 'maria' | 'kirill'
export type FileType = 'pdf' | 'mp3' | 'docx' | 'xlsx'
export type FileIconName = 'doc' | 'wave' | 'table'

export const ORDER: StudentId[] = ['anna', 'ilya', 'maria', 'kirill']
export const GENDER: Record<StudentId, 'f' | 'm'> = { anna: 'f', ilya: 'm', maria: 'f', kirill: 'm' }

/** Номер N соответствует ключам file_N / size_N в сообщениях. */
export const FILES: { n: number; t: FileType; icon: FileIconName }[] = [
   { n: 1, t: 'pdf', icon: 'doc' },
   { n: 2, t: 'mp3', icon: 'wave' },
   { n: 3, t: 'docx', icon: 'doc' },
   { n: 4, t: 'xlsx', icon: 'table' }
]

/** `f` — индексы файлов в FILES, порядок показа в папке. Номер папки N → ключ folder_N. */
export const FOLDER_DEFS = [
   { c: '#5b4df0', f: [0, 1, 3] },
   { c: '#8b6cf6', f: [2, 3, 0] },
   { c: '#f2b134', f: [3, 0, 1] },
   { c: '#2fb67a', f: [1, 2, 0] }
]

export type Entry = { id: StudentId; leaving: boolean; fresh: boolean }
export type FolderState = { access: Entry[]; open: boolean[] }
export type ToastKind = 'granted' | 'revoked' | 'fileOpen' | 'fileClosed' | 'fileSubOpen'
export type ToastItem = { id: number; who: StudentId; kind: ToastKind }
export type Mode = 'root' | 'folder' | 'sub'
export type PopWhere = 'view' | 'panel'

export type State = {
   cur: number
   mode: Mode
   subId: StudentId | null
   folders: FolderState[]
   panel: { k: number; closing: boolean } | null
   pop: PopWhere | null
   toasts: ToastItem[]
   seq: number
   lastGranted: StudentId | null
}

export type Action =
   | { type: 'select'; i: number }
   | { type: 'nextFolder' }
   | { type: 'openSub'; id: StudentId }
   | { type: 'goFolder' }
   | { type: 'goRoot' }
   | { type: 'grant'; id: StudentId }
   | { type: 'revoke'; id: StudentId }
   | { type: 'toggleAccess'; id: StudentId }
   | { type: 'autoGrant' }
   | { type: 'autoRevoke' }
   | { type: 'openPanel'; k: number }
   | { type: 'panelClosing' }
   | { type: 'panelDone' }
   | { type: 'toggleFile' }
   | { type: 'togglePop'; where: PopWhere }
   | { type: 'closePop' }
   | { type: 'purge'; id: StudentId }
   | { type: 'settle' }
   | { type: 'dismissToast'; id: number }

const INIT_ACCESS: StudentId[][] = [['anna', 'ilya'], ['maria'], ['anna', 'kirill'], ['ilya']]
const INIT_OPEN: boolean[][] = [
   [true, true, false],
   [true, false, false],
   [true, true, false],
   [false, true, false]
]

export const initialState: State = {
   cur: 0,
   mode: 'folder',
   subId: null,
   folders: INIT_ACCESS.map((a, i) => ({
      access: a.map(id => ({ id, leaving: false, fresh: false })),
      open: INIT_OPEN[i]
   })),
   panel: null,
   pop: null,
   toasts: [],
   seq: 0,
   lastGranted: null
}

/** Ученики с действующим доступом (без «уходящих»). */
export const activeIds = (f: FolderState): StudentId[] => f.access.filter(e => !e.leaving).map(e => e.id)

/** Файлы личной подпапки ученика: два файла папки, сдвиг по номеру ученика. */
export function subKs(folderIdx: number, id: StudentId): number[] {
   const n = FOLDER_DEFS[folderIdx].f.length
   const j = ORDER.indexOf(id)
   const ks: number[] = []
   for (let q = 0; q < 2 && q < n; q++) ks.push((j + q) % n)
   return ks
}

function pushToast(s: State, who: StudentId, kind: ToastKind): Pick<State, 'toasts' | 'seq'> {
   const seq = s.seq + 1
   return { toasts: [...s.toasts.slice(-1), { id: seq, who, kind }], seq }
}

function patchFolder(s: State, fn: (f: FolderState) => FolderState): FolderState[] {
   return s.folders.map((f, i) => (i === s.cur ? fn(f) : f))
}

// Переход между экранами: панель/поповер закрываются, «уходящие» аватары дорисованы — убираем.
const nav = (s: State, patch: Partial<State>): State => ({
   ...s,
   panel: null,
   pop: null,
   folders: s.folders.map(f => ({ ...f, access: f.access.filter(e => !e.leaving) })),
   ...patch
})

function grant(s: State, id: StudentId): State {
   const f = s.folders[s.cur]
   if (activeIds(f).includes(id)) return s
   const k = f.open.indexOf(false)
   const existing = f.access.some(e => e.id === id)
   return {
      ...s,
      ...pushToast(s, id, 'granted'),
      lastGranted: id,
      folders: patchFolder(s, fo => ({
         access: existing
            ? fo.access.map(e => (e.id === id ? { ...e, leaving: false, fresh: true } : e))
            : [...fo.access, { id, leaving: false, fresh: true }],
         open: k > -1 ? fo.open.map((o, i) => (i === k ? true : o)) : fo.open
      }))
   }
}

function revoke(s: State, id: StudentId): State {
   const f = s.folders[s.cur]
   if (!activeIds(f).includes(id)) return s
   let last = -1
   for (let k = f.open.length - 1; k >= 0; k--) {
      if (f.open[k]) {
         last = k
         break
      }
   }
   return {
      ...s,
      ...pushToast(s, id, 'revoked'),
      folders: patchFolder(s, fo => ({
         access: fo.access.map(e => (e.id === id ? { ...e, leaving: true, fresh: false } : e)),
         open: last > -1 ? fo.open.map((o, i) => (i === last ? false : o)) : fo.open
      }))
   }
}

export function reducer(s: State, a: Action): State {
   switch (a.type) {
      case 'select':
         if (a.i === s.cur && s.mode === 'folder') return s
         return nav(s, { cur: a.i, mode: 'folder', subId: null })
      case 'nextFolder':
         return nav(s, { cur: (s.cur + 1) % FOLDER_DEFS.length, mode: 'folder', subId: null })
      case 'openSub':
         return nav(s, { mode: 'sub', subId: a.id })
      case 'goFolder':
         return nav(s, { mode: 'folder', subId: null })
      case 'goRoot':
         return nav(s, { mode: 'root', subId: null })
      case 'grant':
         return grant(s, a.id)
      case 'revoke':
         return revoke(s, a.id)
      case 'toggleAccess':
         return activeIds(s.folders[s.cur]).includes(a.id) ? revoke(s, a.id) : grant(s, a.id)
      case 'autoGrant': {
         const have = activeIds(s.folders[s.cur])
         const c = ORDER.filter(id => !have.includes(id))
         return c.length ? grant(s, c[0]) : s
      }
      case 'autoRevoke': {
         const c = activeIds(s.folders[s.cur]).filter(id => id !== s.lastGranted)
         return c.length ? revoke(s, c[0]) : s
      }
      case 'openPanel':
         return { ...s, panel: { k: a.k, closing: false }, pop: null }
      case 'panelClosing':
         return s.panel ? { ...s, panel: { ...s.panel, closing: true }, pop: s.pop === 'panel' ? null : s.pop } : s
      case 'panelDone':
         return s.panel?.closing ? { ...s, panel: null } : s
      case 'toggleFile': {
         if (!s.panel) return s
         const k = s.panel.k
         const f = s.folders[s.cur]
         const o = !f.open[k]
         const sub = s.mode === 'sub' && s.subId
         const who = sub ? s.subId! : (activeIds(f)[0] ?? ORDER[0])
         const kind: ToastKind = o ? (sub ? 'fileSubOpen' : 'fileOpen') : sub ? 'revoked' : 'fileClosed'
         return {
            ...s,
            ...pushToast(s, who, kind),
            folders: patchFolder(s, fo => ({ ...fo, open: fo.open.map((v, i) => (i === k ? o : v)) }))
         }
      }
      case 'togglePop':
         return { ...s, pop: s.pop === a.where ? null : a.where }
      case 'closePop':
         return s.pop ? { ...s, pop: null } : s
      case 'purge':
         return {
            ...s,
            folders: s.folders.map(f => ({ ...f, access: f.access.filter(e => !(e.id === a.id && e.leaving)) }))
         }
      case 'settle':
         return {
            ...s,
            folders: s.folders.map(f => ({ ...f, access: f.access.map(e => (e.fresh ? { ...e, fresh: false } : e)) }))
         }
      case 'dismissToast':
         return { ...s, toasts: s.toasts.filter(t => t.id !== a.id) }
   }
}
