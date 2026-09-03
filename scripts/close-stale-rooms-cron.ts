// Meant to run as a scheduled Railway service on the same image as the main
// app (npx tsx scripts/close-stale-rooms-cron.ts), hitting our own
// /api/cron/close-stale-rooms endpoint. Plain console output so failures
// always show up in that service's Deploy Logs — no third-party image
// entrypoint to fight with.

const targetUrl = process.env.CRON_TARGET_URL ?? 'https://goodworker.up.railway.app/api/cron/close-stale-rooms'
const secret = process.env.CRON_SECRET

async function main() {
  if (!secret) {
    console.error('[close-stale-rooms-cron] CRON_SECRET is not set')
    process.exit(1)
  }

  console.log(`[close-stale-rooms-cron] calling ${targetUrl}`)

  const res = await fetch(targetUrl, {
    headers: {Authorization: `Bearer ${secret}`}
  })
  const body = await res.text()

  console.log(`[close-stale-rooms-cron] ${res.status} ${res.statusText} — ${body}`)

  if (!res.ok) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[close-stale-rooms-cron] request failed', err)
  process.exit(1)
})
