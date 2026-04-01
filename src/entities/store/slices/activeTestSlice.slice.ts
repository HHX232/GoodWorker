// features/test-block-editor/model/activeTestSlice.ts
import {TaskBlockRegistry} from '@/features'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {createSlice, nanoid, PayloadAction} from '@reduxjs/toolkit'
import tasksSlice, {TestBlock} from './tasksSlice.slice'

export interface ActiveTestState {
  blocks: TestBlock[]
  activeNodeId: string | null // какая нода сейчас редактируется
}

const initialState: ActiveTestState = {
  blocks: [],
  activeNodeId: null
}

const activeTestSlice = createSlice({
  name: 'activeTest',
  initialState,
  extraReducers: (builder) => {
    builder.addCase(tasksSlice.actions.updateBlockPayload, (state, action) => {
      const block = state.blocks.find((b) => b.id === action.payload.id)
      if (block) block.payload = action.payload.payload
    })
  },
  reducers: {
    // Загрузка блоков из nodeData при маунте ноды
    loadBlocksForNode(state, action: PayloadAction<{nodeId: string; blocks: TestBlock[]}>) {
      state.activeNodeId = action.payload.nodeId
      state.blocks = action.payload.blocks
    },

    addActiveBlock(state, action: PayloadAction<TaskBlockType>) {
      const meta = TaskBlockRegistry[action.payload]
      state.blocks.push({
        id: nanoid(),
        type: action.payload,
        payload: structuredClone(meta.defaultPayload)
      })
    },

    removeActiveBlock(state, action: PayloadAction<string>) {
      state.blocks = state.blocks.filter((b) => b.id !== action.payload)
    },

    updateActiveBlockPayload(state, action: PayloadAction<{id: string; payload: unknown}>) {
      const block = state.blocks.find((b) => b.id === action.payload.id)
      if (block) block.payload = action.payload.payload
    },

    reorderActiveBlocks(state, action: PayloadAction<{activeId: string; overId: string}>) {
      const {activeId, overId} = action.payload
      const oldIndex = state.blocks.findIndex((b) => b.id === activeId)
      const newIndex = state.blocks.findIndex((b) => b.id === overId)
      if (oldIndex === -1 || newIndex === -1) return
      const [moved] = state.blocks.splice(oldIndex, 1)
      state.blocks.splice(newIndex, 0, moved)
    },

    clearActiveTest(state) {
      state.blocks = []
      state.activeNodeId = null
    }
  }
})

export default activeTestSlice
