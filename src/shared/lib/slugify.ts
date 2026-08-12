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

/** Generates a unique post slug: "testiruem-post-1213". Pass an async checker that returns true if slug is taken. */
export async function generatePostSlug(
  title: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(title).slice(0, 55)
  for (let i = 0; i < 20; i++) {
    const suffix = Math.floor(1000 + Math.random() * 9000)
    const candidate = `${base}-${suffix}`
    if (!(await isTaken(candidate))) return candidate
  }
  // Fallback: millisecond tail (virtually no collision)
  return `${base}-${Date.now() % 100000}`
}

/** Strips the 4-digit numeric suffix added by generatePostSlug for display purposes */
export function stripSlugSuffix(slug: string): string {
  return slug.replace(/-\d{4,5}$/, '')
}
