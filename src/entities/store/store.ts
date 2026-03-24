import { combineReducers, configureStore } from '@reduxjs/toolkit'
import tasksSlice from './slices/tasksSlice.slice'


const rootReducer = combineReducers({
  tasks: tasksSlice.reducer,

})

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware()
})

export type TypeRootState = ReturnType<typeof store.getState>
export type TypeAppDispatch = typeof store.dispatch
