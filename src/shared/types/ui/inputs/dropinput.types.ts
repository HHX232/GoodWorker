
export interface DropInputItem {
  id: string | number
  label: string | React.ReactNode
  onItemClick?: (item: DropInputItem) => void
}

export interface DropInputUIProps {
  placeholder?: string
  initialActiveItem?: DropInputItem
  items?: DropInputItem[]
}
