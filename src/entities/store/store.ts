import {combineReducers, configureStore} from '@reduxjs/toolkit'
import activeTestSlice from './slices/activeTestSlice.slice'
import calendarSlice from './slices/calendar.slice'
import roadmapUISlice from './slices/roadmapUISlice.slice'
import tasksSlice from './slices/tasksSlice.slice'
import postSlice from './slices/post.slice'

const rootReducer = combineReducers({
  tasks: tasksSlice.reducer,
  roadmapUISlice: roadmapUISlice.reducer,
  activeTestSlice: activeTestSlice.reducer,
  calendar: calendarSlice.reducer,
  postSlice: postSlice.reducer
})

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware()
})

export type TypeRootState = ReturnType<typeof store.getState>
export type TypeAppDispatch = typeof store.dispatch
