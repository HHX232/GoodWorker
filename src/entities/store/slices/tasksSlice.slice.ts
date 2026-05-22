// features/test-block-editor/model/constructorSlice.ts
import {TaskBlockRegistry} from '@/features'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {createSlice, nanoid, PayloadAction} from '@reduxjs/toolkit'

export interface TestBlock {
  id: string
  type: TaskBlockType
  payload: unknown
}

export interface ConstructorState {
  blocks: TestBlock[]
  selectedBlockId: string | null
  title: string
  theme: string
  description: string
  categoryIds: string[]
}

const initialState: ConstructorState = {
  blocks: [],
  selectedBlockId: null,
  title: '',
  theme: '',
  description: '',
  categoryIds: []
}

const tasksSlice = createSlice({
  name: 'constructor',
  initialState,
  reducers: {
    addBlock(state, action: PayloadAction<TaskBlockType>) {
      const meta = TaskBlockRegistry[action.payload]
      state.blocks.push({
        id: nanoid(),
        type: action.payload,
        payload: structuredClone(meta.defaultPayload)
      })
    },

    removeBlock(state, action: PayloadAction<string>) {
      state.blocks = state.blocks.filter((b) => b.id !== action.payload)
    },
    setCategoryIds(state, action: PayloadAction<string[]>) {
      state.categoryIds = action.payload
    },
    reorderBlocks(state, action: PayloadAction<{activeId: string; overId: string}>) {
      const {activeId, overId} = action.payload
      const oldIndex = state.blocks.findIndex((b) => b.id === activeId)
      const newIndex = state.blocks.findIndex((b) => b.id === overId)
      if (oldIndex === -1 || newIndex === -1) return

      const [moved] = state.blocks.splice(oldIndex, 1)
      state.blocks.splice(newIndex, 0, moved)
    },

    updateBlockPayload(state, action: PayloadAction<{id: string; payload: unknown}>) {
      const block = state.blocks.find((b) => b.id === action.payload.id)
      if (block) block.payload = action.payload.payload
    },

    selectBlock(state, action: PayloadAction<string | null>) {
      state.selectedBlockId = action.payload
    },

    setTitle(state, action: PayloadAction<string>) {
      state.title = action.payload
    },

    setTheme(state, action: PayloadAction<string>) {
      state.theme = action.payload
    },

    setDescription(state, action: PayloadAction<string>) {
      state.description = action.payload
    },

    addBlocks(state, action: PayloadAction<TestBlock[]>) {
      for (const block of action.payload) {
        state.blocks.push(block)
      }
    },

    resetConstructor() {
      return initialState
    }
  }
})

export default tasksSlice
