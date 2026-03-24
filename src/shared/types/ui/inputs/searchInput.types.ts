export interface SearchItem {
  id: string | number
  label: string
}
export interface SearchInputUIProps {
  placeholder?: string
  items?: SearchItem[]
  onSelect?: (item: SearchItem) => void
  onChange?: (value: string) => void
}