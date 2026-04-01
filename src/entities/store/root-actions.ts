import activeTestSlice from './slices/activeTestSlice.slice'
import roadmapUISlice from './slices/roadmapUISlice.slice'
import tasksSlice from './slices/tasksSlice.slice'

export const rootActions = {
  ...tasksSlice.actions,
  ...roadmapUISlice.actions,
  ...activeTestSlice.actions
}
