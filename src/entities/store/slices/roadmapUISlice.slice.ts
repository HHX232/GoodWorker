import {createSlice, PayloadAction} from '@reduxjs/toolkit'

export interface RoadmapUIState {
  isPaywallMode: boolean
}

const initialState: RoadmapUIState = {
  isPaywallMode: false
}

const roadmapUISlice = createSlice({
  name: 'roadmapUI',
  initialState,
  reducers: {
    toggleRoadmapPaywallMode(state) {
      state.isPaywallMode = !state.isPaywallMode
    },
    setRoadmapPaywallMode(state, action: PayloadAction<boolean>) {
      state.isPaywallMode = action.payload
    }
  }
})

export default roadmapUISlice
