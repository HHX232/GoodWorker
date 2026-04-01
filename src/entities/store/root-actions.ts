import roadmapUISlice from './slices/roadmapUISlice.slice'
import tasksSlice from './slices/tasksSlice.slice'

export const rootActions = {
  ...tasksSlice.actions,
  ...roadmapUISlice.actions
}
