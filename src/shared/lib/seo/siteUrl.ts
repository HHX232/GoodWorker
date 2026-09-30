// Canonical origin for robots/sitemap. NEXT_PUBLIC_APP_URL wins only when it is a real https origin
// (a dev value like http://localhost:3000 must never end up in the production sitemap).
const env = process.env.NEXT_PUBLIC_APP_URL
export const SITE_URL = (env && env.startsWith('https://') ? env : 'https://goodworker.online').replace(/\/$/, '')
