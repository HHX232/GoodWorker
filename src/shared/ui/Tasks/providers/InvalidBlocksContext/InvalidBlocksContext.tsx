import {createContext, useContext} from 'react'
interface InvalidBlocksCtx {
  ids: Set<string>
  clear: (blockId: string) => void
}
export const InvalidTestBlocksContext = createContext<InvalidBlocksCtx>({
  ids: new Set(),
  clear: () => {}
})

export const useInvalidTestBlocks = () => useContext(InvalidTestBlocksContext)
