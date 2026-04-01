import {combineReducers, configureStore} from '@reduxjs/toolkit'
import tasksSlice from './slices/tasksSlice.slice'
import roadmapUISlice from './slices/roadmapUISlice.slice'
import activeTestSlice from './slices/activeTestSlice.slice'

const rootReducer = combineReducers({
  tasks: tasksSlice.reducer,
  roadmapUISlice: roadmapUISlice.reducer,
  activeTestSlice: activeTestSlice.reducer
})

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware()
})

export type TypeRootState = ReturnType<typeof store.getState>
export type TypeAppDispatch = typeof store.dispatch
