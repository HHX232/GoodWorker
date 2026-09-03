interface CategoryTranslation {
  langCode: string
  name: string
}

interface CategoryNode {
  id: string
  slug: string
  translations: CategoryTranslation[]
  parent?: CategoryNode | null
}

export interface ResolvedCategory {
  id: string
  slug: string
  translations: CategoryTranslation[]
}

/**
 * A teacher's TeacherCategory rows can point at any level of the category
 * tree (a subtopic like "Фонетика" under "Русский"), but only the top-level
 * subject should ever be shown as "what this teacher teaches" — walk the
 * parent chain up to the root.
 */
export function resolveRootCategory<T extends CategoryNode>(category: T): ResolvedCategory {
  let current: CategoryNode = category
  while (current.parent) {
    current = current.parent
  }
  return {id: current.id, slug: current.slug, translations: current.translations}
}

/** Resolves a teacher's linked categories to their unique top-level subjects. */
export function resolveTeacherCategories<T extends CategoryNode>(
  categories: {category: T}[]
): {category: ResolvedCategory}[] {
  const seen = new Map<string, ResolvedCategory>()
  for (const {category} of categories) {
    const root = resolveRootCategory(category)
    if (!seen.has(root.id)) seen.set(root.id, root)
  }
  return Array.from(seen.values()).map((category) => ({category}))
}
