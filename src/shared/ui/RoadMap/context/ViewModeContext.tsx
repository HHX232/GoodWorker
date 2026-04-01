import {createContext, useContext} from 'react'

export type ViewMode = 'edit' | 'view'

export const ViewModeContext = createContext<ViewMode>('edit')
export const useViewMode = () => useContext(ViewModeContext)
