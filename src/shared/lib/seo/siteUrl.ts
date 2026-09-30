// Canonical origin for robots/sitemap/canonical links. Not NEXT_PUBLIC_APP_URL: on Railway that is the
// *.up.railway.app service domain, and search engines must see the public one. SITE_URL overrides.
export const SITE_URL = (process.env.SITE_URL || 'https://goodworker.online').replace(/\/$/, '')
