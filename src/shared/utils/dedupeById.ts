/**
 * Drops any item whose id already appeared earlier in the array, keeping
 * the first occurrence. Used for test blocks: a React-Strict-Mode double
 * effect once let the whole block set get added twice before being saved,
 * and duplicate `key`s on the test-taking page make it unusable.
 */
export function dedupeById<T extends {id: string}>(items: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }
  return result
}
