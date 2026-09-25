// Prisma-free so client components can import them too.

/**
 * A root folder (no parent) has depth 1 (`ancestorIds.length === 0`). A
 * folder's depth is `ancestorIds.length + 1`. 6 levels means the deepest
 * allowed folder has 5 ancestors.
 */
export const MAX_FOLDER_DEPTH = 6

/** Defaults for the admin-editable StorageSettings row (used until an admin saves it). */
export const DEFAULT_QUOTA_GB = 15
export const DEFAULT_MAX_FILE_MB = 50

/** Admin input bounds. The per-file cap stays modest: uploads are buffered in memory by the route. */
export const QUOTA_GB_RANGE = { min: 1, max: 1000 } as const
export const MAX_FILE_MB_RANGE = { min: 1, max: 200 } as const

export const GB = 1024 ** 3
export const MB = 1024 ** 2
