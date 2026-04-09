import {TaskBlockRegistry} from '@/features'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {createSlice, nanoid, PayloadAction} from '@reduxjs/toolkit'
import tasksSlice, {TestBlock} from './tasksSlice.slice'

export interface ActiveTestState {
  blocksByNode: Record<string, TestBlock[]>
  activeNodeId: string | null
}

const initialState: ActiveTestState = {
  blocksByNode: {},
  activeNodeId: null
}

const activeTestSlice = createSlice({
  name: 'activeTest',
  initialState,
  extraReducers: (builder) => {
    builder.addCase(tasksSlice.actions.updateBlockPayload, (state, action) => {
      if (!state.activeNodeId) return
      const blocks = state.blocksByNode[state.activeNodeId]
      if (!blocks) return
      const block = blocks.find((b) => b.id === action.payload.id)
      if (block) block.payload = action.payload.payload
    })
  },
  reducers: {
    loadBlocksForNode(state, action: PayloadAction<{nodeId: string; blocks: TestBlock[]}>) {
      const {nodeId, blocks} = action.payload
      state.activeNodeId = nodeId
      if (!state.blocksByNode[nodeId]) {
        state.blocksByNode[nodeId] = structuredClone(blocks)
      }
    },

    addActiveBlock(state, action: PayloadAction<TaskBlockType>) {
      if (!state.activeNodeId) return
      const meta = TaskBlockRegistry[action.payload]
      const blocks = state.blocksByNode[state.activeNodeId] ?? []
      blocks.push({
        id: nanoid(),
        type: action.payload,
        payload: structuredClone(meta.defaultPayload)
      })
      state.blocksByNode[state.activeNodeId] = blocks
    },

    removeActiveBlock(state, action: PayloadAction<string>) {
      if (!state.activeNodeId) return
      const blocks = state.blocksByNode[state.activeNodeId] ?? []
      state.blocksByNode[state.activeNodeId] = blocks.filter((b) => b.id !== action.payload)
    },

    reorderActiveBlocks(state, action: PayloadAction<{activeId: string; overId: string}>) {
      if (!state.activeNodeId) return
      const blocks = state.blocksByNode[state.activeNodeId] ?? []
      const oldIndex = blocks.findIndex((b) => b.id === action.payload.activeId)
      const newIndex = blocks.findIndex((b) => b.id === action.payload.overId)
      if (oldIndex === -1 || newIndex === -1) return
      const [moved] = blocks.splice(oldIndex, 1)
      blocks.splice(newIndex, 0, moved)
    },

    // Вызывать при дублировании
    cloneNodeBlocks(state, action: PayloadAction<{fromNodeId: string; toNodeId: string}>) {
      const source = state.blocksByNode[action.payload.fromNodeId]
      if (!source) return
      state.blocksByNode[action.payload.toNodeId] = structuredClone(source).map((b) => ({
        ...b,
        id: nanoid()
      }))
    },

    removeNodeBlocks(state, action: PayloadAction<string>) {
      delete state.blocksByNode[action.payload]
    },

    clearActiveTest(state) {
      state.blocksByNode = {}
      state.activeNodeId = null
    }
  }
})

export default activeTestSlice
