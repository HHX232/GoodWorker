import {createContext, useContext} from 'react'
interface InvalidBlocksCtx {
  ids: Set<string>
  errors: Map<string, string>
  clear: (blockId: string) => void
}
export const InvalidTestBlocksContext = createContext<InvalidBlocksCtx>({
  ids: new Set(),
  errors: new Map(),
  clear: () => {}
})

export const useInvalidTestBlocks = () => useContext(InvalidTestBlocksContext)
