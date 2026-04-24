import activeTestSlice from './slices/activeTestSlice.slice'
import calendarSlice from './slices/calendar.slice'
import postSlice from './slices/post.slice'
import roadmapUISlice from './slices/roadmapUISlice.slice'
import tasksSlice from './slices/tasksSlice.slice'

export const rootActions = {
  ...tasksSlice.actions,
  ...roadmapUISlice.actions,
  ...activeTestSlice.actions,
  ...calendarSlice.actions,
  ...postSlice.actions
}
