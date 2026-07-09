import { transliterateCyrillicToLatin } from './transliterate'

export function slugify(str: string): string {
  return transliterateCyrillicToLatin(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'post'
}
