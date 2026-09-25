// Prisma-free so client components can import them too (storage.ts re-exports
// them for server code) — interfaces.md "Контракт между тикетами: квота".

/** Single source of truth for the storage cap. */
export const QUOTA_BYTES = 7 * 1024 ** 3

/**
 * A root folder (no parent) has depth 1 (`ancestorIds.length === 0`). A
 * folder's depth is `ancestorIds.length + 1`. 6 levels means the deepest
 * allowed folder has 5 ancestors.
 */
export const MAX_FOLDER_DEPTH = 6

/** Per-file upload cap, same as app/api/upload/route.ts. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024
