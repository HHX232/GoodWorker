// entities/store/slices/postSlice.slice.ts
import {PostBlockType} from '@/shared/types/Post/Post.type'
import {createSlice, nanoid, PayloadAction} from '@reduxjs/toolkit'

export interface PostBlock {
  id: string
  type: PostBlockType
  payload: unknown
}

export interface PostConstructorState {
  blocks: PostBlock[]
  title: string
  visibility: 'PUBLIC' | 'PRIVATE'
  categoryIds: string[]
}

const defaultPayloads: Record<PostBlockType, unknown> = {
  [PostBlockType.TEXT]: {content: null},
  [PostBlockType.MEDIA]: {kind: null, url: null, caption: null},
  [PostBlockType.AUDIO]: {url: null, filename: null},
  [PostBlockType.TEST_LINK]: {testId: null, title: null}
}

const initialState: PostConstructorState = {
  blocks: [],
  title: '',
  visibility: 'PUBLIC',
  categoryIds: []
}

const postSlice = createSlice({
  name: 'postConstructor',
  initialState,
  reducers: {
    addPostBlock(state, action: PayloadAction<PostBlockType>) {
      state.blocks.push({
        id: nanoid(),
        type: action.payload,
        payload: structuredClone(defaultPayloads[action.payload])
      })
    },

    removePostBlock(state, action: PayloadAction<string>) {
      state.blocks = state.blocks.filter((b) => b.id !== action.payload)
    },

    reorderPostBlocks(state, action: PayloadAction<{activeId: string; overId: string}>) {
      const {activeId, overId} = action.payload
      const oldIndex = state.blocks.findIndex((b) => b.id === activeId)
      const newIndex = state.blocks.findIndex((b) => b.id === overId)
      if (oldIndex === -1 || newIndex === -1) return
      const [moved] = state.blocks.splice(oldIndex, 1)
      state.blocks.splice(newIndex, 0, moved)
    },

    updatePostBlockPayload(state, action: PayloadAction<{id: string; payload: unknown}>) {
      const block = state.blocks.find((b) => b.id === action.payload.id)
      if (block) block.payload = action.payload.payload
    },

    setPostTitle(state, action: PayloadAction<string>) {
      state.title = action.payload
    },

    setPostVisibility(state, action: PayloadAction<'PUBLIC' | 'PRIVATE'>) {
      state.visibility = action.payload
    },

    setPostCategoryIds(state, action: PayloadAction<string[]>) {
      state.categoryIds = action.payload
    },

    initPostConstructor(_state, action: PayloadAction<Partial<PostConstructorState>>) {
      return {...initialState, ...action.payload}
    },

    resetPostConstructor() {
      return initialState
    }
  }
})

export const postActions = postSlice.actions
export default postSlice
