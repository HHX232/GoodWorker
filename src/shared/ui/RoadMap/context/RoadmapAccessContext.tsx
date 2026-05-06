import { RoadmapNodeAccessType } from '@/features/services/RoadmapService.service'
import { createContext, useContext } from 'react'

interface RoadmapAccessContextValue {
  hasAccess: boolean
  nodeAccessType: RoadmapNodeAccessType | null
  openPurchaseModal: () => void
  roadmapId: string
}

export const RoadmapAccessContext = createContext<RoadmapAccessContextValue>({
  hasAccess: false,
  nodeAccessType: null,
  openPurchaseModal: () => {},
  roadmapId: '',
})

export const useRoadmapAccessContext = () => useContext(RoadmapAccessContext)
